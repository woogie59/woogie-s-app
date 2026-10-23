// OT 캘린더 outbox 하니스 (로컬 전용 — 배포 환경과 무관)
// 실제 index.ts 핸들러를 직접 호출하고, PostgREST/Google API는 상태기계 mock으로 대체한다.
import { handler } from "./index.ts";

// ---------- mock 상태 ----------
type Row = Record<string, any>;
const db = {
  jobs: new Map<string, Row>(),
  blocks: new Map<string, Row>(),
  bookings: new Map<string, Row>(),
};
const gcalEvents = new Map<string, Row>();
let googleCalls: Array<{ method: string; path: string; body?: any }> = [];
let onGooglePost: null | (() => Promise<void>) = null; // 실경쟁 인터리빙 주입용
let fail = {
  blockRead: false,
  blockWriteZeroRows: false,
  googleInsertStatus: 0, // 0=정상, 500 등
  googleDeleteStatus: 0,
  googleGetStatus: 0,
  googlePutStatus: 0,
};

function resetAll() {
  db.jobs.clear(); db.blocks.clear(); db.bookings.clear();
  gcalEvents.clear(); googleCalls = [];
  fail = { blockRead: false, blockWriteZeroRows: false, googleInsertStatus: 0, googleDeleteStatus: 0, googleGetStatus: 0, googlePutStatus: 0 };
  onGooglePost = null;
}

function applyFilters(rows: Row[], q: URLSearchParams): Row[] {
  let out = rows;
  for (const [k, v] of q.entries()) {
    if (k === "select" || k === "limit" || k === "order") continue;
    const [op, val] = v.split(/=(.+)/).length > 1 ? [v.slice(0, v.indexOf(".")), v.slice(v.indexOf(".") + 1)] : [v, ""];
    // supabase 필터 형식: col=op.value
    const m = v.match(/^(\w+)\.(.*)$/);
    if (!m) continue;
    const [, oper, raw] = m;
    out = out.filter((r) => {
      const cell = r[k];
      if (oper === "eq") return String(cell ?? "") === raw;
      if (oper === "gte") return String(cell ?? "") >= raw;
      if (oper === "is") return raw === "null" ? cell == null : false;
      return true;
    });
  }
  const lim = q.get("limit");
  if (lim) out = out.slice(0, Number(lim));
  return out;
}

const TABLE_MAP: Record<string, string> = {
  ot_calendar_sync_jobs: "jobs",
  trainer_blocked_slots: "blocks",
  ot_bookings: "bookings",
};
function pgrest(table: string, method: string, q: URLSearchParams, body: any, prefer: string): Response {
  const store: Map<string, Row> = (db as any)[TABLE_MAP[table] ?? table];
  if (!store) return new Response("table? " + table, { status: 500 });
  const all = [...store.values()];
  if (method === "GET") {
    if (table === "trainer_blocked_slots" && fail.blockRead) {
      return Response.json({ message: "db down" }, { status: 500 });
    }
    return Response.json(applyFilters(all, q));
  }
  if (method === "PATCH") {
    if (table === "trainer_blocked_slots" && fail.blockWriteZeroRows) {
      return Response.json([], { status: 200 }); // 행이 삭제된 것처럼
    }
    const rows = applyFilters(all, q);
    for (const r of rows) Object.assign(r, body);
    return prefer.includes("return=representation") ? Response.json(rows) : new Response(null, { status: 204 });
  }
  return new Response("method?", { status: 500 });
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
  const url = typeof input === "string" ? input : input.url;
  const method = (init?.method || (typeof input !== "string" ? input.method : "GET")).toUpperCase();
  const u = new URL(url);
  let body: any = undefined;
  if (init?.body) {
    try { body = JSON.parse(init.body); } catch { body = init.body; }
  }

  if (url.includes("oauth2.googleapis.com/token")) {
    return Response.json({ access_token: "mock-google-token", expires_in: 3600 });
  }
  if (u.hostname === "www.googleapis.com") {
    const path = u.pathname;
    googleCalls.push({ method, path, body });
    const m = path.match(/\/calendars\/[^/]+\/events(?:\/([^/?]+))?/);
    if (!m) return new Response("bad google path", { status: 500 });
    const eid = m[1] ? decodeURIComponent(m[1]) : null;
    if (method === "POST" && !eid) {
      if (onGooglePost) await onGooglePost(); // Google 쓰기 도중의 동시 변경을 주입
      if (fail.googleInsertStatus) return Response.json({ error: "injected" }, { status: fail.googleInsertStatus });
      const id = body?.id ?? "g" + Math.random().toString(36).slice(2, 12);
      if (gcalEvents.has(id)) return Response.json({ error: { code: 409 } }, { status: 409 });
      gcalEvents.set(id, { ...body, id });
      return Response.json({ ...body, id });
    }
    if (method === "GET" && eid) {
      if (fail.googleGetStatus) return Response.json({ error: "injected" }, { status: fail.googleGetStatus });
      const ev = gcalEvents.get(eid);
      return ev ? Response.json(ev) : Response.json({ error: "notFound" }, { status: 404 });
    }
    if (method === "PUT" && eid) {
      if (fail.googlePutStatus) return Response.json({ error: "injected" }, { status: fail.googlePutStatus });
      if (!gcalEvents.has(eid)) return Response.json({ error: "notFound" }, { status: 404 });
      gcalEvents.set(eid, { ...body, id: eid });
      return Response.json({ ...body, id: eid });
    }
    if (method === "DELETE" && eid) {
      if (fail.googleDeleteStatus) return Response.json({ error: "injected" }, { status: fail.googleDeleteStatus });
      if (!gcalEvents.has(eid)) {
        gcalEvents.delete(eid);
        return Response.json({ error: "gone" }, { status: 410 });
      }
      gcalEvents.delete(eid);
      return new Response(null, { status: 204 });
    }
  }
  if (u.hostname === "mock.local") {
    if (u.pathname === "/rest/v1/rpc/internal_gcal_webhook_secret") return Response.json("test-secret");
    const t = u.pathname.match(/\/rest\/v1\/(\w+)/);
    if (t) {
      const h = init?.headers;
      const prefer = h instanceof Headers ? (h.get("prefer") ?? "") : ((h ?? {})["Prefer"] ?? (h ?? {}).prefer ?? "");
      return pgrest(t[1], method, u.searchParams, body, String(prefer));
    }
  }
  throw new Error("unmocked fetch: " + url);
};

// ---------- 환경 ----------
Deno.env.set("OT_GCAL_TEST_NO_SERVE", "1");
Deno.env.set("SUPABASE_URL", "http://mock.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-key");
Deno.env.set("GOOGLE_CALENDAR_ID", "mock-cal");

// 서비스계정 RSA 키 생성 (테스트용, 값은 어디에도 쓰이지 않음)
async function makeSa() {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`;
  Deno.env.set("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify({ client_email: "mock@test.iam.gserviceaccount.com", private_key: pem }));
}
await makeSa();

// ---------- helpers ----------
function call(body: any, headers: Record<string, string> = { "x-gcal-webhook-secret": "test-secret" }) {
  return handler(new Request("http://fn.local/", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
}
function detId(blockId: string) { return "ot" + blockId.replace(/-/g, "").toLowerCase(); }
function addJob(blockId: string, op: string, createdAt: string, payload: any = {}) {
  const id = crypto.randomUUID();
  db.jobs.set(id, { id, block_id: blockId, op, payload, status: "pending", attempts: 0, created_at: createdAt });
  return id;
}
function addBlock(id: string, extra: Row = {}) {
  db.blocks.set(id, { id, block_date: "2026-10-26", block_time: "19:00", label: "OT", kind: "ot", member_name: null, google_event_id: null, ...extra });
}
const B = () => crypto.randomUUID();
const summaryOf = (eid: string) => gcalEvents.get(eid)?.summary;

// ---------- tests ----------
Deno.test("1. INSERT happy path: 결정적 id 생성 + write-back + done + 이름 없으면 '오티'", async () => {
  resetAll();
  const b = B(); addBlock(b);
  const job = addJob(b, "INSERT", "2026-10-23T12:00:00Z", { new: { id: b } });
  const r = await call({ job_id: job });
  const out = await r.json();
  if (r.status !== 200 || out.action !== "created") throw new Error("unexpected: " + JSON.stringify(out));
  const eid = detId(b);
  if (!gcalEvents.has(eid)) throw new Error("event missing");
  if (summaryOf(eid) !== "오티") throw new Error("summary privacy: " + summaryOf(eid));
  if (db.blocks.get(b).google_event_id !== eid) throw new Error("write-back missing");
  if (db.jobs.get(job).status !== "done") throw new Error("job not done");
});

Deno.test("2. 동시 2처리 같은 job: 이벤트 1개만", async () => {
  resetAll();
  const b = B(); addBlock(b);
  const job = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  const [r1, r2] = await Promise.all([call({ job_id: job }), call({ job_id: job })]);
  const o1 = await r1.json(); const o2 = await r2.json();
  if (gcalEvents.size !== 1) throw new Error("events=" + gcalEvents.size + " " + JSON.stringify([o1, o2]));
  if (db.jobs.get(job).status !== "done") throw new Error("job not done");
});

Deno.test("3. DELETE 먼저 완료 → 지연 INSERT: 생성 안 함 (superseded)", async () => {
  resetAll();
  const b = B(); addBlock(b);
  const insJob = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  const delJob = addJob(b, "DELETE", "2026-10-23T12:01:00Z", { old: { id: b, google_event_id: null } });
  db.blocks.delete(b); // 삭제 커밋됨
  let r = await call({ job_id: delJob });
  if (r.status !== 200) throw new Error("delete job failed");
  r = await call({ job_id: insJob });
  const out = await r.json();
  if (gcalEvents.size !== 0) throw new Error("orphan created");
  if (db.jobs.get(insJob).status !== "done") throw new Error("insert job not done");
});

Deno.test("4. 생성 직후 블록 삭제(write-back 0행): DELETE job이 같은 id로 정리", async () => {
  resetAll();
  const b = B(); addBlock(b);
  const insJob = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  fail.blockWriteZeroRows = true; // write-back 시점엔 행이 없음
  let r = await call({ job_id: insJob });
  const out = await r.json();
  if (r.status !== 200) throw new Error("insert should finish: " + JSON.stringify(out));
  if (!gcalEvents.has(detId(b))) throw new Error("event should exist before delete job");
  const delJob = addJob(b, "DELETE", "2026-10-23T12:01:00Z", { old: { id: b, google_event_id: null } });
  r = await call({ job_id: delJob });
  if (r.status !== 200) throw new Error("delete job failed");
  if (gcalEvents.size !== 0) throw new Error("orphan remains");
});

Deno.test("5. 블록 읽기 DB 오류: 외부 쓰기 없이 502 + pending 복귀", async () => {
  resetAll();
  const b = B(); addBlock(b);
  const job = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  fail.blockRead = true;
  const r = await call({ job_id: job });
  if (r.status !== 502) throw new Error("expected 502, got " + r.status);
  if (googleCalls.length !== 0) throw new Error("google called: " + JSON.stringify(googleCalls));
  if (db.jobs.get(job).status !== "pending") throw new Error("job not pending");
});

Deno.test("6. claim 후 크래시(processing 정체) → sweeper 회수 → 재처리 성공", async () => {
  resetAll();
  const b = B(); addBlock(b);
  const job = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  // 크래시 시뮬레이션: processing + 오래된 locked_at
  db.jobs.get(job).status = "processing";
  db.jobs.get(job).locked_at = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  // sweeper reset 동작 재현
  const j = db.jobs.get(job);
  if (j.status === "processing" && j.locked_at < new Date(Date.now() - 5 * 60 * 1000).toISOString()) { j.status = "pending"; j.locked_at = null; j.claim_token = null; }
  const r = await call({ job_id: job });
  if (r.status !== 200) throw new Error("reprocess failed");
  if (gcalEvents.size !== 1) throw new Error("event missing");
});

Deno.test("7. Google insert 500: 이벤트 없음 + pending + attempts 증가", async () => {
  resetAll();
  const b = B(); addBlock(b);
  const job = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  fail.googleInsertStatus = 500;
  const r = await call({ job_id: job });
  if (r.status !== 502) throw new Error("expected 502");
  if (gcalEvents.size !== 0) throw new Error("event should not exist");
  if (db.jobs.get(job).status !== "pending" || db.jobs.get(job).attempts !== 1) throw new Error("retry state wrong");
  fail.googleInsertStatus = 0;
  const r2 = await call({ job_id: job });
  if (r2.status !== 200 || gcalEvents.size !== 1) throw new Error("retry did not recover");
});

Deno.test("8. Google delete 500 → pending 유지, 재시도로 삭제 완료 (취소 연동 내구성)", async () => {
  resetAll();
  const b = B();
  const eid = detId(b);
  gcalEvents.set(eid, { id: eid, summary: "오티" });
  const job = addJob(b, "DELETE", "2026-10-23T12:00:00Z", { old: { id: b, google_event_id: null } });
  fail.googleDeleteStatus = 500;
  let r = await call({ job_id: job });
  if (r.status !== 502) throw new Error("expected 502");
  if (db.jobs.get(job).status !== "pending") throw new Error("job not pending");
  if (!gcalEvents.has(eid)) throw new Error("event should survive failed delete");
  fail.googleDeleteStatus = 0;
  r = await call({ job_id: job });
  if (r.status !== 200 || gcalEvents.has(eid)) throw new Error("retry delete failed");
});

Deno.test("9. 409 adopt: 같은 id의 구버전 이벤트를 최신 내용으로 교정", async () => {
  resetAll();
  const b = B(); addBlock(b, { member_name: "김더미" });
  const eid = detId(b);
  gcalEvents.set(eid, { id: eid, summary: "오티", start: { dateTime: "2026-01-01T09:00:00+09:00" } });
  const job = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  const r = await call({ job_id: job });
  const out = await r.json();
  if (out.action !== "adopted") throw new Error("not adopted: " + JSON.stringify(out));
  if (gcalEvents.size !== 1) throw new Error("duplicate after adopt");
  if (summaryOf(eid) !== "김더미님 오티") throw new Error("stale content not refreshed: " + summaryOf(eid));
});

Deno.test("10. legacy 저장 id: UPDATE/DELETE는 저장된 Google id 사용", async () => {
  resetAll();
  const b = B();
  addBlock(b, { google_event_id: "google-legacy-123" });
  gcalEvents.set("google-legacy-123", { id: "google-legacy-123", summary: "오티", start: { dateTime: "x" }, end: { dateTime: "y" } });
  const upJob = addJob(b, "UPDATE", "2026-10-23T12:00:00Z", { old: { id: b, google_event_id: "google-legacy-123" } });
  let r = await call({ job_id: upJob });
  if (r.status !== 200) throw new Error("legacy update failed: " + JSON.stringify(await r.json()));
  const delJob = addJob(b, "DELETE", "2026-10-23T12:01:00Z", { old: { id: b, google_event_id: "google-legacy-123" } });
  db.blocks.delete(b);
  r = await call({ job_id: delJob });
  if (r.status !== 200) throw new Error("legacy delete failed");
  if (gcalEvents.size !== 0) throw new Error("legacy event not deleted");
});

Deno.test("11. 인증 없는 호출: 403", async () => {
  resetAll();
  const r = await call({ job_id: "x" }, {});
  if (r.status !== 403) throw new Error("expected 403, got " + r.status);
});

Deno.test("12. stale worker 차단: 회수·재선점 뒤 구 worker의 ack/fail이 새 상태를 덮지 않음", async () => {
  // (a) finish 경로
  resetAll();
  const b = B(); addBlock(b);
  const j1 = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  const tokenB = crypto.randomUUID();
  onGooglePost = async () => {
    // Google 쓰기 도중 sweeper 회수(토큰 해제) + 새 worker B의 재선점
    const job = db.jobs.get(j1)!;
    job.status = "pending"; job.claim_token = null; job.locked_at = null;
    job.status = "processing"; job.claim_token = tokenB; job.locked_at = new Date().toISOString();
  };
  const r = await call({ job_id: j1 });
  if (r.status !== 200) throw new Error("stale finish는 조용히 무시돼야 함: " + r.status);
  const job1 = db.jobs.get(j1)!;
  if (job1.status !== "processing") throw new Error("구 worker finish가 상태를 덮음: " + job1.status);
  if (job1.claim_token !== tokenB) throw new Error("claim_token이 바뀜");

  // (b) retry(fail) 경로
  resetAll();
  const b2 = B(); addBlock(b2);
  const j2 = addJob(b2, "INSERT", "2026-10-23T12:00:00Z");
  fail.googleInsertStatus = 500;
  onGooglePost = async () => {
    const job = db.jobs.get(j2)!;
    job.status = "processing"; job.claim_token = crypto.randomUUID(); job.locked_at = new Date().toISOString();
  };
  const r2 = await call({ job_id: j2 });
  const out2 = await r2.json();
  if (r2.status !== 200 || out2.stale !== true) throw new Error("stale retry는 200+stale이어야 함: " + r2.status + " " + JSON.stringify(out2));
  const job2 = db.jobs.get(j2)!;
  if (job2.status !== "processing") throw new Error("구 worker retry가 상태를 덮음: " + job2.status);
  if (job2.attempts !== 0) throw new Error("구 worker retry가 attempts를 올림: " + job2.attempts);
});

Deno.test("13. 쓰기 도중 블록 변경(역전 경합): 검증 읽기가 잡아 최종 상태가 최신 내용과 일치", async () => {
  resetAll();
  const b = B(); addBlock(b); // 19:00
  const j1 = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  onGooglePost = async () => { db.blocks.get(b)!.block_time = "20:00"; }; // 쓰기 사이에 다른 트랜잭션이 변경
  const r = await call({ job_id: j1 });
  if (r.status !== 200) throw new Error("failed: " + r.status);
  const ev = gcalEvents.get(detId(b));
  if (!ev) throw new Error("event missing");
  if (!String(ev.start?.dateTime ?? "").includes("20:00")) {
    throw new Error("최종 이벤트가 최신 내용이 아님: " + JSON.stringify(ev.start));
  }
  if (db.jobs.get(j1)!.status !== "done") throw new Error("job not done");
});

Deno.test("14. 2worker·서로 다른 job: 구 내용 PUT이 늦게 착륙(역전)해도 최종은 최신 내용", async () => {
  resetAll();
  const b = B(); addBlock(b); // 현재 19:00
  const jobA = addJob(b, "INSERT", "2026-10-23T12:00:00Z");

  // worker A가 19:00을 읽고 Google POST에서 멈추게 한다
  let release!: () => void;
  let entered = false;
  const gate = new Promise<void>((r) => { release = r; });
  onGooglePost = async () => { entered = true; await gate; };
  const pA = call({ job_id: jobA });
  for (let i = 0; i < 100 && !entered; i++) await new Promise((r) => setTimeout(r, 10));
  if (!entered) throw new Error("worker A가 게이트에 도달하지 못함");

  // 그 사이 블록이 20:00으로 바뀌고, worker B(더 늦은 UPDATE job)가 먼저 완료
  db.blocks.get(b)!.block_time = "20:00";
  const jobB = addJob(b, "UPDATE", "2026-10-23T12:01:00Z");
  onGooglePost = null;
  const rB = await call({ job_id: jobB });
  if (rB.status !== 200) throw new Error("worker B 실패: " + rB.status);
  if (!String(gcalEvents.get(detId(b))?.start?.dateTime ?? "").includes("20:00")) {
    throw new Error("worker B 결과가 20:00이 아님");
  }

  // A의 POST를 풀어준다 → 409 → 구 내용(19:00)으로 PUT이 늦게 착륙(역전 발생)
  release();
  const rA = await pA;
  if (rA.status !== 200) throw new Error("worker A 실패: " + rB.status);

  // 역전 착륙이 실제로 있었는지 확인 (19:00 PUT이 B 이후에 존재)
  const put19 = googleCalls.findIndex((c) => c.method === "PUT" && String(c.body?.start?.dateTime ?? "").includes("19:00"));
  const postB = googleCalls.findIndex((c) => c.method === "POST" && String(c.body?.start?.dateTime ?? "").includes("20:00"));
  if (put19 === -1 || postB === -1 || put19 < postB) throw new Error("역전 인터리빙이 재현되지 않음");

  // 최종 상태는 최신 내용과 일치해야 한다 (A의 검증 읽기가 잡아 재작성)
  const ev = gcalEvents.get(detId(b));
  if (!String(ev?.start?.dateTime ?? "").includes("20:00")) {
    throw new Error("최종 이벤트가 최신 내용이 아님: " + JSON.stringify(ev?.start));
  }
  if (db.jobs.get(jobA)!.status !== "done" || db.jobs.get(jobB)!.status !== "done") throw new Error("job 상태 오류");
});

Deno.test("private booking name: server source only, no block name write", async () => {
  resetAll(); const b = B(); addBlock(b);
  const bid = B(); db.bookings.set(bid, { id: bid, block_id: b, status: "confirmed", name: "제목더미" });
  const job = addJob(b, "INSERT", "2026-10-23T12:00:00Z");
  const r = await call({job_id:job});
  if (r.status !== 200 || summaryOf(detId(b)) !== "제목더미님 오티") throw Error("private name missing");
  if (db.blocks.get(b).member_name !== null) throw Error("public block name leaked");
});
Deno.test("ambiguous booking name: fail closed before Google write", async () => {
  resetAll(); const b = B(); addBlock(b);
  for (const name of ["더미A","더미B"]) { const id=B(); db.bookings.set(id,{id,block_id:b,status:"confirmed",name}); }
  const job = addJob(b,"INSERT","2026-10-23T12:00:00Z");
  const r=await call({job_id:job});
  if(r.status!==502||googleCalls.length) throw Error("ambiguous name must not write");
});
