/**
 * Morning Concierge — daily push for members with PT today (KST).
 *
 * Schedule twice via pg_cron (service_role bearer):
 * - slot=early  → 08:30 KST: bookings today with class start strictly before 11:00
 * - slot=late   → 10:00 KST: bookings today with class start at or after 11:00
 *
 * Does not modify send-class-reminders (member 60m / admin 10m) behavior.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

type BookingRow = {
  id: string;
  user_id: string;
  date: string;
  time: string;
  status: string | null;
};

type Slot = "early" | "late";

function getTodayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function parseTimeToMinutes(raw: string): number | null {
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** "10시" / "14시 30분" — natural Korean for the message body */
function formatKoreanClassTime(time: string): string {
  const mins = parseTimeToMinutes(time);
  if (mins === null) return time.trim() || "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}시`;
  return `${h}시 ${m}분`;
}

function matchesSlot(time: string, slot: Slot): boolean {
  const mins = parseTimeToMinutes(time);
  if (mins === null) return false;
  const elevenAm = 11 * 60;
  if (slot === "early") return mins < elevenAm;
  return mins >= elevenAm;
}

function buildBody(classTimePhrase: string): string {
  return `오늘은 ${classTimePhrase}에 pt수업이 있는 날입니다. 잠시 후에 뵙겠습니다. 오늘도 좋은하루 되시길 바랍니다.`;
}

async function sendOneSignalNotification(params: {
  appId: string;
  restKey: string;
  externalUserIds: string[];
  title: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  const { appId, restKey, externalUserIds, title, body } = params;
  if (externalUserIds.length === 0) return { ok: true };

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
    return { ok: false, error: data.errors?.[0] ?? data.message ?? `HTTP ${res.status}`, raw: data };
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

  const url = new URL(req.url);
  const slotParam = url.searchParams.get("slot")?.toLowerCase();
  if (slotParam !== "early" && slotParam !== "late") {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid query param "slot" — use "early" (08:30 KST) or "late" (10:00 KST).' }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const slot = slotParam as Slot;

  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!appId || !restKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing ENV (ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const todayKST = getTodayKST();

  const { data: bookingRows, error: bookingsErr } = await supabase
    .from("bookings")
    .select("id, user_id, date, time, status")
    .eq("date", todayKST)
    .neq("status", "cancelled");

  if (bookingsErr) {
    console.error("[morning-concierge] bookings error:", bookingsErr);
    return new Response(JSON.stringify({ error: bookingsErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const rows = (bookingRows ?? []) as BookingRow[];
  const filtered = rows.filter((r) => matchesSlot(String(r.time ?? ""), slot));

  // One push per member per slot: earliest class time wins if multiple bookings
  const earliestByUser = new Map<string, BookingRow>();
  for (const r of filtered) {
    const prev = earliestByUser.get(r.user_id);
    if (!prev) {
      earliestByUser.set(r.user_id, r);
      continue;
    }
    const a = parseTimeToMinutes(String(r.time ?? ""));
    const b = parseTimeToMinutes(String(prev.time ?? ""));
    if (a !== null && b !== null && a < b) earliestByUser.set(r.user_id, r);
  }

  const results: Array<{ booking_id: string; user_id: string; kind: string; sent: boolean; error?: string }> = [];

  for (const row of earliestByUser.values()) {
    const classTimePhrase = formatKoreanClassTime(String(row.time ?? ""));
    const body = buildBody(classTimePhrase);
    const r = await sendOneSignalNotification({
      appId,
      restKey,
      externalUserIds: [row.user_id],
      title: "오늘의 PT",
      body,
    });
    results.push({
      booking_id: row.id,
      user_id: row.user_id,
      kind: slot === "early" ? "morning_concierge_early" : "morning_concierge_late",
      sent: r.ok,
      error: r.ok ? undefined : r.error,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      slot,
      date_kst: todayKST,
      bookings_in_slot: filtered.length,
      members_notified: earliestByUser.size,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
