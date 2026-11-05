// Isolated behavior tests for booking-admin-notify. All network mocked (PostgREST/RPC + OneSignal).
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert";

Deno.env.set("BOOKING_NOTIFY_TEST_NO_SERVE", "1");
Deno.env.set("SUPABASE_URL", "https://testproj.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
Deno.env.set("ONESIGNAL_APP_ID", "test-app-id");
Deno.env.set("ONESIGNAL_REST_API_KEY", "test-rest-key");

type Call = { url: string; method: string; body?: string };
const calls: Call[] = [];
const state = {
  claimAttempts: 0 as number | null, // null = already claimed/terminal (return [])
  osStatus: 200,
  adminCount: 1,
};
const J = (v: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", ...headers } });

// deno-lint-ignore no-explicit-any
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  const method = init?.method ?? "GET";
  const body = init?.body ? String(init.body) : undefined;
  if (url.includes("onesignal.com")) {
    calls.push({ url, method, body });
    if (state.osStatus !== 200) return J({ errors: { invalid: ["x"] } }, state.osStatus);
    return J({ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", recipients: 1 });
  }
  if (url.includes("/rest/v1/rpc/internal_booking_notify_secret")) return J("s3cr3t");
  if (url.includes("/rest/v1/rpc/get_admin_onesignal_player_id")) return J("sub-admin-1");
  if (url.includes("/rest/v1/profiles")) {
    if (method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": `0-0/${state.adminCount}` } });
    if (url.includes("select=onesignal_id")) return J({ onesignal_id: "sub-admin-1" });
    return J(null);
  }
  if (url.includes("/rest/v1/booking_notify_jobs")) {
    if (method === "PATCH") {
      calls.push({ url, method, body });
      const isClaim = url.includes("state=eq.pending");
      if (isClaim) return J(state.claimAttempts === null ? [] : [{ attempts: state.claimAttempts }]);
      return J([]); // save
    }
    if (url.includes("select=payload")) return J({ payload: { name: "테스트용1", date: "2026-11-06", time: "21:00" } });
    return J([]);
  }
  throw new Error("unexpected fetch: " + method + " " + url);
// deno-lint-ignore no-explicit-any
}) as any;

const { handler } = await import("./index.ts");

const ID = "11111111-2222-4333-8444-555555555555";
const req = (payload: unknown, secret = "s3cr3t") =>
  handler(new Request("https://fn.local/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-booking-notify-secret": secret },
    body: JSON.stringify(payload),
  }));
const osCalls = () => calls.filter((c) => c.url.includes("onesignal.com"));
const saveCalls = () => calls.filter((c) => c.url.includes("booking_notify_jobs") && c.method === "PATCH" && !c.url.includes("state=eq.pending"));
const reset = () => { calls.length = 0; state.claimAttempts = 0; state.osStatus = 200; state.adminCount = 1; };

Deno.test("wrong/missing secret -> 403, no send", async () => {
  reset();
  assertEquals((await req({ booking_id: ID, kind: "created" }, "wrong")).status, 403);
  assertEquals((await req({ booking_id: ID, kind: "created" }, "")).status, 403);
  assertEquals(osCalls().length, 0);
});

Deno.test("invalid id/kind -> 400", async () => {
  reset();
  assertEquals((await req({ booking_id: "nope", kind: "created" })).status, 400);
  assertEquals((await req({ booking_id: ID, kind: "updated" })).status, 400);
});

Deno.test("created: claim -> send -> provider_accepted receipt, deterministic idempotency key", async () => {
  reset();
  const r = await req({ booking_id: ID, kind: "created" });
  const body = await r.json();
  assertEquals(body.ok, true);
  assertEquals(body.provider_accepted, true);
  assertEquals(osCalls().length, 1);
  const osBody = JSON.parse(osCalls()[0].body!);
  assertEquals(osBody.headings.ko, "새로운 세션 확정");
  assertEquals(osBody.contents.ko, "테스트용1님 - 2026-11-06 21:00");
  assertEquals(osBody.include_subscription_ids, ["sub-admin-1"]);
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(osBody.idempotency_key));
  const saves = saveCalls();
  assertEquals(saves.length, 1);
  const saved = JSON.parse(saves[0].body!);
  assertEquals(saved.state, "provider_accepted");
  assertEquals(saved.attempts, 1);
  assertEquals(saved.message_id, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
});

Deno.test("cancelled: message says 취소", async () => {
  reset();
  const r = await req({ booking_id: ID, kind: "cancelled" });
  await r.json();
  const osBody = JSON.parse(osCalls()[0].body!);
  assertEquals(osBody.headings.ko, "세션 취소 알림");
  assertStringIncludes(osBody.contents.ko, "예약이 취소되었습니다.");
});

Deno.test("created vs cancelled use different idempotency keys; retry same key", async () => {
  reset();
  await (await req({ booking_id: ID, kind: "created" })).json();
  const keyCreated = JSON.parse(osCalls()[0].body!).idempotency_key;
  reset();
  await (await req({ booking_id: ID, kind: "cancelled" })).json();
  const keyCancelled = JSON.parse(osCalls()[0].body!).idempotency_key;
  assert(keyCreated !== keyCancelled);
  // retry after provider_rejected: same key
  reset(); state.osStatus = 400;
  const r1 = await req({ booking_id: ID, kind: "created" });
  assertEquals((await r1.json()).error, "provider_rejected");
  const saved1 = JSON.parse(saveCalls()[0].body!);
  assertEquals(saved1.state, "pending"); // attempts 1 < 5 → retryable
  reset(); state.claimAttempts = 1; // second attempt of same job
  await (await req({ booking_id: ID, kind: "created" })).json();
  assertEquals(JSON.parse(osCalls()[0].body!).idempotency_key, keyCreated);
  assertEquals(JSON.parse(saveCalls()[0].body!).attempts, 2);
});

Deno.test("5th attempt failure -> failed (no further retry)", async () => {
  reset(); state.osStatus = 400; state.claimAttempts = 4;
  const r = await req({ booking_id: ID, kind: "created" });
  assertEquals((await r.json()).error, "provider_rejected");
  assertEquals(JSON.parse(saveCalls()[0].body!).state, "failed");
});

Deno.test("already claimed/terminal job -> skipped, no send", async () => {
  reset(); state.claimAttempts = null;
  const r = await req({ booking_id: ID, kind: "created" });
  assertEquals((await r.json()).skipped, true);
  assertEquals(osCalls().length, 0);
});

Deno.test("multiple admin rows: still single-recipient send (existing limit-1 rule), no widening", async () => {
  reset(); state.adminCount = 2;
  const r = await req({ booking_id: ID, kind: "created" });
  await r.json();
  const osBody = JSON.parse(osCalls()[0].body!);
  assertEquals(osBody.include_subscription_ids.length, 1);
});
