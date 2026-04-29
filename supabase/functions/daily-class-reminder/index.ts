/**
 * daily-class-reminder — 회원별 당일 PT 예약 알림 (KST).
 *
 * pg_cron 등으로 하루 2회 호출:
 * - ?slot=early  → 08:30 KST: 오늘 예약 중 시작 시각이 11:00 **미만**
 * - ?slot=late   → 10:00 KST: 오늘 예약 중 시작 시각이 11:00 **이상**
 *
 * 데이터: `bookings.date`는 **장소 시각표기용 캘린더 날짜(앱 기준 KST)** — 쿼리는 `eq("date", todayKST)` 문자열 매칭
 * 이 코드베이스에는 Kakao AlimTalk/SMS 연동이 없음; 푸시는 OneSignal REST.
 *
 * 테스트: `?test_mode=true` 또는 JSON `{"test_mode":true}` + Secret `ONESIGNAL_TEST_PLAYER_ID`
 * (본인 기기 player id — OneSignal 대시보드). 실제 회원에게는 발송하지 않음.
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

/** KST 자정~익일 자정에 해당하는 UTC 구간 (로그·진단용; DB는 `date` 문자열만 비교) */
function kstCalendarDayUtcRange(ymd: string): { startUtcIso: string; endUtcExclusiveIso: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { startUtcIso: "invalid-ymd", endUtcExclusiveIso: "invalid-ymd" };
  }
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtcIso: start.toISOString(), endUtcExclusiveIso: end.toISOString() };
}

function parseTimeToMinutes(raw: string): number | null {
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

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

function truthyTestMode(v: unknown): boolean {
  if (v === true) return true;
  const s = String(v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

async function resolveTestMode(req: Request, url: URL): Promise<{ test_mode: boolean; json_note: Record<string, unknown> }> {
  let test_mode = truthyTestMode(url.searchParams.get("test_mode"));
  const json_note: Record<string, unknown> = {};
  const method = req.method?.toUpperCase();
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try {
        const b = (await req.json()) as Record<string, unknown>;
        Object.assign(json_note, b);
        if (truthyTestMode(b?.test_mode)) test_mode = true;
      } catch {
        /* empty body */
      }
    }
  }
  return { test_mode, json_note };
}

async function postOneSignal(
  restKey: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown>; raw_text: string }> {
  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${restKey}`,
    },
    body: JSON.stringify(payload),
  });
  const raw_text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw_text ? (JSON.parse(raw_text) as Record<string, unknown>) : {};
  } catch {
    body = { _parse_error: raw_text.slice(0, 500) };
  }
  console.log(
    `[daily-class-reminder][onesignal][${label}] http_status=${res.status} response=${JSON.stringify(body)}`,
  );
  const errObj = body.errors ?? body.invalid_aliases ?? body.invalid_player_ids;
  const ok = res.ok && !errObj;
  if (!res.ok || errObj) {
    console.error(
      `[daily-class-reminder][onesignal][${label}] provider_error http=${res.status} raw=${raw_text.slice(0, 3000)}`,
    );
  }
  return { ok, status: res.status, body, raw_text };
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

  const { test_mode, json_note } = await resolveTestMode(req, url);

  const appId = (Deno.env.get("ONESIGNAL_APP_ID") || "").replace(/["']/g, "").trim();
  const restKey = (Deno.env.get("ONESIGNAL_REST_API_KEY") || "").replace(/["']/g, "").trim();
  const testPlayerId = (Deno.env.get("ONESIGNAL_TEST_PLAYER_ID") || "").trim();
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

  if (test_mode && !testPlayerId) {
    console.error(
      "[daily-class-reminder] test_mode=true but ONESIGNAL_TEST_PLAYER_ID missing — refusing to fallback to real users",
    );
    return new Response(
      JSON.stringify({
        error: "test_mode requested but secret ONESIGNAL_TEST_PLAYER_ID is not set (your device OneSignal player id)",
        hint: "Set ONESIGNAL_TEST_PLAYER_ID via `supabase secrets set` — this project uses OneSignal push, not SMS.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const todayKST = getTodayKST();
  const { startUtcIso, endUtcExclusiveIso } = kstCalendarDayUtcRange(todayKST);

  console.log(
    `[daily-class-reminder][query-audit] timezone=Asia/Seoul calendar_date_used="${todayKST}" ` +
      `postgres_filter.bookings.date.eq="${todayKST}" status.neq cancelled | ` +
      `logical_KST_day_utc_semantics=[start=${startUtcIso}, end_exclusive=${endUtcExclusiveIso}) | ` +
      `runner_now_utc="${new Date().toISOString()}"`,
  );

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
  type ResultRow = {
    booking_id: string;
    user_id: string;
    sent: boolean;
    skipped?: string;
    error?: string;
  };
  const results: ResultRow[] = [];

  /** Test mode — one summary push to ONESIGNAL_TEST_PLAYER_ID only */
  if (test_mode) {
    const sampleTimes = [...earliestByUser.values()]
      .map((r) => formatClassTimeHHmm(String(r.time ?? "")))
      .slice(0, 12);
    const summary =
      `[테스트][${slot}] KST 날짜 ${todayKST} · 해당 슬롯 예약 건수 ${filtered.length} · 회원별 최초 ${earliestByUser.size}건 · 샘플 시각 ${sampleTimes.join(", ") || "(없음)"}`;
    console.log("[daily-class-reminder][test_mode] sending only to ONESIGNAL_TEST_PLAYER_ID:", testPlayerId);

    const { ok, status, body } = await postOneSignal(restKey, {
      app_id: appId,
      include_player_ids: [testPlayerId],
      headings: { en: title + " (테스트)" },
      contents: { en: summary },
      data: {
        labdot_audience: "member",
        labdot_event: "daily_class_reminder_test",
        slot,
        test_mode: true,
      },
    }, `test_${slot}`);
    results.push({
      booking_id: "test_mode",
      user_id: "test_mode",
      sent: ok,
      error: ok ? undefined : JSON.stringify(body),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        function: "daily-class-reminder",
        test_mode: true,
        test_player_id_hint: "***",
        one_signal_http: status,
        slot,
        date_kst: todayKST,
        kst_day_utc_start: startUtcIso,
        kst_day_utc_end_exclusive: endUtcExclusiveIso,
        bookings_in_slot: filtered.length,
        members_would_receive: earliestByUser.size,
        results,
        body_echo: json_note,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  /** Production — per member */
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

    const { ok, body } = await postOneSignal(
      restKey,
      {
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
      },
      `member_${row.id}`,
    );

    if (!ok) {
      results.push({
        booking_id: row.id,
        user_id: row.user_id,
        sent: false,
        error: JSON.stringify(body),
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
      kst_day_utc_start: startUtcIso,
      kst_day_utc_end_exclusive: endUtcExclusiveIso,
      bookings_in_slot: filtered.length,
      members_targeted: earliestByUser.size,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
