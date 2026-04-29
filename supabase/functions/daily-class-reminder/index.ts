/**
 * daily-class-reminder — 회원별 당일 PT 예약 알림 (KST).
 *
 * pg_cron 등으로 하루 2회 호출:
 * - ?slot=early  → 08:30 KST: 오늘 예약 중 시작 시각이 11:00 **미만**
 * - ?slot=late   → 10:00 KST: 오늘 예약 중 시작 시각이 11:00 **이상**
 *
 * 데이터: `bookings` (테이블명 `schedules` 아님 — 앱 스키마와 동일)
 * 푸시: `profiles.onesignal_id` + OneSignal REST (Basic) — Service Role로 조회
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

/** HH:mm (24h) — 메시지용 */
function formatClassTimeHHmm(time: string): string {
  const mins = parseTimeToMinutes(time);
  if (mins === null) return String(time).trim() || "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function matchesSlot(time: string, slot: Slot): boolean {
  const mins = parseTimeToMinutes(time);
  if (mins === null) return false;
  const elevenAm = 11 * 60;
  if (slot === "early") return mins < elevenAm;
  return mins >= elevenAm;
}

function buildMessage(classTimeHHmm: string): string {
  return `오늘은 ${classTimeHHmm}에 PT수업이 있는 날입니다. 잠시 후에 뵙겠습니다. 오늘도 좋은 하루 되시길 바랍니다.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const url = new URL(req.url);
  const slotParam = url.searchParams.get("slot")?.toLowerCase();
  if (slotParam !== "early" && slotParam !== "late") {
    return new Response(
      JSON.stringify({
        error: 'Missing or invalid query param "slot" — use "early" (08:30 KST) or "late" (10:00 KST).',
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const slot = slotParam as Slot;

  const appId = (Deno.env.get("ONESIGNAL_APP_ID") || "").replace(/["']/g, "").trim();
  const restKey = (Deno.env.get("ONESIGNAL_REST_API_KEY") || "").replace(/["']/g, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!appId || !restKey || !supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({
        error: "Missing ENV (ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const todayKST = getTodayKST();

  const { data: bookingRows, error: bookingsErr } = await supabase
    .from("bookings")
    .select("id, user_id, date, time, status")
    .eq("date", todayKST)
    .neq("status", "cancelled");

  if (bookingsErr) {
    console.error("[daily-class-reminder] bookings error:", bookingsErr);
    return new Response(JSON.stringify({ error: bookingsErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (bookingRows ?? []) as BookingRow[];
  const filtered = rows.filter((r) => matchesSlot(String(r.time ?? ""), slot));

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

  const title = "LAB DOT · 오늘의 PT";
  const results: Array<{
    booking_id: string;
    user_id: string;
    sent: boolean;
    skipped?: string;
    error?: string;
  }> = [];

  for (const row of earliestByUser.values()) {
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("onesignal_id, name")
      .eq("id", row.user_id)
      .maybeSingle();

    if (pErr) {
      results.push({
        booking_id: row.id,
        user_id: row.user_id,
        sent: false,
        error: pErr.message,
      });
      continue;
    }

    const pid = profile?.onesignal_id ? String(profile.onesignal_id).trim() : "";
    if (!pid) {
      results.push({
        booking_id: row.id,
        user_id: row.user_id,
        sent: false,
        skipped: "no_onesignal_id",
      });
      continue;
    }

    const classTimeHHmm = formatClassTimeHHmm(String(row.time ?? ""));
    const message = buildMessage(classTimeHHmm);

    const res = await fetch(ONESIGNAL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${restKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: [pid],
        headings: { en: title },
        contents: { en: message },
        data: {
          labdot_audience: "member",
          labdot_event: "daily_class_reminder",
          slot,
          booking_id: row.id,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data as { errors?: unknown }).errors) {
      results.push({
        booking_id: row.id,
        user_id: row.user_id,
        sent: false,
        error: JSON.stringify(data),
      });
      continue;
    }

    results.push({ booking_id: row.id, user_id: row.user_id, sent: true });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      function: "daily-class-reminder",
      slot,
      date_kst: todayKST,
      bookings_in_slot: filtered.length,
      members_targeted: earliestByUser.size,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
