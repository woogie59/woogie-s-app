import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Hardcoded V2 API Key and App ID
    const ONESIGNAL_API_KEY =
      "os_v2_app_7vsxhzq33bb27gbyhnmc62binkr6s52sbk2ewleerfu5r5ljdki6fetuejrgnni3iscroha7omz6hd23wrdhqllmzmompdmmkkvflpq";
    const ONESIGNAL_APP_ID = "fd6573e6-1bd8-43af-9838-3b582f68286a";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { message, heading } = await req.json();

    // 1. Find Admin User
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("onesignal_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (!adminProfile?.onesignal_id) {
      console.error("Admin ID Not Found");
      throw new Error("관리자 ID를 찾을 수 없습니다.");
    }

    console.log(`Sending alert to Admin ID: ${adminProfile.onesignal_id}`);

    // 2. Send Notification via OneSignal
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // FIXED: Using 'Key' instead of 'Basic' for V2 keys
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: [adminProfile.onesignal_id],
        headings: { en: heading || "📢 알림" },
        contents: { en: message },
      }),
    });

    const data = await res.json();
    console.log("OneSignal Response:", data);

    if (data.errors) {
      throw new Error(JSON.stringify(data.errors));
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Final Error:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
