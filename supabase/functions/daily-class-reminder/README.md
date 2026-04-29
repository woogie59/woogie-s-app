# daily-class-reminder

`bookings.date` equals **today’s calendar date string in Asia/Seoul (KST)**, computed with `Intl` (`YYYY-MM-DD`). There is **no `start_time` / `end_time` column**; the Postgres filter is `eq("date", todayKST)`.

Logs print the UTC window that corresponds to that KST calendar day `[startUtc, endUtc)`, for diagnosing timezone misunderstandings vs the actual query.

Notifications use **OneSignal** REST (this repo does not call Kakao AlimTalk/SMS).

## Secrets

| Variable | Purpose |
|----------|---------|
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | Push API |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Query `bookings` / `profiles` |
| `ONESIGNAL_TEST_PLAYER_ID` | **Required when `test_mode=true`** — your device’s Subscription / Player Id from OneSignal (not raw phone — SMS is unused here). |

## Test mode (no spam to members)

Pass `test_mode=true` as a query parameter **or** JSON body `{"test_mode":true}`.

Then the function sends **one** diagnostics push body to `ONESIGNAL_TEST_PLAYER_ID` only; real player ids are skipped.

Example:

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export ANON_OR_SERVICE_ROLE="YOUR_SERVICE_ROLE_KEY"

curl -sS "$SUPABASE_URL/functions/v1/daily-class-reminder?slot=early&test_mode=true" \
  -H "Authorization: Bearer $ANON_OR_SERVICE_ROLE" \
  -H "apikey: $ANON_OR_SERVICE_ROLE"

# With JSON body (POST):

curl -sS -X POST "$SUPABASE_URL/functions/v1/daily-class-reminder?slot=late&test_mode=true" \
  -H "Authorization: Bearer $ANON_OR_SERVICE_ROLE" \
  -H "apikey: $ANON_OR_SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"test_mode":true}'
```

Deploy:

```bash
npx supabase functions deploy daily-class-reminder
```

Inspect Edge Function logs in Supabase Dashboard → Edge Functions → `daily-class-reminder` → Logs; **OneSignal responses** are prefixed with `[daily-class-reminder][onesignal][...]`.
