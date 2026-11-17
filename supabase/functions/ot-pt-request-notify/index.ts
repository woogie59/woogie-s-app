// Server-only OT PT-registration-request notification. No caller-selected recipient or message.
// Mirrors ot-booking-notify: shared-secret auth, outbox claim, OneSignal idempotency.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export const handler = async (req: Request): Promise<Response> => {
  const j = (body: unknown, status = 200) => Response.json(body, { status });
  if (req.method !== "POST") return j({ error: "method" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const got = req.headers.get("x-ot-webhook-secret") ?? "";
  if (!got) return j({ error: "forbidden" }, 403);
  const { data: secret, error: se } = await db.rpc("internal_ot_notify_secret");
  if (se || !secret || got !== secret) return j({ error: "forbidden" }, 403);
  let id = "";
  try { id = (await req.json()).request_id; } catch { return j({ error: "invalid" }, 400); }
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return j({ error: "invalid" }, 400);
  const claim = crypto.randomUUID();
  const { data: jobs, error: ce } = await db.from("ot_pt_request_notify_jobs").update({ state: "sending", locked_at: new Date().toISOString(), claim_token: claim }).eq("request_id", id).eq("state", "pending").select("attempts");
  if (ce) return j({ error: "claim" }, 500);
  if (!jobs?.length) return j({ skipped: true });
  const attempts = jobs[0].attempts + 1;
  const save = async (state: string, error: string | null, messageId: string | null = null) => {
    const { error: e } = await db.from("ot_pt_request_notify_jobs").update({ state, attempts, last_error: error, message_id: messageId, locked_at: null, claim_token: null, checked_at: new Date().toISOString() }).eq("request_id", id).eq("claim_token", claim);
    if (e) throw Error("receipt");
  };
  try {
    const { data: rq, error: re } = await db.from("ot_pt_requests").select("requested_date,requested_time,status,ot_links(member_name)").eq("id", id).maybeSingle();
    if (re || !rq) throw Error("request_unavailable");
    // 신청 즉시 확정(accepted) 모델에서도 신규 신청 INSERT는 accepted로 들어온다 — 둘 다 발송.
    if (rq.status !== "requested" && rq.status !== "accepted") { await save("skipped", null); return j({ skipped: true }); }
    const name = (rq.ot_links as { member_name?: string } | null)?.member_name || "회원";
    // Fail closed when admin identity is ambiguous; never select an arbitrary admin.
    const { data: admins, error: ae } = await db.from("profiles").select("onesignal_id").eq("role", "admin").limit(2);
    if (ae || admins?.length !== 1 || !admins[0].onesignal_id) throw Error("admin_target_unavailable");
    const app = (Deno.env.get("ONESIGNAL_APP_ID") ?? "").replace(/["']/g, "").trim();
    const key = (Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "").replace(/["']/g, "").trim();
    if (!app || !key) throw Error("configuration");
    const text = `${name}님 - ${String(rq.requested_date).slice(0, 10)} ${rq.requested_time}`;
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({ app_id: app, include_subscription_ids: [String(admins[0].onesignal_id)], headings: { en: "피티 등록 신청", ko: "피티 등록 신청" }, contents: { en: text, ko: text }, data: { labdot_audience: "admin", labdot_event: "ot_pt_request" }, idempotency_key: id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.id !== "string" || !/^[0-9a-f-]{36}$/i.test(result.id) || (result.errors && Object.keys(result.errors).length) || result.recipients === 0) throw Error("provider_rejected");
    await save("provider_accepted", null, result.id);
    return j({ ok: true, provider_accepted: true });
  } catch (e) {
    const allowed = ["request_unavailable", "admin_target_unavailable", "configuration", "provider_rejected", "receipt"];
    const tag = e instanceof Error && allowed.includes(e.message) ? e.message : "transport_unknown";
    // Retry with the same request UUID: OneSignal idempotency absorbs uncertain sends.
    await save(attempts >= 5 ? "failed" : "pending", tag).catch(() => {});
    return j({ error: tag }, 502);
  }
};
if (!Deno.env.get("OT_NOTIFY_TEST_NO_SERVE")) Deno.serve(handler);
