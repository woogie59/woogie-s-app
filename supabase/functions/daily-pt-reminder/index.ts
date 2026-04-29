/**
 * daily-pt-reminder — 오늘( KST ) PT 예약이 있는 회원에게 OneSignal 푸시 + 관리자 요약
 *
 * - `bookings.date` 문자열과 `Intl`로 구한 한국 오늘 `YYYY-MM-DD`를 매칭 (타임존 명시 적용 아래 참고).
 * - 이 레포에는 Kakao AlimTalk/SMS 게이트웨이가 없음; 응답 로그는 OneSignal REST 기준입니다.
 *
 * 테스트: 바디 또는 쿼리 `test_mode: true` + Secret `ONESIGNAL_TEST_PLAYER_ID` (본인 플레이어 id)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

function getAppIdNormalized(): string {
  return (Deno.env.get("ONESIGNAL_APP_ID") ?? "").replace(/["']/g, "").trim();
}

/** KST 오늘 YYYY-MM-DD */
function getTodayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function kstCalendarDayUtcRange(ymd: string): { startUtcIso: string; endUtcExclusiveIso: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { startUtcIso: "invalid-ymd", endUtcExclusiveIso: "invalid-ymd" };
  }
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtcIso: start.toISOString(), endUtcExclusiveIso: end.toISOString() };
}

function truthyTestMode(v: unknown): boolean {
  if (v === true) return true;
  const s = String(v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

async function resolveTestMode(req: Request, url: URL): Promise<{ test_mode: boolean }> {
  let test_mode = truthyTestMode(url.searchParams.get("test_mode"));
  const method = req.method?.toUpperCase();
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try {
        const b = (await req.json()) as Record<string, unknown>;
        if (truthyTestMode(b?.test_mode)) test_mode = true;
      } catch {
        /* ignore */
      }
    }
  }
  return { test_mode };
}

async function postOneSignal(
  restKey: string,
  appId: string,
  playerIds: string[],
  heading: string,
  body: string,
  label: string,
): Promise<{ success: boolean; error?: string; http_status: number; response_body?: unknown }> {
  if (!restKey || !restKey.trim()) {
    return { success: false, error: "ONESIGNAL_REST_API_KEY not set", http_status: 0 };
  }
  if (playerIds.length === 0) {
    return { success: true, http_status: 0 };
  }

  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${restKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_player_ids: playerIds,
      headings: { en: heading },
      contents: { en: body },
    }),
  });
  const raw_text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw_text ? (JSON.parse(raw_text) as Record<string, unknown>) : {};
  } catch {
    data = { _parse_error: raw_text.slice(0, 400) };
  }
  console.log(
    `[daily-pt-reminder][onesignal][${label}] http_status=${res.status} response=${JSON.stringify(data)}`,
  );
  const errObj = data.errors ?? data.invalid_aliases ?? data.invalid_player_ids;
  if (!res.ok || errObj) {
    const errSummary = data.errors ?? data.message ?? raw_text.slice(0, 500);
    console.error(
      `[daily-pt-reminder][onesignal][${label}] provider_error http=${res.status} summary=${JSON.stringify(errSummary)}`,
    );
    return {
      success: false,
      error: typeof errSummary === "string" ? errSummary : JSON.stringify(errSummary),
      http_status: res.status,
      response_body: data,
    };
  }
  return { success: true, http_status: res.status, response_body: data };
}

// --- Main handler
Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const REST_API_KEY = (Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "").trim();
    const resolvedAppId = getAppIdNormalized();

    const url = new URL(req.url);
    const { test_mode } = await resolveTestMode(req, url);

    const testPlayerId = (Deno.env.get("ONESIGNAL_TEST_PLAYER_ID") || "").trim();

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!resolvedAppId || !REST_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (test_mode && !testPlayerId) {
      console.error("[daily-pt-reminder] test_mode=true but ONESIGNAL_TEST_PLAYER_ID unset");
      return new Response(
        JSON.stringify({
          error: "test_mode requested but secret ONESIGNAL_TEST_PLAYER_ID is not set",
          hint: "Set device player id via `supabase secrets set ONESIGNAL_TEST_PLAYER_ID=...` — no SMS path in this project.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const todayKST = getTodayKST();
    const { startUtcIso, endUtcExclusiveIso } = kstCalendarDayUtcRange(todayKST);
    console.log(
      `[daily-pt-reminder][query-audit] postgres_filter.bookings.date.eq="${todayKST}" ` +
        `status.neq cancelled | KST_logical_day_utc=[start=${startUtcIso}, end_exclusive=${endUtcExclusiveIso}) ` +
        `runner_now_utc="${new Date().toISOString()}"`,
    );

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, user_id, time")
      .eq("date", todayKST)
      .neq("status", "cancelled");

    if (bookingsError) {
      console.error("[daily-pt-reminder] Bookings fetch error:", bookingsError);
      return new Response(
        JSON.stringify({ error: bookingsError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const rawBookings = (bookings ?? []) as Array<{ id: string; user_id: string; time: string }>;
    const userIds = [...new Set(rawBookings.map((b) => b.user_id))];

    if (userIds.length === 0) {
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("onesignal_id")
        .or("role.eq.admin,email.eq.admin@gmail.com")
        .not("onesignal_id", "is", null)
        .limit(1)
        .maybeSingle();
      const adminOsId = (adminProfile as { onesignal_id: string } | null)?.onesignal_id;
      if (test_mode) {
        const r = await postOneSignal(
          REST_API_KEY,
          resolvedAppId,
          [testPlayerId],
          "daily-pt-reminder (테스트)",
          `[테스트] KST 날짜 ${todayKST} · 해당일 예약 0건 (정상 진단 확인).`,
          "zero_bookings_test",
        );
        return new Response(
          JSON.stringify({
            ok: true,
            test_mode: true,
            date_kst: todayKST,
            kst_day_utc_start: startUtcIso,
            kst_day_utc_end_exclusive: endUtcExclusiveIso,
            total: 0,
            diagnostics_push: r,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (adminOsId && !test_mode) {
        await postOneSignal(
          REST_API_KEY,
          resolvedAppId,
          [adminOsId],
          "알림 발송 보고",
          "🔔 [알림 발송 보고] 오늘 총 0명 중 0명에게 알림을 보냈습니다. (실패: 0건)",
          "admin_report_zero",
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          date_kst: todayKST,
          kst_day_utc_start: startUtcIso,
          kst_day_utc_end_exclusive: endUtcExclusiveIso,
          total: 0,
          success_count: 0,
          failure_count: 0,
          admin_report_sent: !!adminOsId,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, onesignal_id")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; name: string; onesignal_id: string | null }) => [p.id, p]),
    );

    const items = rawBookings.map((b) => ({
      ...b,
      profile: profileMap.get(b.user_id) ?? { name: "회원", onesignal_id: null },
    }));

    const total = items.length;
    let successCount = 0;
    let failureCount = 0;

    if (test_mode) {
      const sample = rawBookings
        .map((x) => x.time || "?")
        .slice(0, 20)
        .join(", ");
      const msg =
        `[테스트] 오늘(KST)=${todayKST} 예약 ${total}건 · user별 푸시는 생략 · 샘플 time: ${sample}`;
      const tr = await postOneSignal(
        REST_API_KEY,
        resolvedAppId,
        [testPlayerId],
        "daily-pt-reminder (테스트)",
        msg.substring(0, 1800),
        "aggregate_test_only",
      );
      return new Response(
        JSON.stringify({
          ok: true,
          test_mode: true,
          date_kst: todayKST,
          kst_day_utc_start: startUtcIso,
          kst_day_utc_end_exclusive: endUtcExclusiveIso,
          total_bookings: total,
          unique_users: userIds.length,
          skipped_real_broadcast: true,
          diagnostics_push: tr,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. Send member notifications
    for (const item of items) {
      const osId = item.profile?.onesignal_id;
      const time = item.time || "예정";
      const memberName = item.profile?.name ?? "회원";

      if (!osId) {
        failureCount++;
        console.warn(`[daily-pt-reminder] No onesignal_id for user ${item.user_id} (${memberName})`);
        continue;
      }

      const result = await postOneSignal(
        REST_API_KEY,
        resolvedAppId,
        [osId],
        "PT 알림",
        `오늘 ${time} PT 수업이 있습니다!`,
        `member_${item.user_id}_${item.id}`,
      );

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        console.warn(`[daily-pt-reminder] Failed to notify ${memberName}:`, result.error);
      }
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("onesignal_id")
      .or("role.eq.admin,email.eq.admin@gmail.com")
      .not("onesignal_id", "is", null)
      .limit(1)
      .maybeSingle();

    const adminOsId = (adminProfile as { onesignal_id: string } | null)?.onesignal_id;

    if (adminOsId) {
      const reportMessage = `🔔 [알림 발송 보고] 오늘 총 ${total}명 중 ${successCount}명에게 알림을 보냈습니다. (실패: ${failureCount}건)`;
      const reportResult = await postOneSignal(
        REST_API_KEY,
        resolvedAppId,
        [adminOsId],
        "알림 발송 보고",
        reportMessage,
        "admin_report",
      );
      if (!reportResult.success) {
        console.warn("[daily-pt-reminder] Failed to send admin report:", reportResult.error);
      }
    } else {
      console.warn("[daily-pt-reminder] No admin onesignal_id found. Report not sent.");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date_kst: todayKST,
        kst_day_utc_start: startUtcIso,
        kst_day_utc_end_exclusive: endUtcExclusiveIso,
        total,
        success_count: successCount,
        failure_count: failureCount,
        admin_report_sent: !!adminOsId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[daily-pt-reminder] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
