# Implementation Plan - App Refinements

## Required Package Installation

Before implementing, run this command in your terminal:

```bash
npm install html5-qrcode
```

## Changes to Implement

### 1. Global Navigation (Back Button)
- Add `<ArrowLeft />` button to all sub-views
- Positioned top-left with `setView('admin_home')` or `setView('client_home')`

### 2. Real QR Scanner
- Import `Html5QrcodeScanner` from 'html5-qrcode'
- Replace mock logic with real camera scanning
- Parse QR data and call `check_in_user` RPC

### 3. Library Refactoring
- Add category tabs (All, Exercise, Diet, Routine)
- List view: Show only thumbnail + title
- Detail modal: Full content on click

### 4. Search Functionality
- Add search input + "Search" button
- Filter only on button click (not while typing)

### 5. Auth Updates
- Remove "Goal" field from RegisterView
- Add "Forgot Password?" link in LoginView
- Implement password reset with `supabase.auth.resetPasswordForEmail()`

### 6. UI Polish
- All buttons: `rounded-xl`
- All backgrounds: `bg-zinc-900` or similar
- Add transitions everywhere

---

I'll now implement these changes systematically.
