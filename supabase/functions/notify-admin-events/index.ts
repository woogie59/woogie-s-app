/**
 * LAB DOT — Push via OneSignal using the SAME pipeline as send-class-reminders /
 * send-session-reminder: `include_external_user_ids` = Supabase auth user UUIDs
 * (matches OneSignal.login(user.id) in the client).
 *
 * Do NOT use include_player_ids / profiles.onesignal_id here — that path is inconsistent
 * with the working reminder pipeline.
 */
import { createClient } from "@supabase/supabase-js";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload =
  | { type: "new_member"; name: string }
  | { type: "new_booking"; memberName: string; date: string; time: string }
  | { type: "training_report_saved"; memberUserId: string; sessionFocus?: string; reportDate?: string };

async function sendOneSignalExternalIds(params: {
  appId: string;
  restKey: string;
  externalUserIds: string[];
  headings: Record<string, string>;
  contents: Record<string, string>;
  data?: Record<string, string>;
}): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  const { appId, restKey, externalUserIds, headings, contents, data } = params;
  if (externalUserIds.length === 0) {
    return { ok: false, error: "no_external_ids" };
  }

  const payload: Record<string, unknown> = {
    app_id: appId,
    include_external_user_ids: externalUserIds,
    headings,
    contents,
    target_channel: "push",
  };
  if (data && Object.keys(data).length > 0) payload.data = data;

  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${restKey}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json.errors?.[0] ?? json.message ?? `HTTP ${res.status}`, raw: json };
  }
  return { ok: true, raw: json };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const appId = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
    const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey || !appId || !restKey) {
      console.error("[notify-admin-events] Missing env");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: adminRow } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    const adminExternalId = adminRow?.id as string | undefined;

    if (body.type === "training_report_saved") {
      const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (caller?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const memberId = String(body.memberUserId ?? "").trim();
      if (!memberId) {
        return new Response(JSON.stringify({ error: "Invalid memberUserId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const focus = String(body.sessionFocus ?? "").trim() || "오늘 세션";
      const rd = String(body.reportDate ?? "").slice(0, 10);
      const title = "트레이닝 일지";
      const line = rd ? `${focus} · ${rd} 일지가 등록되었습니다.` : `${focus} 일지가 등록되었습니다.`;
      const result = await sendOneSignalExternalIds({
        appId,
        restKey,
        externalUserIds: [memberId],
        headings: { ko: title, en: title },
        contents: { ko: line, en: line },
      });
      if (!result.ok) {
        console.warn("[notify-admin-events] training_report_saved:", result.error, result.raw);
        return new Response(JSON.stringify({ error: result.error, raw: result.raw }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!adminExternalId) {
      console.warn("[notify-admin-events] No admin profile id");
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_admin_user" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.type === "new_member") {
      const name = String(body.name ?? "").trim() || "회원";
      const result = await sendOneSignalExternalIds({
        appId,
        restKey,
        externalUserIds: [adminExternalId],
        headings: { ko: "새 회원", en: "New member" },
        contents: { ko: `${name}님이 새로 참여하였습니다.`, en: `${name}님이 새로 참여하였습니다.` },
      });
      if (!result.ok) {
        console.warn("[notify-admin-events] new_member:", result.error, result.raw);
        return new Response(JSON.stringify({ error: result.error, raw: result.raw }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.type === "new_booking") {
      const memberName = String(body.memberName ?? "").trim() || "회원";
      const date = String(body.date ?? "").slice(0, 10);
      const time = String(body.time ?? "").trim();
      const result = await sendOneSignalExternalIds({
        appId,
        restKey,
        externalUserIds: [adminExternalId],
        headings: { ko: "새 예약", en: "New booking" },
        contents: {
          ko: `${memberName}님 - ${date} ${time}`,
          en: `${memberName}님 - ${date} ${time}`,
        },
        data: {
          labdot_action: "admin_schedule",
          booking_date: date,
        },
      });
      if (!result.ok) {
        console.warn("[notify-admin-events] new_booking:", result.error, result.raw);
        return new Response(JSON.stringify({ error: result.error, raw: result.raw }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-admin-events]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
