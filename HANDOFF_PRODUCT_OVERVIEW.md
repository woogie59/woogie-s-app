# THE COACH - Product Overview

## 1) Product Summary
THE COACH is a premium fitness coaching web app with two primary user roles:
- **Client (Member)**: checks in with QR, books classes, reviews schedule/history, uses tools.
- **Admin (Trainer/Owner)**: scans client QR, manages members/tickets/schedules/settings, receives alerts.

The app is built with:
- **Frontend**: React + Vite + Tailwind + Framer Motion
- **Backend/Data**: Supabase (Postgres, RPC, Realtime, Edge Functions)
- **Notifications**: OneSignal (via Supabase Edge Function)

## 2) Core User Journeys

### A. Authentication
- Login / Register / Reset Password views
- Session-based app access

### B. Client Journey
1. Client logs in
2. Lands on **Client Home**
3. Can:
   - Open personal QR pass
   - Book classes
   - View weekly schedule
   - Open session history modal (attendance timeline + weekly rhythm)
   - Use macro calculator
   - Read training library content

### C. Admin Journey
1. Admin logs in
2. Lands on **Admin Home**
3. Can:
   - Open QR scanner for check-in
   - Manage members and tickets
   - Review member details and private CRM notes
   - Configure schedule/availability
   - Open admin analytics/revenue views (if enabled in app state)

## 3) Signature Features

### 3.1 QR Check-in
- Admin scans client QR
- `check_in_user` RPC validates and deducts sessions
- Attendance is recorded in `attendance_logs`

### 3.2 Golden Time Alert (D-6)
- After successful check-in, if remaining sessions become `6`:
  - Frontend calls `supabase.functions.invoke('send-admin-alert')`
  - Admin receives OneSignal push:
    - Heading: `⚠️ 재등록 골든타임 (D-6)`
    - Message: `<MemberName>님이 6회 남았습니다. 성취도 분석을 준비하세요!`
- Success modal also shows a highlighted “golden time” message.

### 3.3 Session History Experience
- Dedicated modal showing:
  - Last 5 weeks attendance rhythm (bar chart)
  - Session-by-session history list
  - Summary card (TOTAL / DONE / LEFT + progress bar)

### 3.4 Secret CRM Notes (Admin-only workflow)
- Member Detail includes private note area
- Notes are saved into `trainer_notes`
- Intended for retention strategy, coaching context, renewal planning

## 4) Current UI Direction
- Dark premium theme (`zinc` palette + yellow accents)
- Cinematic entry and motion transitions
- Luxurious “membership pass” QR card for client check-in view

## 5) Handoff Scope
This package is intended to transfer:
- Full product behavior
- UI flow map
- Data and integration logic
- Operational constraints (roles, alerts, private notes)

For deep debugging or exact implementation-level changes, attach code files as a second step.
