/**
 * Member-bound push: resolve `profiles.onesignal_id` by `user_id` (Service Role),
 * or send to explicit `targetId` (OneSignal player id).
 * Use for 출석 / 트레이닝 일지 — not for admin signup alerts.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const raw = (await req.json()) as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title : "";
    const message = typeof raw.message === "string" ? raw.message : "";
    let finalTargetId =
      typeof raw.targetId === "string" ? raw.targetId : undefined;
    const userId = typeof raw.user_id === "string" ? raw.user_id : undefined;
    const eventKind = typeof raw.event_kind === "string" ? raw.event_kind : "member";

    if (!title || !message) {
      throw new Error("title과 message가 필요합니다.");
    }

    if (!finalTargetId) {
      if (!userId) {
        throw new Error("user_id 또는 targetId가 필요합니다.");
      }
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("onesignal_id")
        .eq("id", userId)
        .maybeSingle();

      if (pErr) {
        throw new Error(`회원 조회 실패: ${JSON.stringify(pErr)}`);
      }
      if (!profile?.onesignal_id) {
        console.warn("[notify-member-events] no onesignal_id for user", userId);
        return new Response(
          JSON.stringify({ skipped: true, reason: "no_onesignal_id", event_kind: eventKind }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      finalTargetId = String(profile.onesignal_id);
    }

    const APP_ID = (Deno.env.get("ONESIGNAL_APP_ID") || "").replace(/["']/g, "").trim();
    const REST_KEY = (Deno.env.get("ONESIGNAL_REST_API_KEY") || "").replace(/["']/g, "").trim();

    const payload = {
      app_id: APP_ID,
      include_player_ids: [finalTargetId],
      headings: { en: title },
      contents: { en: message },
      data: { labdot_audience: "member", labdot_event: eventKind },
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

    return new Response(
      JSON.stringify({ success: true, audience: "member", event_kind: eventKind, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[notify-member-events]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
