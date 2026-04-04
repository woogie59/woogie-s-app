/**
 * LAB DOT — Authenticated clients notify admin via OneSignal (new member / new booking).
 * Requires valid Supabase JWT. Uses service role only to resolve admin player id.
 */
import { createClient } from "@supabase/supabase-js";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload =
  | { type: "new_member"; name: string }
  | { type: "new_booking"; memberName: string; date: string; time: string };

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

    const { data: adminProfile } = await admin
      .from("profiles")
      .select("onesignal_id")
      .eq("role", "admin")
      .not("onesignal_id", "is", null)
      .limit(1)
      .maybeSingle();

    const playerId = adminProfile?.onesignal_id as string | undefined;
    if (!playerId) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_admin_player" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let headings: Record<string, string>;
    let contents: Record<string, string>;
    let data: Record<string, string> | undefined;

    if (body.type === "new_member") {
      const name = String(body.name ?? "").trim() || "회원";
      headings = { ko: "새 회원", en: "New member" };
      contents = { ko: `${name}님이 새로 참여하였습니다.`, en: `${name}님이 새로 참여하였습니다.` };
    } else if (body.type === "new_booking") {
      const memberName = String(body.memberName ?? "").trim() || "회원";
      const date = String(body.date ?? "").slice(0, 10);
      const time = String(body.time ?? "").trim();
      headings = { ko: "새 예약", en: "New booking" };
      contents = {
        ko: `${memberName}님 - ${date} ${time}`,
        en: `${memberName}님 - ${date} ${time}`,
      };
      data = {
        labdot_action: "admin_schedule",
        booking_date: date,
      };
    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {
      app_id: appId,
      include_player_ids: [playerId],
      headings,
      contents,
      target_channel: "push",
    };
    if (data) payload.data = data;

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
      console.warn("[notify-admin-events] OneSignal:", json);
      return new Response(
        JSON.stringify({ error: json.errors?.[0] ?? json.message ?? `HTTP ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, id: json.id }), {
      status: 200,
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
