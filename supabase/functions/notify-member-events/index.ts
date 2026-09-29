/**
 * Member-bound push: resolve `profiles.onesignal_id` by `user_id` (Service Role),
 * send to explicit `targetId`, or broadcast to all active members (`broadcast: "members"`).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAYER_ID_CHUNK = 200;

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

async function requireAdmin(req: Request, supabaseAdmin: SupabaseClient) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Error("인증이 필요합니다.");
  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
  if (authErr || !authData?.user?.id) throw new Error("인증이 필요합니다.");
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (pErr) throw new Error(`권한 확인 실패: ${JSON.stringify(pErr)}`);
  if (profile?.role !== "admin") throw new Error("관리자 권한이 필요합니다.");
}

async function sendOneSignal(
  playerIds: string[],
  title: string,
  message: string,
  extraData: Record<string, string>
) {
  const APP_ID = (Deno.env.get("ONESIGNAL_APP_ID") || "").replace(/["']/g, "").trim();
  const REST_KEY = (Deno.env.get("ONESIGNAL_REST_API_KEY") || "").replace(/["']/g, "").trim();
  const payload = {
    app_id: APP_ID,
    include_player_ids: playerIds,
    headings: { en: title, ko: title },
    contents: { en: message, ko: message },
    data: extraData,
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
  return data;
}

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
    const broadcast = raw.broadcast === "members" || raw.audience === "all_members";
    const dryRun = raw.dry_run === true || raw.dryRun === true;

    if (!title || !message) {
      throw new Error("title과 message가 필요합니다.");
    }

    const extraData: Record<string, string> = {
      labdot_audience: "member",
      labdot_event: eventKind,
    };
    if (eventKind === "member_announcement") {
      extraData.labdot_action = "member_announcement";
    }

    if (broadcast) {
      const supabaseAdmin = adminClient();
      await requireAdmin(req, supabaseAdmin);
      const { data: rows, error: listErr } = await supabaseAdmin
        .from("profiles")
        .select("onesignal_id")
        .neq("role", "admin")
        .eq("status", "active")
        .not("onesignal_id", "is", null);

      if (listErr) {
        throw new Error(`회원 목록 조회 실패: ${JSON.stringify(listErr)}`);
      }

      const playerIds = [
        ...new Set(
          (rows || [])
            .map((r) => String(r?.onesignal_id || "").trim())
            .filter((id) => id.length > 0)
        ),
      ];

      if (playerIds.length === 0) {
        return new Response(
          JSON.stringify({
            skipped: true,
            reason: "no_member_player_ids",
            event_kind: eventKind,
            sent: 0,
            dry_run: dryRun,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (dryRun) {
        return new Response(
          JSON.stringify({
            dry_run: true,
            success: true,
            audience: "all_members",
            event_kind: eventKind,
            sent: playerIds.length,
            chunks: Math.ceil(playerIds.length / PLAYER_ID_CHUNK),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      for (let i = 0; i < playerIds.length; i += PLAYER_ID_CHUNK) {
        const chunk = playerIds.slice(i, i + PLAYER_ID_CHUNK);
        results.push(await sendOneSignal(chunk, title, message, extraData));
      }

      return new Response(
        JSON.stringify({
          success: true,
          audience: "all_members",
          event_kind: eventKind,
          sent: playerIds.length,
          data: results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!finalTargetId) {
      if (!userId) {
        throw new Error("user_id 또는 targetId가 필요합니다.");
      }
      const supabaseAdmin = adminClient();
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

    const data = await sendOneSignal([finalTargetId], title, message, extraData);

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
