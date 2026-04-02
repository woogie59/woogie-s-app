/**
 * send-class-reminders — Automated Launchpad (pg_cron: every minute)
 *
 * Expected `schedules` shape (adjust column names in SQL if yours differ):
 * - id uuid
 * - user_id uuid → profiles (client)
 * - admin_id uuid nullable → profiles (trainer); if null, first role=admin is used
 * - date date (YYYY-MM-DD, calendar day in KST for the class)
 * - schedule_time text (HH:MM or H:MM, interpreted as KST wall time)
 * - status text (skip if 'cancelled')
 *
 * Env: ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

type ScheduleRow = {
  id: string;
  user_id: string;
  admin_id: string | null;
  date: string;
  schedule_time: string;
  status: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  onesignal_id: string | null;
  role: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Normalize DB time to HH:MM (24h, KST display). */
function parseScheduleTimeToParts(raw: string): { h: number; m: number } | null {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/** Class start as UTC instant from KST calendar date + wall time. */
function scheduleStartUtcMs(dateStr: string, scheduleTime: string): number | null {
  const parts = parseScheduleTimeToParts(scheduleTime);
  if (!parts) return null;
  const iso = `${dateStr}T${pad2(parts.h)}:${pad2(parts.m)}:00+09:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Format instant to "HH:MM" in KST (readable). */
function formatKstHHMM(utcMs: number): string {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utcMs));
  return s.replace(/\s/g, "");
}

async function sendOneSignalNotification(params: {
  appId: string;
  restKey: string;
  externalUserIds: string[];
  title: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  const { appId, restKey, externalUserIds, title, body } = params;
  if (externalUserIds.length === 0) {
    return { ok: true };
  }

  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${restKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_external_user_ids: externalUserIds,
      headings: { ko: title, en: title },
      contents: { ko: body, en: body },
      target_channel: "push",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: (data as { errors?: string[] })?.errors?.[0] ??
        (data as { message?: string })?.message ?? `HTTP ${res.status}`,
      raw: data,
    };
  }
  return { ok: true, raw: data };
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

  if (!appId || !restKey) {
    return new Response(
      JSON.stringify({ error: "Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const now = Date.now();
  /** Minute bucket (ms) for "starts in exactly 60 / 10 minutes" matching. */
  const clientTargetMinute = Math.floor((now + 60 * 60 * 1000) / 60000) * 60000;
  const adminTargetMinute = Math.floor((now + 10 * 60 * 1000) / 60000) * 60000;

  const { data: scheduleRows, error: schedErr } = await supabase
    .from("schedules")
    .select("id, user_id, admin_id, date, schedule_time, status")
    .neq("status", "cancelled");

  if (schedErr) {
    console.error("[send-class-reminders] schedules:", schedErr);
    return new Response(JSON.stringify({ error: schedErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (scheduleRows ?? []) as ScheduleRow[];
  const userIds = new Set<string>();
  for (const r of rows) {
    userIds.add(r.user_id);
    if (r.admin_id) userIds.add(r.admin_id);
  }

  const { data: defaultAdmin } = await supabase
    .from("profiles")
    .select("id, name, onesignal_id, role")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const { data: profilesData } = userIds.size > 0
    ? await supabase
      .from("profiles")
      .select("id, name, onesignal_id, role")
      .in("id", [...userIds])
    : { data: [] as ProfileRow[] };

  const profileById = new Map<string, ProfileRow>(
    (profilesData ?? []).map((p: ProfileRow) => [p.id, p]),
  );
  if (defaultAdmin?.id) {
    profileById.set((defaultAdmin as ProfileRow).id, defaultAdmin as ProfileRow);
  }

  const results: {
    schedule_id: string;
    kind: "client_60" | "admin_10";
    sent: boolean;
    detail?: string;
  }[] = [];

  for (const row of rows) {
    const startMs = scheduleStartUtcMs(String(row.date).slice(0, 10), row.schedule_time);
    if (startMs === null) {
      console.warn("[send-class-reminders] bad time row", row.id);
      continue;
    }
    const classMinute = Math.floor(startMs / 60000) * 60000;
    const hhmm = formatKstHHMM(startMs);

    const client = profileById.get(row.user_id);
    const adminId = row.admin_id ?? (defaultAdmin as ProfileRow | null)?.id ?? null;

    const clientName = (client?.name ?? "회원").trim() || "회원";

    if (classMinute === clientTargetMinute) {
      const title = "수업 1시간 전";
      const content =
        `오늘 ${hhmm} 수업 시작 1시간 전입니다. LAB DOT에서 뵙겠습니다.`;
      const extId = row.user_id;
      const r = await sendOneSignalNotification({
        appId,
        restKey,
        externalUserIds: [extId],
        title,
        body: content,
      });
      results.push({
        schedule_id: row.id,
        kind: "client_60",
        sent: r.ok,
        detail: r.ok ? undefined : r.error,
      });
      if (!r.ok) console.warn("[send-class-reminders] client push", row.id, r.error);
    }

    if (classMinute === adminTargetMinute && adminId) {
      const title = "수업 10분 전";
      const content = `${clientName}님과의 ${hhmm} 수업이 10분 뒤 시작됩니다.`;
      const r = await sendOneSignalNotification({
        appId,
        restKey,
        externalUserIds: [adminId],
        title,
        body: content,
      });
      results.push({
        schedule_id: row.id,
        kind: "admin_10",
        sent: r.ok,
        detail: r.ok ? undefined : r.error,
      });
      if (!r.ok) console.warn("[send-class-reminders] admin push", row.id, r.error);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      now_iso: new Date(now).toISOString(),
      client_target_minute_iso: new Date(clientTargetMinute).toISOString(),
      admin_target_minute_iso: new Date(adminTargetMinute).toISOString(),
      processed: rows.length,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
