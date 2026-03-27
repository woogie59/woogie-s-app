# THE COACH - UI Map and Interface Inventory

## 1) App-Level Structure
- Root app controls session and active view state.
- Feature modules are imported from dedicated folders (`pages`, `features`, `components/ui`).

## 2) Authentication Interfaces

### Login View
- Purpose: user sign-in
- Actions: login, navigate to register/reset

### Register View
- Purpose: new account creation
- Actions: create account, navigate back

### Reset Password View
- Purpose: password reset flow
- Actions: submit reset/update path

## 3) Client Interfaces

### Client Home
- Main entry for logged-in clients
- Primary controls:
  - **CHECK-IN** (opens QR modal)
  - **LIBRARY**
  - **CLASS BOOKING**
  - **MY SCHEDULE** (weekly schedule modal)
  - **MACRO CALCULATOR**
- Bottom-left “Total Remaining” is clickable:
  - Opens **Session History Modal**

### QR Code Modal (Client-side)
- Shows personal check-in QR as a premium pass card
- Includes:
  - Membership pass label
  - Stylized QR card (high-contrast scanning-safe colors)
  - Name + remaining sessions info block
  - Instructional guidance
  - Prominent close button

### My Schedule Modal
- Weekly navigation
- Day cards with booking time slots
- Cancel booking action per slot

### Session History Modal
- Header (`MY JOURNEY`)
- Session Summary Card:
  - Progress bar
  - TOTAL / DONE / LEFT stats
- Weekly Rhythm chart (last 5 weeks)
- Session history list (receipt-like rows)

### Library View (App-level feature view)
- Content feed for workout/nutrition tips
- Optional post/create interactions depending on role

### Macro Calculator View
- Personal nutrition calculation utility

## 4) Admin Interfaces

### Admin Home
- Central admin dashboard entry
- Navigation to scanner/member/schedule/settings

### Admin Route Guard
- Restricts access to admin-only pages
- Redirects unauthorized sessions

### QR Scanner (Admin-side)
- Camera-based scanner UI
- Processing result modal:
  - Success/fail status
  - Remaining sessions
  - Golden Time highlight if D-6 triggered

### Member List
- Search/browse members
- Navigate to selected member detail

### Member Detail
- Profile and ticket state
- Active session packs with progress visuals
- Add new session pack action
- Client metadata (goal, birth, gender)
- **Secret CRM (Private)** note editor with save action

### Admin Schedule
- Availability and scheduling operations

### Admin Settings
- Working hour and holiday settings

## 5) Shared UI Components
- `ButtonPrimary`, `ButtonGhost`
- `BackButton`
- `Skeleton` loading placeholders
- `CinematicIntro`
- `GlobalModal` system (alert/confirm replacements)

## 6) Interaction Quality and Style
- Dark-first premium visual tone
- Gold accent language for high-priority actions
- Framer Motion used for modal and view transitions
- Consistent large-touch controls for mobile-first ergonomics
