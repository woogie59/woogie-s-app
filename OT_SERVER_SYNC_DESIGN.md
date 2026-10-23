# 오티 알림·캘린더 서버 보장 설계 (배포 전 로컬 준비본)

목표: 공개(무로그인) 오티 페이지가 기존 공개 Edge를 임의 대상·문구로 호출하지 않으면서,
요청된 자동 알림·캘린더 반영을 서버에서 실재 예약/대상 검증 + 재시도 보장으로 달성한다.

## 바뀐 것 (rev5)
- 공개 오티 페이지(OtBookingPage)의 클라이언트 fire-and-forget 호출 전부 제거
  (notify-admin-events 임의 targetId/문구, google-calendar-sync 직접 호출, ot_report_sync).
- 최소 데이터: ot_book이 trainer_blocked_slots(authenticated 전체 SELECT 가능한 공용 테이블)에
  이름을 쓰지 않는다. 이름은 토큰으로만 조회되는 ot_links/ot_bookings에만 존재.
- google-calendar-sync: 이름 없는 OT block은 제목 '오티'로 등록(폴백). 기존 이름 있는
  수동 OT 흐름 동작은 그대로. OT 이벤트 등록 성공 시 ot_bookings.calendar_synced_at 기록.
- ot_report_sync 함수 제거(공개 페이지 보고 경로 폐기). 관리자 수동 재등록은 기존처럼
  관리자 화면에서 직접 갱신.

## 서버 보장 경로 (배포 시)
1. 관리자 푸시: Database Webhook(ot_bookings INSERT) → ot-booking-notify
   - 공유 비밀 헤더 검증 → DB에서 예약 실재/상태 재확인 → admin_notified_at 원자적 선점
   - 관리자 OneSignal ID는 서비스 롤로 서버에서 조회, 문구 고정 템플릿
   - 실패 시 선점 해제 → 관리자 화면 "푸시 미알림" 배지 + 수동 재시도(booking_id 호출)
2. 캘린더: Database Webhook(trainer_blocked_slots) → 기존 google-calendar-sync
   - INSERT는 google_event_id가 있으면 skip(멱등) → 중복 생성 없음, 재시도 안전
3. 대시보드 webhook 실구성 여부는 미검증. 배포 단계에서 Dashboard → Database → Webhooks
   두 건(ot_bookings, trainer_blocked_slots)을 확인/생성한다 (코드 추가 없음, pg_net
   템플릿: supabase/ot_booking_notify_webhook.sql, google_calendar_sync_webhook.sql).

## 아직 안 하는 것
- 취소 푸시: 취소 알림 1회 보장에는 별도 플래그 컬럼이 필요 → DB 변경 승인 후 추가.
- 정규 회원 예약(bookings)과의 교차 writer 원자성: bookings INSERT/DELETE에
  trainer_blocked_slots을 같이 쓰는 트리거 안. 부작용(기존 중복 허용 동작 변경,
  백필 정책, 기존 유니크 인덱스 공용) 검토 중 — 별도 승인 대상.
- 노쇼 정책: 미정 유지. 완료는 관리자가 출석 확인 후 건별 처리만 가능.

## 배포 체크리스트 (모두 승인 후)
1. migration(ot_application rev5) 적용
2. `supabase functions deploy ot-booking-notify google-calendar-sync`
3. Secrets: OT_WEBHOOK_SECRET 설정 (ONESIGNAL_* 는 기존 설정 재사용)
4. Dashboard Webhooks: ot_bookings INSERT→ot-booking-notify(시크릿 헤더),
   trainer_blocked_slots→google-calendar-sync 확인/생성
5. 더미 링크로 실테스트: 신청→푸시/캘린더/배지 해제, 취소→자리 해제,
   동시 2요청 경쟁, 완료 건별 처리
