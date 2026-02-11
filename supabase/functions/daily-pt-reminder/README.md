# daily-pt-reminder Edge Function

Sends push notifications to members with today's PT bookings, then sends an admin report summary.

## Behavior

1. **Member notifications**: For each booking today (KST), sends "오늘 [시간] PT 수업이 있습니다!" to the member's `onesignal_id`.
2. **Admin report**: After member notifications, sends a summary ONLY to the admin:  
   `"🔔 [알림 발송 보고] 오늘 총 ${total}명 중 ${success_count}명에게 알림을 보냈습니다. (실패: ${failure_count}건)"`
3. **Timezone**: Uses Asia/Seoul (KST) for "today" so notifications run at the correct local time.

## Setup

### 1. Set secrets (required)

```bash
supabase secrets set ONESIGNAL_REST_API_KEY=your_rest_api_key_here
```

- Get the key from [OneSignal Dashboard](https://dashboard.onesignal.com) → Settings → Keys & IDs → REST API Key.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set automatically for Edge Functions.

### 2. Deploy the function

```bash
supabase functions deploy daily-pt-reminder
```

### 3. Admin OneSignal ID setup

For the admin report to be delivered:

1. **Log in as admin** to the app (e.g. `admin@gmail.com` or the account with `role = 'admin'`).
2. **Allow push notifications** when prompted by OneSignal.
3. **Save OneSignal ID to the database**:
   - Go to **Admin Home** in the app.
   - Click **"Force Save OneSignal ID"** (or equivalent).
   - This writes `onesignal_id` into the `profiles` row for the admin.
4. **Check in Supabase** that the admin profile has `onesignal_id`:

   ```sql
   SELECT email, role, onesignal_id FROM profiles WHERE role = 'admin';
   ```

## Scheduling (recommended)

Run at 08:00 KST daily, for example:

1. **Supabase Cron** (pg_cron):
   ```sql
   SELECT cron.schedule(
     'daily-pt-reminder',
     '0 23 * * *',  -- 23:00 UTC = 08:00 KST
     $$ SELECT net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/daily-pt-reminder',
       headers := '{"Authorization": "Bearer <service_role_key>"}'
     ) AS request_id;
     $$
   );
   ```

2. **External cron** (e.g. GitHub Actions, Vercel Cron):

   ```bash
   curl -X POST \
     "https://<project-ref>.supabase.co/functions/v1/daily-pt-reminder" \
     -H "Authorization: Bearer <service_role_key>"
   ```

Schedule at **08:00 KST** (23:00 UTC previous day) so members get the reminder in the morning.

## Response

```json
{
  "ok": true,
  "date_kst": "2025-01-15",
  "total": 5,
  "success_count": 4,
  "failure_count": 1,
  "admin_report_sent": true
}
```

- `failure_count` includes members without `onesignal_id` and OneSignal API errors.
- `admin_report_sent` is `true` when the admin report was delivered.
