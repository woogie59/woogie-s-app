/**
 * LAB DOT — Member reminders (pg_cron: every minute)
 * Target: bookings — 회원 60분 전만. 관리자 10분 전 → send-session-reminder
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

type BookingRow = {
  id: string;
  user_id: string;
  date: string;
  time: string;
  status: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseScheduleTimeToParts(raw: string): { h: number; m: number } | null {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function scheduleStartUtcMs(dateStr: string, scheduleTime: string): number | null {
  const parts = parseScheduleTimeToParts(scheduleTime);
  if (!parts) return null;
  const iso = `${dateStr}T${pad2(parts.h)}:${pad2(parts.m)}:00+09:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function formatKstHHMM(utcMs: number): string {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utcMs));
  return s.replace(/\s/g, "");
}

async function sendOneSignalNotification(params: {
  appId: string;
  restKey: string;
  externalUserIds: string[];
  title: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  const { appId, restKey, externalUserIds, title, body } = params;
  if (externalUserIds.length === 0) return { ok: true };

  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${restKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_external_user_ids: externalUserIds,
      headings: { ko: title, en: title },
      contents: { ko: body, en: body },
      target_channel: "push",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.errors?.[0] ?? data.message ?? `HTTP ${res.status}`, raw: data };
  }
  return { ok: true, raw: data };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!appId || !restKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing ENV variables" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = Date.now();
  const clientTargetMinute = Math.floor((now + 60 * 60 * 1000) / 60000) * 60000;

  // 1. bookings 테이블에서 예약 정보 가져오기
  const { data: bookingRows, error: schedErr } = await supabase
    .from("bookings")
    .select("id, user_id, date, time, status")
    .neq("status", "cancelled");

  if (schedErr) {
    console.error("[send-class-reminders] bookings error:", schedErr);
    return new Response(JSON.stringify({ error: schedErr.message }), { status: 500 });
  }

  const rows = (bookingRows ?? []) as BookingRow[];

  const results = [];

  // 3. 1분마다 타겟 시간과 일치하는지 스캔 후 발사
  for (const row of rows) {
    const startMs = scheduleStartUtcMs(String(row.date).slice(0, 10), row.time);
    if (startMs === null) continue;
    
    const classMinute = Math.floor(startMs / 60000) * 60000;
    const hhmm = formatKstHHMM(startMs);

    // 회원 타격 (60분 전) — 관리자 10분 전은 send-session-reminder Edge Function
    if (classMinute === clientTargetMinute) {
      const r = await sendOneSignalNotification({
        appId, restKey, externalUserIds: [row.user_id],
        title: "수업 1시간 전",
        body: `오늘 ${hhmm} 수업 시작 1시간 전입니다. LAB DOT에서 뵙겠습니다.`,
      });
      results.push({ schedule_id: row.id, kind: "client_60", sent: r.ok });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: rows.length, results }), { status: 200 });
});