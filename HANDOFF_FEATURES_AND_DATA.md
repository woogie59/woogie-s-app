# THE COACH - Features, Data Model, and Integrations

## 1) Architecture Summary
- **Client app**: React frontend with modular feature components
- **Backend**: Supabase Postgres + Auth + Realtime + RPC + Edge Functions
- **Push notifications**: OneSignal, triggered server-side from Edge Functions

## 2) Key Data Entities

## `profiles`
- Core user profile table
- Typical fields used by app:
  - `id`
  - `name`
  - `email`
  - `role` (`admin` vs member)
  - `remaining_sessions`
  - `price_per_session`
  - `onesignal_id`
  - optional profile metadata (goal/dob/gender)

## `bookings`
- Client class reservations
- Typical fields:
  - `id`, `user_id`, `date`, `time`, `created_at`
  - optional status handling (project-dependent)

## `attendance_logs`
- Source of truth for completed check-ins
- Typical fields:
  - `id`, `user_id`, `check_in_at`
  - `session_price_snapshot`
  - optional `session_time_fixed`

## `session_batches`
- Ticket-pack model for session inventory
- Typical fields:
  - `id`, `user_id`
  - `total_count`, `remaining_count`
  - `price_per_session`
  - `purchased_at` / `created_at`

## `trainer_notes`
- Private admin CRM notes on members
- Fields:
  - `id`, `user_id`, `content`, `created_at`
- Intended for retention strategy notes and coaching context

## 3) Business Logic and Critical Flows

## 3.1 Check-in RPC
- RPC: `check_in_user(user_uuid)`
- Responsibilities:
  - Validate session availability
  - Deduct one session
  - Record attendance log
  - Return updated `remaining` count

## 3.2 Golden Time Alert
- Trigger condition: post-check-in `remaining === 6`
- Frontend action:
  - `supabase.functions.invoke('send-admin-alert', { body: { heading, message } })`
- UX:
  - Success result includes special “golden time” highlight

## 3.3 Admin Push Delivery
- Edge Function: `send-admin-alert`
- Server-side responsibilities:
  - Fetch admin `onesignal_id` from `profiles`
  - Send push via OneSignal API
  - Return API response/error payload

## 3.4 Session History Analytics (Client)
- Reads `attendance_logs` for current user
- Produces:
  - Last 5-week frequency bars
  - Session timeline
  - Summary metrics (used/done/left + progress ratio)

## 3.5 Private CRM Notes (Admin)
- Member detail loads latest note from `trainer_notes`
- Save action inserts a new note row (append-only style)

## 4) Realtime Behavior
- Client subscribes to `attendance_logs` insert events filtered by own `user_id`
- Used to refresh/check-in feedback and remaining session info

## 5) Security and Access Model
- Admin-only routes gated in UI (`AdminRoute`)
- Data access expected to be protected by Supabase RLS policies
- Sensitive actions (alerts, privileged writes) should remain server-side

## 6) Operational Notes
- If push alerts fail with auth errors, verify:
  - OneSignal API key format and header mode
  - Edge function secret/env config or key wiring
  - `profiles.onesignal_id` availability for admin account
- If scanner fails, check QR contrast and booking/session preconditions

## 7) Recommended Validation Checklist
- Auth: login/register/reset
- Client:
  - QR modal opens and scans reliably
  - Booking create/cancel works
  - Session history and summary render correctly
- Admin:
  - Scanner success/fail paths
  - Golden time D-6 push trigger
  - Member notes save/load
  - Schedule/settings pages load
