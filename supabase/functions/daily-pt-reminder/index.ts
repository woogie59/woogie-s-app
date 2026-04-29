// =============================================================================
// daily-pt-reminder Edge Function
// =============================================================================
// Sends push notifications to members with today's PT bookings (KST),
// then sends an admin report summary.
//
// Schedule via Supabase Cron (e.g. 08:00 KST daily) or external cron.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";
const APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "fd6573e6-1bd8-43af-9838-3b582f68286a";
const REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

// --- Helper: Get today's date in KST (Asia/Seoul)
function getTodayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
}

// --- Helper: Send OneSignal push notification
async function sendOneSignalPush(
  playerIds: string[],
  heading: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  if (!REST_API_KEY) {
    return { success: false, error: "ONESIGNAL_REST_API_KEY not set" };
  }
  if (playerIds.length === 0) {
    return { success: true };
  }

  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: APP_ID,
      include_player_ids: playerIds,
      headings: { en: heading },
      contents: { en: body },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      error: data.errors?.[0] ?? data.message ?? `HTTP ${res.status}`,
    };
  }
  return { success: true };
}

// --- Main handler
Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const todayKST = getTodayKST();

    // 1. Fetch today's bookings
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
      if (adminOsId) {
        await sendOneSignalPush(
          [adminOsId],
          "알림 발송 보고",
          "🔔 [알림 발송 보고] 오늘 총 0명 중 0명에게 알림을 보냈습니다. (실패: 0건)",
        );
      }
      return new Response(
        JSON.stringify({ ok: true, date_kst: todayKST, total: 0, success_count: 0, failure_count: 0, admin_report_sent: !!adminOsId }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Fetch profiles (onesignal_id, name) for booking members
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

      const result = await sendOneSignalPush(
        [osId],
        "PT 알림",
        `오늘 ${time} PT 수업이 있습니다!`,
      );

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        console.warn(`[daily-pt-reminder] Failed to notify ${memberName}:`, result.error);
      }
    }

    // 4. Admin Reporting: Fetch admin's onesignal_id
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
      const reportResult = await sendOneSignalPush(
        [adminOsId],
        "알림 발송 보고",
        reportMessage,
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
