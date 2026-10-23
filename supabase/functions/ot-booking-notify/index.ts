// ot-booking-notify: 오티 신청 관리자 푸시 (서버 검증형).
//
// 배경: 기존 notify-admin-events는 (targetId + title + message)를 호출자가 임의로
// 정할 수 있어 무로그인 공개 페이지에 연결할 수 없다. 이 함수는 문구·대상을
// 서버에서만 결정한다.
//
// 보장:
//  - 공유 비밀(OT_WEBHOOK_SECRET) 헤더가 없으면 거부. 임의 호출 불가.
//  - 예약은 DB에서 다시 읽어 실재·상태(confirmed)를 확인한 뒤에만 발송.
//  - admin_notified_at 원자적 선점(UPDATE ... WHERE admin_notified_at IS NULL)으로
//    중복 발송 방지. 발송 실패 시 선점을 되돌려 재시도 가능하게 둔다.
//  - 관리자 OneSignal ID는 서비스 롤로 profiles에서 서버 측 조회 (클라이언트 입력 없음).
//
// 호출: Database Webhook(ot_bookings INSERT) 또는 수동 재시도 { "booking_id": "..." }.
// 취소 알림은 별도 플래그 컬럼이 필요해 이 버전에서는 다루지 않는다(설계 문서 참고).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ot-webhook-secret",
};

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const secret = (Deno.env.get("OT_WEBHOOK_SECRET") ?? "").trim();
  const got = (req.headers.get("x-ot-webhook-secret") ?? "").trim();
  if (!secret || got !== secret) return j({ error: "forbidden" }, 403);

  let bookingId = "";
  try {
    const body = await req.json();
    if (body?.table === "ot_bookings" && body?.record?.id) {
      bookingId = String(body.record.id);
    } else if (typeof body?.booking_id === "string") {
      bookingId = body.booking_id;
    }
  } catch {
    return j({ error: "invalid json" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return j({ error: "booking_id required" }, 400);

  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1) 서버에서 실재·상태 검증
  const { data: bk, error: readErr } = await db
    .from("ot_bookings")
    .select("id, date, time, name, status, admin_notified_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (readErr || !bk) return j({ error: "booking not found" }, 404);
  if (bk.status !== "confirmed") return j({ skipped: true, reason: "not confirmed" });
  if (bk.admin_notified_at) return j({ skipped: true, reason: "already notified" });

  // 2) 원자적 선점 — 동시 호출은 한 건만 통과
  const { data: claimed } = await db
    .from("ot_bookings")
    .update({ admin_notified_at: new Date().toISOString() })
    .eq("id", bookingId)
    .is("admin_notified_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return j({ skipped: true, reason: "claim lost" });

  // 3) 대상·문구는 서버에서만 결정
  const { data: admin, error: adminErr } = await db
    .from("profiles")
    .select("onesignal_id")
    .eq("role", "admin")
    .not("onesignal_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (adminErr || !admin?.onesignal_id) {
    await db.from("ot_bookings").update({ admin_notified_at: null }).eq("id", bookingId);
    return j({ error: "admin target unavailable" }, 500);
  }

  const APP_ID = (Deno.env.get("ONESIGNAL_APP_ID") || "").replace(/["']/g, "").trim();
  const REST_KEY = (Deno.env.get("ONESIGNAL_REST_API_KEY") || "").replace(/["']/g, "").trim();
  const dateS = String(bk.date).slice(0, 10);
  const payload = {
    app_id: APP_ID,
    include_player_ids: [String(admin.onesignal_id)],
    headings: { en: "새 오티 신청", ko: "새 오티 신청" },
    contents: { en: `${bk.name}님 - ${dateS} ${bk.time}`, ko: `${bk.name}님 - ${dateS} ${bk.time}` },
    data: { labdot_audience: "admin", labdot_event: "ot_booking" },
    idempotency_key: `ot-booking-${bookingId}`,
  };

  const response = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${REST_KEY}` },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.errors) {
    // 실패 시 선점 해제 → 관리자 화면 배지/수동 재시도로 복구 가능
    await db.from("ot_bookings").update({ admin_notified_at: null }).eq("id", bookingId);
    return j({ error: "provider rejected", details: result?.errors ?? response.status }, 502);
  }
  return j({ ok: true, booking_id: bookingId });
});
