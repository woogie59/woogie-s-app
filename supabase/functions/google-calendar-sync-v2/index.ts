/**
 * Webhook: public.bookings — Google Calendar (service account).
 * Secrets: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CALENDAR_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for admin client; gateway validates JWT)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "https://deno.land/x/jose@v4.15.0/index.ts";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DURATION_MIN = 50;
const KST = "Asia/Seoul";

/** Event title: `{이름}님 수업` — no [labdot]/[latdot] or other prefix. */
function formatEventSummary(userName: string): string {
  const n = (userName || "").trim() || "회원";
  return `${n}님 수업`;
}

/** OT hold: `{이름}님 오티`. */
function formatOtEventSummary(memberName: string): string {
  const n = (memberName || "").trim();
  return n ? `${n}님 오티` : "오티";
}

/**
 * Google Calendar `events` resource: exactly one override, popup only.
 * `useDefault` must be the boolean `false` (not string). If omitted or `true`, Google
 * applies the calendar’s default notifications (e.g. 30m + email) regardless of overrides.
 * Each call returns a fresh object for insert/put/patch bodies.
 */
type StrictEventReminders = {
  useDefault: false;
  overrides: { method: "popup"; minutes: number }[];
};

function getStrictEventReminders(): StrictEventReminders {
  return {
    useDefault: false,
    overrides: [{ method: "popup", minutes: 10 }],
  };
}

/** Event already removed in Google Calendar (manual delete). */
function isCalendarEventAlreadyGone(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

function stripReadOnlyGcalEventFields(rec: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...rec };
  for (const k of [
    "kind",
    "htmlLink",
    "created",
    "updated",
    "etag",
    "hangoutLink",
    "conferenceData",
  ]) {
    delete out[k];
  }
  /** Never carry over GET `reminders` into PUT; we set strict overrides after merge. */
  delete out["reminders"];
  return out;
}

type WebhookRow = {
  id?: string;
  user_id?: string;
  date?: string;
  time?: string;
  status?: string | null;
  google_event_id?: string | null;
  updated_at?: string;
} & Record<string, unknown>;

type BlockedSlotRow = {
  id?: string;
  block_date?: string;
  block_time?: string;
  member_name?: string | null;
  kind?: string | null;
  google_event_id?: string | null;
} & Record<string, unknown>;

type WebhookBody = {
  job_id?: string;
  type?: "INSERT" | "UPDATE" | "DELETE" | string;
  table?: string;
  record?: WebhookRow | BlockedSlotRow | null;
  old_record?: WebhookRow | BlockedSlotRow | null;
  schema?: string;
};

type ServiceAccountJson = {
  private_key?: string;
  client_email?: string;
};

let cached: { at: number; token: string } | null = null;
const CACHE_MS = 50 * 60 * 1000;

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseTime(timeRaw: string): { h: number; m: number } | null {
  const s = (timeRaw || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function normDate(d: string | undefined): string {
  if (!d) return "";
  return d.split("T")[0]!.slice(0, 10);
}

/** Start/end in KST as RFC3339 with +09:00, duration 50 min. */
function toKstRange(
  dateStr: string,
  timeStr: string,
): { start: string; end: string } | null {
  const d = normDate(dateStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const pt = parseTime(timeStr);
  if (!pt) return null;
  const startIso = `${d}T${pad2(pt.h)}:${pad2(pt.m)}:00+09:00`;
  const startMs = new Date(startIso).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + DURATION_MIN * 60 * 1000;

  const fmtKst = (ms: number) => {
    const datePart = new Intl.DateTimeFormat("en-CA", {
      timeZone: KST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(ms));
    const timePart = new Intl.DateTimeFormat("en-GB", {
      timeZone: KST,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(ms));
    const y = datePart.find((p) => p.type === "year")?.value;
    const m0 = datePart.find((p) => p.type === "month")?.value;
    const day = datePart.find((p) => p.type === "day")?.value;
    const hh = timePart.find((p) => p.type === "hour")?.value;
    const mm = timePart.find((p) => p.type === "minute")?.value;
    const ss = timePart.find((p) => p.type === "second")?.value;
    if (!y || !m0 || !day || !hh || !mm) return null;
    return `${y}-${m0}-${day}T${hh}:${mm}:${ss || "00"}+09:00`;
  };
  const endS = fmtKst(endMs);
  if (!endS) return null;
  return { start: startIso, end: endS };
}

function isCancelled(s: string | null | undefined) {
  return (s || "") === "cancelled";
}

/** Skip webhook when only google_event_id / updated_at changed (our own write). */
function isOnlyMetadataSync(
  o: WebhookRow | null | undefined,
  n: WebhookRow | null | undefined,
): boolean {
  if (!o || !n) return false;
  const a = { ...o } as Record<string, unknown>;
  const b = { ...n } as Record<string, unknown>;
  delete a.google_event_id;
  delete a.updated_at;
  delete b.google_event_id;
  delete b.updated_at;
  return JSON.stringify(a) === JSON.stringify(b);
}

function loadServiceAccount(): ServiceAccountJson {
  const raw = (Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "").trim();
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid service account JSON");
  return parsed as ServiceAccountJson;
}

async function getAccessToken(svc: ServiceAccountJson): Promise<string> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.token;

  const keyPem = (svc.private_key || "").replace(/\\n/g, "\n");
  if (!keyPem.includes("BEGIN")) throw new Error("private_key missing in service account JSON");
  const key = await importPKCS8(keyPem, "RS256");
  const clientEmail = svc.client_email;
  if (!clientEmail) throw new Error("client_email missing in service account JSON");

  const assertion = await new SignJWT({ scope: CAL_SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const text = await r.text();
  let parsed: { access_token?: string; error?: string; error_description?: string } = {};
  try {
    if (text) parsed = JSON.parse(text) as typeof parsed;
  } catch {
    // leave parsed for throw below
  }
  if (!r.ok || !parsed.access_token) {
    console.error(
      `[google-calendar-sync] Google OAuth2 token error (https://oauth2.googleapis.com/token) status=${r.status} body:`,
      text,
    );
    const detail = !r.ok
      ? `${r.status} ${parsed.error ?? ""} ${parsed.error_description ?? text}`
      : "missing access_token in success response";
    throw new Error(String(detail).trim() || "OAuth2 token request failed");
  }
  cached = { at: now, token: parsed.access_token };
  return parsed.access_token;
}

function calendarBase(calId: string) {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}`;
}

async function gcal(
  calId: string,
  method: string,
  pathSuffix: string,
  token: string,
  body?: unknown,
  options?: { ifMatch?: string },
) {
  const url = `${calendarBase(calId)}${pathSuffix}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (options?.ifMatch) {
    headers["If-Match"] = options.ifMatch;
  }
  const r = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    console.error(
      `[google-calendar-sync] Google Calendar API error ${method} ${url} status=${r.status} body:`,
      text,
    );
  }
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  const etag = r.headers.get("etag") ?? r.headers.get("ETag") ?? undefined;
  return { ok: r.ok, status: r.status, body: parsed as Record<string, unknown>, etag };
}

/** Core writable fields; `reminders` is always the strict object (not merged from any spread). */
function buildGoogleCalendarEventBody(
  userName: string,
  start: string,
  end: string,
): {
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  reminders: StrictEventReminders;
} {
  return {
    summary: formatEventSummary(userName),
    start: { dateTime: start, timeZone: KST },
    end: { dateTime: end, timeZone: KST },
    reminders: getStrictEventReminders(),
  };
}

function buildOtGoogleCalendarEventBody(
  memberName: string,
  start: string,
  end: string,
) {
  return {
    summary: formatOtEventSummary(memberName),
    start: { dateTime: start, timeZone: KST },
    end: { dateTime: end, timeZone: KST },
    reminders: getStrictEventReminders(),
  };
}

// Vault 속 공유 비밀을 service_role 전용 RPC로 조회한다. 실패 시 빈 문자열(인증 실패 처리).
async function fetchGcalWebhookSecret(
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/internal_gcal_webhook_secret`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) {
      console.error("[google-calendar-sync-v2] secret rpc status:", res.status);
      return "";
    }
    const val = await res.json();
    return typeof val === "string" ? val.trim() : "";
  } catch (e) {
    console.error("[google-calendar-sync-v2] secret rpc error:", e instanceof Error ? e.message : String(e));
    return "";
  }
}

// OT 블록의 Google event id를 블록 id에서 결정적으로 유도한다.
// Google event id 규격: 5~1024자, [0-9a-v]. UUID 하이픈 제거 hex는 그 부분집합.
// 재시도·409 채택·삭제가 모두 같은 id를 찾는다 (센티넬 값은 쓰지 않는다).
function deterministicOtEventId(blockId: string): string {
  return ("ot" + blockId.replace(/-/g, "").toLowerCase()).slice(0, 64);
}

type SyncJob = {
  id: string;
  block_id: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  payload: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null };
  status: string;
  attempts: number;
  created_at: string;
  claim_token?: string | null;
};

const MAX_ATTEMPTS = 20;

// Names stay in the admin-only booking source, never the broadly readable block.
async function privateOtName(db: ReturnType<typeof createClient>, blockId: string, fallback: unknown) {
  const { data, error } = await db.from("ot_bookings")
    .select("name").eq("block_id", blockId).eq("status", "confirmed").limit(2);
  if (error || (data?.length ?? 0) > 1) throw Error("OT booking name unavailable");
  return data?.length === 1 ? String(data[0].name ?? "").trim() : String(fallback ?? "").trim();
}


// 동기화 작업 큐(ot_calendar_sync_jobs)의 job 하나를 처리한다.
// - claim: pending→processing 전이 + claim_token 부여 (단일 승자, 단일 UPDATE 문의 행 잠금)
// - 완료/실패 기록(ack/fail)은 같은 claim_token일 때만 반영된다. sweeper가 회수해
//   토큰이 해제/교체된 뒤 도착하는 구 worker의 ack/fail은 0행 매칭으로 무시돼
//   새 worker의 결과를 덮지 않는다 (stale worker 차단).
// - claim 경합만으로 이미 실행 중인 worker의 Google 쓰기 자체는 막을 수 없다.
//   외부 쓰기의 수렴은 ① 결정적 event id(409 채택) ② DB 최신 행 기준 본문
//   ③ 쓰기 뒤 검증 읽기(사이에 변경됐으면 최신으로 재작성, 최대 3회)가 보장한다.
// - 실패: pending 복귀(토큰 해제) → sweeper 재시도, 상한(20회) 초과 시 failed로
//   남겨 가시화 (복구: admin_requeue_ot_calendar_sync_job RPC)
// - 외부(Google) 쓰기는 DB 최신 상태를 확인한 뒤에만 수행 (fail-closed)
async function processSyncJob(
  body: { job_id?: string },
  supabase: ReturnType<typeof createClient>,
  calId: string,
  token: string,
): Promise<Response> {
  const jobId = String(body.job_id ?? "");
  if (!jobId) return j({ error: "Missing job_id" }, 400);

  const claimToken = crypto.randomUUID();

  // claim: 단일 승자만 processing으로 전이된다.
  const { data: claimed, error: claimErr } = await supabase
    .from("ot_calendar_sync_jobs")
    .update({
      status: "processing",
      locked_at: new Date().toISOString(),
      claim_token: claimToken,
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("*");
  if (claimErr) return j({ error: "job claim failed", details: claimErr.message }, 502);
  if (!claimed || claimed.length === 0) {
    // 이미 처리됐거나 다른 worker가 처리 중이거나(정상 경합), 아직 커밋 전(fast-path)이다.
    return j({ ok: true, skipped: true, reason: "job not claimable" });
  }
  const job = claimed[0] as SyncJob;

  // finish/retry는 같은 claim_token일 때만 상태를 바꾼다. 0행이면 회수돼
  // 소유권을 잃은 것 — 새 worker의 결과를 덮지 않고 조용히 종료한다.
  const finish = async (fields: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("ot_calendar_sync_jobs")
      .update({
        status: "done",
        attempts: job.attempts + 1,
        last_error: null,
        locked_at: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("claim_token", claimToken)
      .select("id");
    if (error) console.error("[gcal-v2] finish update failed:", error.message);
    else if (!data || data.length === 0) {
      console.error("[gcal-v2] stale finish ignored (claim lost):", job.id);
    }
    return j({ ok: true, job_id: job.id, ...fields });
  };
  const retry = async (msg: string) => {
    const attempts = job.attempts + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    const { data } = await supabase
      .from("ot_calendar_sync_jobs")
      .update({
        status: failed ? "failed" : "pending",
        attempts,
        last_error: msg.slice(0, 500),
        locked_at: null,
        claim_token: null,
      })
      .eq("id", job.id)
      .eq("claim_token", claimToken)
      .select("id");
    if (data && data.length === 0) {
      console.error("[gcal-v2] stale retry ignored (claim lost):", job.id);
      return j({ ok: true, stale: true, job_id: job.id });
    }
    return j({ error: msg, job_id: job.id, attempts, failed }, 502);
  };

  const blockId = String(job.block_id);
  const op = job.op;
  const oldRow = (job.payload?.old ?? null) as Record<string, unknown> | null;

  // DELETE는 블록 행이 이미 없으므로 payload 스냅샷이 근거다.
  if (op === "DELETE") {
    const storedId = String(oldRow?.google_event_id ?? "").trim();
    const eid = storedId || deterministicOtEventId(blockId);
    const d = await gcal(calId, "DELETE", `/events/${encodeURIComponent(eid)}`, token, undefined);
    if (!d.ok && !isCalendarEventAlreadyGone(d.status)) {
      return retry(`calendar delete failed (status ${d.status})`);
    }
    return finish({ action: "deleted", eventId: eid });
  }

  // INSERT/UPDATE: "읽기 → Google 쓰기 → 검증 읽기"를 최대 3회.
  // 쓰기 사이에 블록이 바뀌었으면 최신 내용으로 다시 써서 최종 상태를 최신 내용과
  // 일치시킨다. 바뀐 내용의 적재 job은 별도로 남아 뒤따라 처리되지만, 내용이 같으면
  // 같은 결정적 id에 같은 본문을 쓰는 멱등 처리로 끝난다.
  for (let iter = 0; iter < 3; iter++) {
    const { data: brow, error: bErr } = await supabase
      .from("trainer_blocked_slots")
      .select("*")
      .eq("id", blockId)
      .maybeSingle();
    if (bErr) return retry("block read failed: " + bErr.message);
    if (!brow) {
      // 행이 없다: 삭제 트랜잭션이 남긴 DELETE job이 이벤트를 정리한다. 여기서 만들지 않는다.
      return finish({ skipped: true, reason: "block no longer exists" });
    }
    if (String(brow.kind ?? "ot") !== "ot") {
      // ot→비ot 전이는 트리거가 DELETE job을 적재해 이벤트를 정리한다.
      return finish({ skipped: true, reason: "not OT kind" });
    }

    let memberName: string;
    try { memberName = await privateOtName(supabase, blockId, brow.member_name); }
    catch { return retry("OT booking name read failed"); }
    const range = toKstRange(normDate(String(brow.block_date ?? "")), String(brow.block_time ?? ""));
    if (!range) return retry("invalid block date/time");
    const eventBody = buildOtGoogleCalendarEventBody(memberName, range.start, range.end);

    const storedId = String(brow.google_event_id ?? oldRow?.google_event_id ?? "").trim();
    let eventId = storedId;
    let action = storedId ? "updated" : "created";

    if (storedId) {
      // 기존(legacy 포함) 이벤트 갱신: 최신 행 기준으로 PUT.
      const got = await gcal(calId, "GET", `/events/${encodeURIComponent(storedId)}`, token);
      if (!got.ok) return retry(`calendar get failed (status ${got.status})`);
      const merged = {
        ...stripReadOnlyGcalEventFields(got.body as Record<string, unknown>),
        ...eventBody,
        reminders: getStrictEventReminders(),
      };
      const put = await gcal(
        calId,
        "PUT",
        `/events/${encodeURIComponent(storedId)}`,
        token,
        merged,
        got.etag ? { ifMatch: got.etag } : undefined,
      );
      if (!put.ok) return retry(`calendar put failed (status ${put.status})`);
    } else {
      // 생성 전, 같은 블록의 이후 DELETE job이 있으면 만들지 않는다.
      const { data: delJobs, error: dErr } = await supabase
        .from("ot_calendar_sync_jobs")
        .select("id")
        .eq("block_id", blockId)
        .eq("op", "DELETE")
        .gte("created_at", job.created_at)
        .limit(1);
      if (dErr) return retry("supersede check failed: " + dErr.message);
      if (delJobs && delJobs.length > 0) {
        return finish({ skipped: true, reason: "superseded by delete" });
      }

      eventId = deterministicOtEventId(blockId);
      const ins = await gcal(calId, "POST", "/events", token, {
        id: eventId,
        ...eventBody,
        reminders: getStrictEventReminders(),
      });
      if (!ins.ok && ins.status !== 409) {
        return retry(`calendar insert failed (status ${ins.status})`);
      }
      if (ins.status === 409) {
        action = "adopted";
        // 같은 id의 이벤트가 이미 있다(재시도/고아/경합) → 최신 행 내용으로 덮어써 수렴.
        const got = await gcal(calId, "GET", `/events/${encodeURIComponent(eventId)}`, token);
        if (!got.ok) return retry(`adopt get failed (status ${got.status})`);
        const merged = {
          ...stripReadOnlyGcalEventFields(got.body as Record<string, unknown>),
          ...eventBody,
          reminders: getStrictEventReminders(),
        };
        const put = await gcal(
          calId,
          "PUT",
          `/events/${encodeURIComponent(eventId)}`,
          token,
          merged,
          got.etag ? { ifMatch: got.etag } : undefined,
        );
        if (!put.ok) return retry(`adopt put failed (status ${put.status})`);
      }
    }

    // 검증 읽기: 쓰기 사이에 캘린더 내용 컬럼이 바뀌지 않았는지 확인.
    const { data: vrow, error: vErr } = await supabase
      .from("trainer_blocked_slots")
      .select("block_date, block_time, member_name, kind")
      .eq("id", blockId)
      .maybeSingle();
    if (vErr) return retry("verify read failed: " + vErr.message);
    if (!vrow) {
      // 쓰기 도중 블록이 삭제됐다 — 삭제 트랜잭션의 DELETE job이 같은 결정적 id로 정리한다.
      return finish({ action: "deleted during sync", eventId });
    }
    let latestName: string;
    try { latestName = await privateOtName(supabase, blockId, vrow.member_name); }
    catch { return retry("OT booking name verify failed"); }
    const unchanged =
      latestName === memberName &&
      normDate(String(vrow.block_date ?? "")) === normDate(String(brow.block_date ?? "")) &&
      String(vrow.block_time ?? "") === String(brow.block_time ?? "") &&
      String(vrow.member_name ?? "") === String(brow.member_name ?? "") &&
      String(vrow.kind ?? "ot") === String(brow.kind ?? "ot");
    if (!unchanged) continue; // 최신 행으로 다시 쓴다

    // 수렴 확인됨 — write-back (행이 살아있을 때만. 0행이면 삭제된 것이고
    // 그 삭제 트랜잭션의 DELETE job이 방금 만든 이벤트를 정리한다).
    const { data: wb, error: wbErr } = await supabase
      .from("trainer_blocked_slots")
      .update({ google_event_id: eventId })
      .eq("id", blockId)
      .select("id");
    if (wbErr) {
      console.error("[gcal-v2] write-back failed:", wbErr.message);
    }
    if (wb && wb.length > 0) {
      try {
        await supabase
          .from("ot_bookings")
          .update({ calendar_synced_at: new Date().toISOString() })
          .eq("block_id", blockId)
          .is("calendar_synced_at", null);
      } catch (e) {
        console.error("[gcal-v2] mark ot_bookings synced:", e instanceof Error ? e.message : String(e));
      }
    }
    return finish({ action, eventId });
  }
  return retry("block changed repeatedly during sync");
}

// 테스트 하니스가 실제 핸들러를 직접 호출할 수 있도록 export한다.
// OT_GCAL_TEST_NO_SERVE가 있으면 서버를 열지 않는다 (하니스 전용; 배포 환경에는 없음).
export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return j({ error: "Method not allowed" }, 405);
  }

  // 인증: 이 함수는 외부 캘린더 쓰기를 하므로 무인증 공개 호출을 받지 않는다.
  // 허용 경로 두 가지 (이행 안전):
  //  ① Authorization: Bearer <service_role> — 기존 Database Webhook/pg_net 트리거가
  //     이미 쓰는 방식. service_role은 서버 전용이라 공개 클라이언트(anon)는 통과 불가.
  //  ② x-gcal-webhook-secret — 신규 webhook/관리자 RPC 경로.
  // (verify_jwt=false 는 게이트웨이 설정이며, 이 검사가 실제 인증이다.)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return j({ error: "Missing SUPABASE_URL" }, 500);
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const gotSecret = (req.headers.get("x-gcal-webhook-secret") ?? "").trim();
  const okService = serviceKey !== "" && bearer === serviceKey;
  // 공유 비밀은 Supabase Vault에만 둔다 (env/코드/설정 평문 없음).
  // service_role 전용 RPC로만 조회 가능하고, 이 함수 외에는 반환되지 않는다.
  let okSecret = false;
  if (!okService && gotSecret !== "") {
    const expected = await fetchGcalWebhookSecret(supabaseUrl, serviceKey);
    okSecret = expected !== "" && gotSecret === expected;
  }
  if (!okService && !okSecret) {
    return j({ error: "forbidden" }, 403);
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const calId = (Deno.env.get("GOOGLE_CALENDAR_ID") || "").trim();
  if (!calId) return j({ error: "Missing GOOGLE_CALENDAR_ID" }, 500);

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return j({ error: "Invalid JSON" }, 400);
  }

  // OT 동기화는 작업 큐(ot_calendar_sync_jobs) 기반으로만 처리한다.
  // 행 payload를 직접 받는 경로는 두지 않는다 (적재 트리거/sweeper/RPC가 job을 만든다).
  if (body.job_id) {
    const svc = loadServiceAccount();
    let token: string;
    try {
      token = await getAccessToken(svc);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[gcal-v2] getAccessToken:", msg);
      return j({ error: msg }, 500);
    }
    return processSyncJob(body as { job_id?: string }, supabase, calId, token);
  }
  if (body.table === "trainer_blocked_slots") {
    return j({ skipped: true, reason: "job-based processing only" });
  }

  if (body.table && body.table !== "bookings") {
    return j({ skipped: true, reason: "not bookings table" });
  }
  if (body.schema && body.schema !== "public") {
    return j({ skipped: true, reason: "not public schema" });
  }

  const op = (body.type || "").toUpperCase();
  const rec = body.record;
  const old = body.old_record;

  if (op === "UPDATE" && isOnlyMetadataSync(old, rec)) {
    return j({ skipped: true, reason: "only google_event_id or updated_at changed" });
  }

  const svc = loadServiceAccount();
  let token: string;
  try {
    token = await getAccessToken(svc);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[google-calendar-sync] getAccessToken threw after Google OAuth2 logging above:", msg);
    return j({ error: msg }, 500);
  }

  async function memberNameFor(userId: string | undefined): Promise<string> {
    if (!userId) return "회원";
    const { data, error } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    if (error) console.error("[google-calendar-sync] profiles:", error);
    const n = data?.name;
    if (typeof n === "string" && n.trim()) return n.trim();
    return "회원";
  }

  async function clearEventId(bookingId: string) {
    const { error } = await supabase
      .from("bookings")
      .update({ google_event_id: null })
      .eq("id", bookingId);
    if (error) console.error("[google-calendar-sync] clear google_event_id:", error);
  }

  // ----- DELETE: row removed
  if (op === "DELETE" && old) {
    // 저장된 id가 없어도 결정적 id로 삭제를 시도한다 (write-back 실패 잔여 이벤트 정리).
    const eid = old.google_event_id ||
      (old.id ? deterministicOtEventId(String(old.id)) : null);
    if (!eid) return j({ ok: true, skipped: true, reason: "no google_event_id" });
    const d = await gcal(calId, "DELETE", `/events/${encodeURIComponent(eid)}`, token, undefined);
    if (!d.ok && !isCalendarEventAlreadyGone(d.status)) {
      return j({ error: "Calendar delete failed", details: d.body }, 502);
    }
    return j({ ok: true, deleted: eid, source: "DELETE" });
  }

  if (op === "UPDATE" && rec && isCancelled(String(rec.status))) {
    const eid = rec.google_event_id || old?.google_event_id;
    if (eid) {
      const d = await gcal(calId, "DELETE", `/events/${encodeURIComponent(eid)}`, token, undefined);
      if (!d.ok && !isCalendarEventAlreadyGone(d.status)) {
        return j({ error: "Calendar delete failed (cancelled)", details: d.body }, 502);
      }
    }
    if (rec.id) await clearEventId(String(rec.id));
    return j({ ok: true, action: "cancelled", removedEventId: eid ?? null });
  }

  // INSERT or UPDATE of an active (non-cancelled) booking → create or update calendar
  const row = rec || old;
  if (!row?.id) return j({ error: "Missing booking id" }, 400);
  if (isCancelled(String(row.status))) {
    return j({ skipped: true, reason: "row is cancelled" });
  }

  const name = await memberNameFor(
    String(rec?.user_id ?? old?.user_id ?? ""),
  );
  const dateS = normDate(String(row.date ?? ""));
  const timeS = String(row.time ?? "");
  const range = toKstRange(dateS, timeS);
  if (!range) {
    return j({ error: "Invalid date or time for calendar", date: dateS, time: timeS }, 400);
  }
  const eventBody = buildGoogleCalendarEventBody(name, range.start, range.end);

  if (op === "INSERT" && row.google_event_id) {
    return j({ skipped: true, reason: "already has google_event_id" });
  }

  if (op === "UPDATE" && old && rec) {
    const eid = rec.google_event_id || old.google_event_id;
    const scheduleChanged =
      normDate(String(old.date)) !== normDate(String(rec.date)) ||
      String(old.time) !== String(rec.time);
    if (eid) {
      if (scheduleChanged || (old as WebhookRow).user_id !== (rec as WebhookRow).user_id) {
        // GET + full PUT (not PATCH): PATCH can merge `reminders` and keep old overrides.
        // Strip `reminders` from GET, then set strict `reminders` last.
        const got = await gcal(
          calId,
          "GET",
          `/events/${encodeURIComponent(eid)}`,
          token,
        );
        if (!got.ok) {
          return j({ error: "Calendar get failed (before put)", details: got.body }, 502);
        }
        const merged = {
          ...stripReadOnlyGcalEventFields(got.body as Record<string, unknown>),
          ...eventBody,
          reminders: getStrictEventReminders(),
        };
        const put = await gcal(
          calId,
          "PUT",
          `/events/${encodeURIComponent(eid)}`,
          token,
          merged,
          got.etag ? { ifMatch: got.etag } : undefined,
        );
        if (!put.ok) {
          return j({ error: "Calendar put failed", details: put.body }, 502);
        }
        return j({ ok: true, action: "put", eventId: eid });
      }
      return j({ skipped: true, reason: "no schedule change" });
    }
  }

  const ins = await gcal(
    calId,
    "POST",
    "/events",
    token,
    {
      ...eventBody,
      reminders: getStrictEventReminders(),
    },
  );
  if (!ins.ok) {
    return j({ error: "Calendar insert failed", details: ins.body }, 502);
  }
  const newId = String(ins.body.id ?? "");
  if (!newId) return j({ error: "No event id from Google" }, 502);

  const { error: upErr } = await supabase
    .from("bookings")
    .update({ google_event_id: newId })
    .eq("id", row.id);
  if (upErr) {
    console.error("[google-calendar-sync] save id:", upErr);
    return j({ error: "Saved event but failed to store google_event_id", details: upErr.message }, 502);
  }

  return j({ ok: true, action: "created", eventId: newId, bookingId: row.id });
};

if (!Deno.env.get("OT_GCAL_TEST_NO_SERVE")) {
  Deno.serve(handler);
}
