import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { targetId, title, message } = await req.json();
    let finalTargetId = targetId;

    // 프론트엔드에서 ID를 못 찾고 빈 값(null/undefined)을 보냈을 경우, 서버가 직접 마스터키로 DB를 뒤집니다.
    if (!finalTargetId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // RLS 보안을 무시하는 절대 권한
      );

      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('profiles')
        .select('onesignal_id')
        .eq('role', 'admin')
        .single();

      if (adminError || !adminData?.onesignal_id) {
        throw new Error("서버 마스터키로도 관리자 OneSignal ID를 찾지 못했습니다.");
      }
      finalTargetId = adminData.onesignal_id;
    }

    const APP_ID = (Deno.env.get('ONESIGNAL_APP_ID') || '').replace(/["']/g, "").trim();
    const REST_KEY = (Deno.env.get('ONESIGNAL_REST_API_KEY') || '').replace(/["']/g, "").trim();

    const payload = {
      app_id: APP_ID,
      include_subscription_ids: [finalTargetId],
      include_player_ids: [finalTargetId],
      headings: { en: title },
      contents: { en: message },
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${REST_KEY}` },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return new Response(JSON.stringify({ status: response.status, target: finalTargetId, onesignalResponse: data }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});