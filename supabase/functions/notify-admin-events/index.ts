/**
 * Admin-bound: DB webhook (신규 가입) 또는 클라이언트가 `targetId`로 관리자에게 직접 푸시 (예: 수업 예약 알림).
 * 회원 대상 푸시는 `notify-member-events` 사용.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = (await req.json()) as Record<string, unknown>;
    const row =
      raw?.record && typeof raw.record === "object" && raw.record !== null
        ? (raw.record as Record<string, unknown>)
        : raw;

    const isDatabaseWebhook =
      row?.trigger_source === "database_webhook" ||
      raw?.trigger_source === "database_webhook";

    const directTargetId = typeof raw.targetId === "string" ? raw.targetId : undefined;
    const directTitle = typeof raw.title === "string" ? raw.title : "";
    const directMessage = typeof raw.message === "string" ? raw.message : "";

    let titleText: string;
    let messageText: string;
    let finalTargetId: string | undefined;

    if (isDatabaseWebhook) {
      const name = String(row?.new_member_name ?? raw?.new_member_name ?? "").trim() || "신규";
      titleText = "신규 회원 가입";
      messageText = `${name} 회원님이 가입하셨습니다.`;
      finalTargetId = undefined;
    } else if (directTargetId && directTitle && directMessage) {
      titleText = directTitle;
      messageText = directMessage;
      finalTargetId = directTargetId;
    } else {
      throw new Error(
        "database_webhook 페이로드이거나 (targetId + title + message) 조합이 필요합니다."
      );
    }

    if (!finalTargetId) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: adminData, error: adminError } = await supabaseAdmin
        .from("profiles")
        .select("onesignal_id, name")
        .eq("role", "admin")
        .not("onesignal_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (adminError || !adminData?.onesignal_id) {
        throw new Error(
          `관리자 OneSignal ID 추출 실패: ${JSON.stringify(adminError)}`
        );
      }
      finalTargetId = String(adminData.onesignal_id);
    }

    const APP_ID = (Deno.env.get("ONESIGNAL_APP_ID") || "").replace(/["']/g, "").trim();
    const REST_KEY = (Deno.env.get("ONESIGNAL_REST_API_KEY") || "").replace(/["']/g, "").trim();

    const payload = {
      app_id: APP_ID,
      include_player_ids: [finalTargetId],
      headings: { en: titleText },
      contents: { en: messageText },
      data: { labdot_audience: "admin", labdot_event: isDatabaseWebhook ? "signup" : "admin_direct" },
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${REST_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
      throw new Error(`OneSignal 거절: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[notify-admin-events]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
