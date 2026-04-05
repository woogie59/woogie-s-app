import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { targetId, title, message } = await req.json();
    let finalTargetId = targetId;

    if (!finalTargetId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('profiles')
        .select('onesignal_id')
        .eq('role', 'admin')
        .single();

      if (adminError || !adminData?.onesignal_id) {
        throw new Error(`관리자 OneSignal ID 추출 실패: ${JSON.stringify(adminError)}`);
      }
      finalTargetId = adminData.onesignal_id;
    }

    const APP_ID = (Deno.env.get('ONESIGNAL_APP_ID') || '').replace(/["']/g, "").trim();
    const REST_KEY = (Deno.env.get('ONESIGNAL_REST_API_KEY') || '').replace(/["']/g, "").trim();

    const payload = {
      app_id: APP_ID,
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
    
    // 원시그널이 에러를 뱉었을 경우, 강제로 에러를 발생시켜 Supabase 로그에 빨간 줄을 긋게 만듭니다.
    if (!response.ok || data.errors) {
      throw new Error(`OneSignal API 거절됨: ${JSON.stringify(data)} / TargetID: ${finalTargetId}`);
    }

    return new Response(JSON.stringify({ status: response.status, data }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("🚨 엣지 펑션 치명적 에러:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});