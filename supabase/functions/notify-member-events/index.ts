/**
 * Member-bound push: OneSignal `external_id` (= Supabase user id from OneSignal.login),
 * explicit player `targetId`, or broadcast to all active members (`broadcast: "members"`).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ID_CHUNK = 200;

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

function onesignalCredentials() {
  const appId = (Deno.env.get("ONESIGNAL_APP_ID") || "").replace(/["']/g, "").trim();
  const restKey = (Deno.env.get("ONESIGNAL_REST_API_KEY") || "").replace(/["']/g, "").trim();
  return { appId, restKey };
}

async function onesignalCreate(payload: Record<string, unknown>) {
  const { appId, restKey } = onesignalCredentials();
  const body = JSON.stringify({ app_id: appId, ...payload });
  const auths = [`Key ${restKey}`, `Basic ${restKey}`];
  let last: unknown = null;
  for (const auth of auths) {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body,
    });
    const data = await response.json();
    if (response.ok && !data.errors) return data;
    last = data;
    if (response.status !== 401 && response.status !== 403) {
      throw new Error(`OneSignal 거절: ${JSON.stringify(data)}`);
    }
  }
  throw new Error(`OneSignal 거절: ${JSON.stringify(last)}`);
}

async function sendToPlayerIds(
  playerIds: string[],
  title: string,
  message: string,
  extraData: Record<string, string>
) {
  return onesignalCreate({
    include_player_ids: playerIds,
    headings: { en: title, ko: title },
    contents: { en: message, ko: message },
    data: extraData,
    target_channel: "push",
  });
}

async function sendToExternalUserIds(
  externalUserIds: string[],
  title: string,
  message: string,
  extraData: Record<string, string>
) {
  return onesignalCreate({
    include_external_user_ids: externalUserIds,
    headings: { en: title, ko: title },
    contents: { en: message, ko: message },
    data: extraData,
    target_channel: "push",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const raw = (await req.json()) as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title : "";
    const message = typeof raw.message === "string" ? raw.message : "";
    const finalTargetId =
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
        .select("id, onesignal_id")
        .eq("status", "active");

      if (listErr) {
        throw new Error(`회원 목록 조회 실패: ${JSON.stringify(listErr)}`);
      }

      const externalUserIds = [
        ...new Set(
          (rows || [])
            .map((r) => String(r?.id || "").trim())
            .filter((id) => id.length > 0)
        ),
      ];
      const playerIds = [
        ...new Set(
          (rows || [])
            .map((r) => String(r?.onesignal_id || "").trim())
            .filter((id) => id.length > 0)
        ),
      ];

      if (externalUserIds.length === 0 && playerIds.length === 0) {
        return new Response(
          JSON.stringify({
            skipped: true,
            reason: "no_active_members",
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
            sent: Math.max(externalUserIds.length, playerIds.length),
            external_targets: externalUserIds.length,
            player_targets: playerIds.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      for (let i = 0; i < playerIds.length; i += ID_CHUNK) {
        results.push(await sendToPlayerIds(playerIds.slice(i, i + ID_CHUNK), title, message, extraData));
      }
      for (let i = 0; i < externalUserIds.length; i += ID_CHUNK) {
        results.push(
          await sendToExternalUserIds(externalUserIds.slice(i, i + ID_CHUNK), title, message, extraData)
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          audience: "all_members",
          event_kind: eventKind,
          sent: Math.max(externalUserIds.length, playerIds.length),
          external_targets: externalUserIds.length,
          player_targets: playerIds.length,
          data: results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (finalTargetId) {
      const data = await sendToPlayerIds([finalTargetId], title, message, extraData);
      return new Response(
        JSON.stringify({ success: true, audience: "member", event_kind: eventKind, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      throw new Error("user_id 또는 targetId가 필요합니다.");
    }

    const data = await sendToExternalUserIds([userId], title, message, extraData);

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
