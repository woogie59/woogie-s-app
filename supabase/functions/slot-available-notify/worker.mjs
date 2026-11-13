// Dependency-injected for isolated tests; no caller-selected audience, message, or URL.
export function createHandler({ db, secret, appId, apiKey, fetcher = fetch, uuid = () => crypto.randomUUID() }) {
  return async (req) => {
    const response = (body, status=200) => Response.json(body, { status });
    if (req.method !== 'POST') return response({error:'method'},405);
    if (!secret || req.headers.get('x-booking-notify-secret') !== secret) return response({error:'forbidden'},403);
    if (!appId || !apiKey) return response({error:'configuration'},503);
    const { data: jobs, error } = await db.from('slot_alert_jobs').select('id').eq('state','pending').order('created_at').limit(20);
    if (error) return response({error:'queue_unavailable'},503);
    const results=[];
    // Equal eligibility for all registrants. This is notification fan-out, never an offer/priority lock.
    for (let i=0;i<(jobs||[]).length;i+=5) {
      results.push(...await Promise.all(jobs.slice(i,i+5).map(async ({id}) => {
        const claim=uuid();
        const {data: target,error:claimError}=await db.rpc('slot_alert_claim',{p_job:id,p_claim:claim});
        if (claimError) return 'claim_failed';
        if (!target) return 'skipped';
        let ok=false, messageId=null, tag='transport_unknown';
        try {
          // No member names or cancelled member identity in payload. No auto-booking call exists.
          const title='수업 예약 가능 알림';
          const message=`${target.date} ${target.time} 수업에 빈자리가 생겼습니다. 예약 화면에서 확인해 주세요. 자동 예약되지 않습니다.`;
          const res=await fetcher('https://onesignal.com/api/v1/notifications',{
            method:'POST',signal:AbortSignal.timeout(15000),
            headers:{'Content-Type':'application/json',Authorization:`Key ${apiKey}`},
            body:JSON.stringify({app_id:appId,include_aliases:{external_id:[target.user_id]},target_channel:'push',
              headings:{en:title,ko:title},contents:{en:message,ko:message},
              data:{labdot_audience:'member',labdot_action:'slot_available',booking_date:target.date,booking_time:target.time},
              idempotency_key:id}),
          });
          const body=await res.json();
          ok=res.ok && typeof body.id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id);
          // A UUID is the provider receipt. Per-identifier errors can accompany a successful send.
          if (ok) messageId=body.id; else tag=`provider_rejected_${res.status}`;
        } catch { /* Do not log provider body, push keys, or personal data. */ }
        const {data:saved,error:saveError}=await db.rpc('slot_alert_finish',{p_job:id,p_claim:claim,p_ok:ok,p_message:messageId,p_error:ok?null:tag});
        return saveError || saved!==true ? 'receipt_failed' : ok ? 'provider_accepted' : 'retry_pending';
      })));
    }
    return response({processed:results.length,counts:results.reduce((a,k)=>({...a,[k]:(a[k]||0)+1}),{})});
  };
}
