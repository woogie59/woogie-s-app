// =============================================================================
// send-admin-alert Edge Function
// =============================================================================
// Sends a OneSignal push notification to the admin when triggered (e.g.
// Retention Golden Time: member has 6 sessions remaining).
// Called from client via supabase.functions.invoke('send-admin-alert', { body: {...} })
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appId = Deno.env.get("ONESIGNAL_APP_ID");
    const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env vars" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!appId || !restApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OneSignal env vars (ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { heading, message } = (await req.json()) as { heading?: string; message?: string };
    if (!heading || !message) {
      return new Response(
        JSON.stringify({ error: "Missing heading or message in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch admin's OneSignal ID from profiles (role = 'admin')
    const { data: adminProfile, error: adminError } = await supabase
      .from("profiles")
      .select("onesignal_id")
      .eq("role", "admin")
      .not("onesignal_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (adminError) {
      console.error("[send-admin-alert] Admin fetch error:", adminError);
      return new Response(
        JSON.stringify({ error: adminError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminOsId = (adminProfile as { onesignal_id: string } | null)?.onesignal_id;
    if (!adminOsId) {
      return new Response(
        JSON.stringify({ error: "No admin with onesignal_id found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send OneSignal notification
    const oneSignalRes = await fetch(ONESIGNAL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: [adminOsId],
        headings: { en: heading },
        contents: { en: message },
      }),
    });

    const oneSignalData = await oneSignalRes.json().catch(() => ({}));

    if (!oneSignalRes.ok) {
      console.error("[send-admin-alert] OneSignal error:", oneSignalData);
      return new Response(
        JSON.stringify({
          error: oneSignalData.errors?.[0] ?? oneSignalData.message ?? `OneSignal HTTP ${oneSignalRes.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, notification_id: oneSignalData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-admin-alert] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
