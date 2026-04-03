# morning-concierge

회원에게 **당일 PT 예약**이 있을 때 아침 푸시(OneSignal)를 보냅니다. KST 기준으로 `bookings.date`가 오늘인 행만 대상으로 하며, **`send-class-reminders`(수업 60분 전 회원 / 10분 전 관리자)와는 별도**입니다.

## 동작

| Cron (KST) | Query | 대상 수업 시간 |
|------------|--------|----------------|
| 08:30 | `?slot=early` | 11:00 **미만** |
| 10:00 | `?slot=late` | 11:00 **이상** |

같은 슬롯에서 한 회원에게 예약이 여러 개면 **가장 이른 시간** 한 번만 발송합니다.

## 메시지

제목: `오늘의 PT`

본문:

`오늘은 {시간}에 pt수업이 있는 날입니다. 잠시 후에 뵙겠습니다. 오늘도 좋은하루 되시길 바랍니다.`

- 시간은 `10시`, `14시 30분` 형태(한국어)로 넣습니다.

## 환경 변수

Edge Function에 다음이 필요합니다(대시보드 Secrets 또는 `supabase secrets set`).

- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `SUPABASE_URL` (자동)
- `SUPABASE_SERVICE_ROLE_KEY` (자동)

푸시는 `send-class-reminders`와 동일하게 **`include_external_user_ids`** = Supabase `user_id`(앱에서 `OneSignal.login(user.id)`).

## 배포

```bash
supabase functions deploy morning-concierge
```

## pg_cron

`supabase/cron/morning_concierge_cron.sql` 내용을 참고해 SQL Editor에서 실행하세요. URL·`service_role` 키는 플레이스홀더를 실제 값으로 바꿉니다.
