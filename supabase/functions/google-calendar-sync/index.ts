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

type WebhookRow = {
  id?: string;
  user_id?: string;
  date?: string;
  time?: string;
  status?: string | null;
  google_event_id?: string | null;
  updated_at?: string;
} & Record<string, unknown>;

type WebhookBody = {
  type?: "INSERT" | "UPDATE" | "DELETE" | string;
  table?: string;
  record?: WebhookRow | null;
  old_record?: WebhookRow | null;
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
) {
  const url = `${calendarBase(calId)}${pathSuffix}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
  return { ok: r.ok, status: r.status, body: parsed as Record<string, unknown> };
}

function buildEventBody(userName: string, start: string, end: string) {
  return {
    summary: `${userName}님 수업`,
    start: { dateTime: start, timeZone: KST },
    end: { dateTime: end, timeZone: KST },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return j({ error: "Method not allowed" }, 405);
  }

  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return j({ error: "Missing SUPABASE_URL" }, 500);
  const supabase = createClient(supabaseUrl, serviceKey);
  const calId = (Deno.env.get("GOOGLE_CALENDAR_ID") || "").trim();
  if (!calId) return j({ error: "Missing GOOGLE_CALENDAR_ID" }, 500);

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return j({ error: "Invalid JSON" }, 400);
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
    const eid = old.google_event_id;
    if (!eid) return j({ ok: true, skipped: true, reason: "no google_event_id" });
    const d = await gcal(calId, "DELETE", `/events/${encodeURIComponent(eid)}`, token, undefined);
    if (!d.ok && d.status !== 404) {
      return j({ error: "Calendar delete failed", details: d.body }, 502);
    }
    return j({ ok: true, deleted: eid, source: "DELETE" });
  }

  if (op === "UPDATE" && rec && isCancelled(String(rec.status))) {
    const eid = rec.google_event_id || old?.google_event_id;
    if (eid) {
      const d = await gcal(calId, "DELETE", `/events/${encodeURIComponent(eid)}`, token, undefined);
      if (!d.ok && d.status !== 404) {
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
  const eventResource = buildEventBody(name, range.start, range.end);

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
        const p = await gcal(
          calId,
          "PATCH",
          `/events/${encodeURIComponent(eid)}`,
          token,
          eventResource,
        );
        if (!p.ok) {
          return j({ error: "Calendar patch failed", details: p.body }, 502);
        }
        return j({ ok: true, action: "patched", eventId: eid });
      }
      return j({ skipped: true, reason: "no schedule change" });
    }
  }

  const ins = await gcal(calId, "POST", "/events", token, {
    ...eventResource,
  });
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
});
