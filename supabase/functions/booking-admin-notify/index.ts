// Server-only booking admin notification (created/cancelled). No caller-selected recipient or message.
// Sole dispatch owner for booking admin pushes — client-side sends were removed in the same change.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const handler = async (req: Request): Promise<Response> => {
  const j = (body: unknown, status = 200) => Response.json(body, { status });
  if (req.method !== "POST") return j({ error: "method" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const got = req.headers.get("x-booking-notify-secret") ?? "";
  if (!got) return j({ error: "forbidden" }, 403);
  const { data: secret, error: se } = await db.rpc("internal_booking_notify_secret");
  if (se || !secret || got !== secret) return j({ error: "forbidden" }, 403);

  let bookingId = "";
  let kind = "";
  try {
    const b = await req.json();
    bookingId = b.booking_id;
    kind = b.kind;
  } catch { return j({ error: "invalid" }, 400); }
  if (typeof bookingId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    return j({ error: "invalid" }, 400);
  }
  if (kind !== "created" && kind !== "cancelled") return j({ error: "invalid" }, 400);

  const claim = crypto.randomUUID();
  const { data: jobs, error: ce } = await db.from("booking_notify_jobs")
    .update({ state: "sending", locked_at: new Date().toISOString(), claim_token: claim })
    .eq("booking_id", bookingId).eq("kind", kind).eq("state", "pending")
    .select("attempts");
  if (ce) return j({ error: "claim" }, 500);
  if (!jobs?.length) return j({ skipped: true });
  const attempts = jobs[0].attempts + 1;

  const save = async (state: string, error: string | null, messageId: string | null = null) => {
    const { error: e } = await db.from("booking_notify_jobs")
      .update({ state, attempts, last_error: error, message_id: messageId, locked_at: null, claim_token: null, checked_at: new Date().toISOString() })
      .eq("booking_id", bookingId).eq("kind", kind).eq("claim_token", claim);
    if (e) throw Error("receipt");
  };

  // Deterministic RFC-9562 UUID from booking id + kind: any retry of the same logical
  // notification carries the same OneSignal idempotency key (30-day dedupe window).
  const idemKey = async (): Promise<string> => {
    const digest = new Uint8Array(await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`labdot-booking-admin-push:${bookingId}:${kind}`),
    ));
    const b = digest.slice(0, 16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  try {
    const { data: job, error: je } = await db.from("booking_notify_jobs")
      .select("payload").eq("booking_id", bookingId).eq("kind", kind).eq("claim_token", claim).maybeSingle();
    if (je || !job) throw Error("job_unavailable");
    const name = String((job.payload as Record<string, unknown>)?.name ?? "회원");
    const dateS = String((job.payload as Record<string, unknown>)?.date ?? "");
    const timeS = String((job.payload as Record<string, unknown>)?.time ?? "");

    // Recipient resolution replicates the existing booking-notification flow exactly
    // (client utils/notifications.js fetchAdminOnesignalProfile):
    // profiles role='admin', onesignal_id not null, limit 1 → RPC get_admin_onesignal_player_id.
    // Multi-admin ambiguity is logged, never silently widened.
    let targetId: string | null = null;
    const { count: adminCount } = await db.from("profiles").select("id", { count: "exact", head: true })
      .eq("role", "admin").not("onesignal_id", "is", null);
    if (typeof adminCount === "number" && adminCount > 1) {
      console.error(`[booking-admin-notify] multiple admin rows with onesignal_id: ${adminCount} — using existing limit-1 resolution`);
    }
    const { data: adminRow, error: ae } = await db.from("profiles").select("onesignal_id")
      .eq("role", "admin").not("onesignal_id", "is", null).limit(1).maybeSingle();
    if (ae) console.error("[booking-admin-notify] admin target query:", ae.message);
    if (adminRow?.onesignal_id) targetId = String(adminRow.onesignal_id);
    if (!targetId) {
      const { data: rpcId, error: rpcErr } = await db.rpc("get_admin_onesignal_player_id");
      if (rpcErr) console.error("[booking-admin-notify] admin target rpc:", rpcErr.message);
      if (rpcId != null && String(rpcId) !== "") targetId = String(rpcId);
    }
    if (!targetId) throw Error("admin_target_unavailable");

    const app = (Deno.env.get("ONESIGNAL_APP_ID") ?? "").replace(/["']/g, "").trim();
    const key = (Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "").replace(/["']/g, "").trim();
    if (!app || !key) throw Error("configuration");

    const title = kind === "created" ? "새로운 세션 확정" : "세션 취소 알림";
    const message = kind === "created"
      ? `${name}님 - ${dateS} ${timeS}`
      : `${name}님 - ${dateS} ${timeS} 예약이 취소되었습니다.`;
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({
        app_id: app,
        include_subscription_ids: [targetId],
        headings: { en: title, ko: title },
        contents: { en: message, ko: message },
        data: { labdot_audience: "admin", labdot_event: kind === "created" ? "booking_created" : "booking_cancelled" },
        idempotency_key: await idemKey(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    // provider_accepted = OneSignal이 요청을 접수했다는 뜻이며 기기 표시 보장이 아님.
    if (!response.ok || typeof result.id !== "string" || !/^[0-9a-f-]{36}$/i.test(result.id) ||
        (result.errors && Object.keys(result.errors).length) || result.recipients === 0) {
      throw Error("provider_rejected");
    }
    await save("provider_accepted", null, result.id);
    return j({ ok: true, provider_accepted: true });
  } catch (e) {
    const allowed = ["job_unavailable", "admin_target_unavailable", "configuration", "provider_rejected", "receipt"];
    const tag = e instanceof Error && allowed.includes(e.message) ? e.message : "transport_unknown";
    // Retry with the same booking UUID+kind: OneSignal idempotency absorbs uncertain sends.
    await save(attempts >= 5 ? "failed" : "pending", tag).catch(() => {});
    return j({ error: tag }, 502);
  }
};
if (!Deno.env.get("BOOKING_NOTIFY_TEST_NO_SERVE")) Deno.serve(handler);
