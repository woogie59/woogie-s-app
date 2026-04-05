import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // 치명적 오류 방지: 입력된 키값에 실수로 섞여 들어간 따옴표(" ') 강제 제거
    const APP_ID = (Deno.env.get('ONESIGNAL_APP_ID') || '').replace(/["']/g, "").trim();
    const REST_KEY = (Deno.env.get('ONESIGNAL_REST_API_KEY') || '').replace(/["']/g, "").trim();

    // 최신 OneSignal 규격에 맞춘 하이브리드 발사 명령
    const payload = {
      app_id: APP_ID,
      include_subscription_ids: [targetId], // 신형 API 규격
      include_player_ids: [targetId],       // 구형 API 규격 (호환성)
      headings: { en: title },
      contents: { en: message },
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    // 원시그널이 뱉어낸 결과를 프론트엔드로 그대로 전송 (콘솔 확인용)
    return new Response(JSON.stringify({ status: response.status, onesignalResponse: data }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});