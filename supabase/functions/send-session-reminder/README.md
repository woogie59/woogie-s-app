# send-session-reminder

관리자/트레이너(`profiles.role = 'admin'`)에게 **수업 시작 10분 전** OneSignal 푸시를 보냅니다. `bookings`는 `date` + `time`(KST)로 시작 시각을 계산합니다(`start_time` 컬럼 없음).

## Cron

`pg_cron`으로 **매분** 호출합니다. Edge Function 내부에서 “지금 + 10분”에 해당하는 분 단위와 일치하는 예약만 발송합니다.

SQL: `supabase/cron/send_session_reminder_cron.sql`

## 환경 변수

- `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (자동)
- 선택: `ONESIGNAL_SESSION_REMINDER_IOS_SOUND`, `ONESIGNAL_SESSION_REMINDER_ANDROID_SOUND` — 앱에 번들된 커스텀 사운드 파일명(없으면 `default`)
- 선택: `ONESIGNAL_ANDROID_CHANNEL_ID` — Android 알림 채널

## 페이로드 / 딥링크

`data`:

- `labdot_action`: `admin_timeline`
- `booking_date`: `YYYY-MM-DD`
- `booking_id`, `session_type`

웹 클라이언트(`App.jsx`)는 알림 탭 시 `admin_schedule` 일간 뷰로 이동합니다.

## 회원 60분 전

`send-class-reminders`는 회원 60분 전만 처리합니다. 관리자 10분 전은 이 함수로만 보냅니다.
