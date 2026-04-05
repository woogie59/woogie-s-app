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
    const raw = (await req.json()) as Record<string, unknown>;
    const row = raw?.record && typeof raw.record === 'object' && raw.record !== null
      ? (raw.record as Record<string, unknown>)
      : raw;

    const isDatabaseWebhook =
      row?.trigger_source === 'database_webhook' ||
      raw?.trigger_source === 'database_webhook';

    let title: string;
    let message: string;
    let finalTargetId: string | undefined =
      typeof raw.targetId === 'string' ? raw.targetId : undefined;

    if (isDatabaseWebhook) {
      const name = String(row?.new_member_name ?? raw?.new_member_name ?? '').trim() || '신규';
      title = '신규 회원 가입';
      message = `${name} 회원님이 가입하셨습니다.`;
      finalTargetId = undefined;
    } else {
      title = typeof raw.title === 'string' ? raw.title : '';
      message = typeof raw.message === 'string' ? raw.message : '';
      if (!title || !message) {
        throw new Error('title과 message가 필요합니다 (또는 trigger_source: database_webhook 페이로드).');
      }
    }

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

    if (!response.ok || data.errors) {
      throw new Error(`OneSignal API 거절됨: ${JSON.stringify(data)} / TargetID: ${finalTargetId}`);
    }

    return new Response(JSON.stringify({ status: response.status, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("🚨 엣지 펑션 치명적 에러:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
