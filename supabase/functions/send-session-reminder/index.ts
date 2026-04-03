/**
 * LAB DOT — Admin/Trainer: 10-minute-before-session push (KST).
 * Invoked every minute via pg_cron + service_role. Does not send member reminders.
 *
 * Bookings use `date` + `time` (Asia/Seoul); there is no `start_time` column.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

type BookingRow = {
  id: string;
  user_id: string;
  date: string;
  time: string;
  status: string | null;
  notes: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseScheduleTimeToParts(raw: string): { h: number; m: number } | null {
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/** Session start in UTC ms (KST wall clock from date + time). */
function scheduleStartUtcMs(dateStr: string, scheduleTime: string): number | null {
  const parts = parseScheduleTimeToParts(scheduleTime);
  if (!parts) return null;
  const dStr = String(dateStr).slice(0, 10);
  const iso = `${dStr}T${pad2(parts.h)}:${pad2(parts.m)}:00+09:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, mo, da] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1, da + days));
  return d.toISOString().slice(0, 10);
}

/** Default session label when no `session_type` column / notes hint. */
function deriveSessionType(_row: BookingRow): string {
  return "PT 1:1";
}

async function sendAdminSessionReminder(params: {
  appId: string;
  restKey: string;
  adminExternalIds: string[];
  title: string;
  body: string;
  subtitle: string;
  data: Record<string, string>;
  iosSound?: string;
  androidSound?: string;
}): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  const { appId, restKey, adminExternalIds, title, body, subtitle, data, iosSound, androidSound } = params;
  if (adminExternalIds.length === 0) return { ok: true };

  const channelId = Deno.env.get("ONESIGNAL_ANDROID_CHANNEL_ID");
  const payload: Record<string, unknown> = {
    app_id: appId,
    include_external_user_ids: adminExternalIds,
    headings: { ko: title, en: title },
    contents: { ko: body, en: body },
    subtitle: { ko: subtitle, en: subtitle },
    data,
    target_channel: "push",
    ios_sound: iosSound || "default",
    android_sound: androidSound || "default",
  };
  if (channelId) payload.android_channel_id = channelId;

  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${restKey}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json.errors?.[0] ?? json.message ?? `HTTP ${res.status}`, raw: json };
  }
  return { ok: true, raw: json };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const iosSound = Deno.env.get("ONESIGNAL_SESSION_REMINDER_IOS_SOUND");
  const androidSound = Deno.env.get("ONESIGNAL_SESSION_REMINDER_ANDROID_SOUND");

  if (!appId || !restKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing ENV (ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = Date.now();
  const targetMinute = Math.floor((now + 10 * 60 * 1000) / 60000) * 60000;

  const todayKst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const tomorrowKst = addDaysYmd(todayKst, 1);

  const { data: bookingRows, error: schedErr } = await supabase
    .from("bookings")
    .select("id, user_id, date, time, status, notes")
    .neq("status", "cancelled")
    .gte("date", todayKst)
    .lte("date", tomorrowKst);

  if (schedErr) {
    console.error("[send-session-reminder] bookings error:", schedErr);
    return new Response(JSON.stringify({ error: schedErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const { data: adminRows, error: adminErr } = await supabase.from("profiles").select("id").eq("role", "admin");

  if (adminErr) {
    console.error("[send-session-reminder] admin profiles error:", adminErr);
    return new Response(JSON.stringify({ error: adminErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const adminIds = (adminRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
  if (adminIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_admin_profiles", processed: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (bookingRows ?? []) as BookingRow[];
  const memberIds = [...new Set(rows.map((r) => r.user_id))];

  const { data: profilesData, error: profErr } = memberIds.length > 0
    ? await supabase.from("profiles").select("id, name").in("id", memberIds)
    : { data: [] as ProfileRow[], error: null };

  if (profErr) {
    console.error("[send-session-reminder] profiles error:", profErr);
    return new Response(JSON.stringify({ error: profErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const profileById = new Map<string, ProfileRow>((profilesData ?? []).map((p: ProfileRow) => [p.id, p]));

  const title = "LAB DOT | 세션 준비 (Session Ready)";
  const results: Array<{ booking_id: string; kind: string; sent: boolean; error?: string }> = [];

  for (const row of rows) {
    const startMs = scheduleStartUtcMs(String(row.date).slice(0, 10), row.time);
    if (startMs === null) continue;

    const classMinute = Math.floor(startMs / 60000) * 60000;
    if (classMinute !== targetMinute) continue;

    const client = profileById.get(row.user_id);
    const clientName = ((client?.name ?? "회원") as string).trim() || "회원";
    const sessionType = deriveSessionType(row);
    const dateKey = String(row.date).slice(0, 10);

    const body = `10분 후 ${clientName}님과의 수업이 시작됩니다. 준비를 시작해 주세요.`;

    const r = await sendAdminSessionReminder({
      appId,
      restKey,
      adminExternalIds: adminIds,
      title,
      body,
      subtitle: sessionType,
      iosSound: iosSound || undefined,
      androidSound: androidSound || undefined,
      data: {
        labdot_action: "admin_timeline",
        booking_date: dateKey,
        booking_id: row.id,
        session_type: sessionType,
      },
    });

    results.push({ booking_id: row.id, kind: "admin_session_10m", sent: r.ok, error: r.ok ? undefined : r.error });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      target_minute_utc_ms: targetMinute,
      scanned: rows.length,
      admin_recipients: adminIds.length,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
