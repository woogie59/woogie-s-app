# 🏋️‍♀️ THE COACH - Advanced Roadmap (Phase 3 & 4)

## 📊 Phase 3: Financials & Auto-Logging (Excel Automation)
- [x] **[Task 3.1] Database Update for Finance** ✅
    - ✅ Added `price_per_session` (INT, default 0) column to `profiles` table
    - ✅ Created `attendance_logs` table with:
        - `id` (UUID, primary key)
        - `user_id` (UUID, foreign key to profiles)
        - `check_in_at` (TIMESTAMP WITH TIME ZONE, default NOW())
        - `session_price_snapshot` (INT, stores price at time of check-in)
    - ✅ Enabled RLS for `attendance_logs`:
        - Admins can SELECT all logs
        - Users can SELECT only their own logs
        - INSERT handled by function (SECURITY DEFINER)
    - ✅ Updated `check_in_user` RPC function:
        - Now performs TWO actions in transaction:
          1. Decrements `remaining_sessions` from profiles
          2. INSERTs record into `attendance_logs` with price snapshot
        - Returns JSON with attendance details
        - Atomic transaction ensures data consistency
    - ✅ Added indexes for performance optimization
    - ✅ Included verification and revenue calculation queries

- [x] **[Task 3.2] Admin - Session Charge UI Update** ✅
    - ✅ **Unified Workflow (Final Implementation)**:
        - Single section: "세션 추가 및 단가 설정" (Add Sessions & Set Price)
        - Two input fields in one form:
          1. "Sessions to Add" - Number of sessions to add
          2. "Unit Price (KRW)" - Price per session (defaults to current price)
        - Single button: "ADD SESSIONS & UPDATE PRICE"
        - Single database operation updates both fields simultaneously
    - ✅ State Management:
        - `addAmount` - Number of sessions to add
        - `priceInput` - Unit price (initialized with current `price_per_session`)
        - `loading` - Single loading state for the operation
    - ✅ UI Features:
        - "Current Price" display showing formatted price
        - Labeled input fields with placeholders
        - Full-width yellow button
        - Helper text about auto-logging
    - ✅ Logic (`handleAddSession`):
        - Validates both inputs (sessions and price)
        - Confirmation dialog shows both values
        - Single UPDATE query: `{ remaining_sessions, price_per_session }`
        - Success alert: "완료! • X회 추가 • 단가: Y원"
        - Clears session input, refreshes data
    - ✅ Use Case:
        - Client renewal: Admin sets new volume + new price in one action
        - Example: Add 20 sessions at 60,000원 → Both updated atomically

- [ ] **[Task 3.3] Admin - Revenue Dashboard (Salary Calculation)**
    - Create a new View `AdminRevenue`.
    - Logic:
        - Calculate `Total PT Revenue`: Sum of `session_price_snapshot` from `attendance_logs` for the current month.
        - Calculate `Total Salary`: `Base Salary (500,000)` + `Total PT Revenue`.
    - UI: Display a clean summary card matching the user's Excel "Sheet 2".

## 📚 Phase 4: Knowledge Base (CMS)
- [x] **[Task 4.1] Knowledge Database** ✅
    - ✅ Created `posts` table with schema:
        - `id` (UUID, primary key)
        - `title` (TEXT, required)
        - `content` (TEXT, required - supports plain text or markdown)
        - `category` (TEXT, required)
        - `image_url` (TEXT, optional)
        - `created_at` (TIMESTAMP WITH TIME ZONE)
        - `updated_at` (TIMESTAMP WITH TIME ZONE, auto-updates on edit)
    - ✅ RLS Policies:
        - SELECT: All authenticated users can view posts
        - INSERT/UPDATE/DELETE: Only admins can manage posts
    - ✅ Created indexes for performance (category, created_at)
    - ✅ Auto-update trigger for `updated_at` column
    - ✅ Included sample data (3 posts) for testing

- [x] **[Task 4.2] Knowledge UI (Canvas Style)** ✅
    - ✅ **User View (`KnowledgeBase` component)**:
        - Card Grid layout (responsive: 1 col mobile, 2 cols desktop)
        - Premium Black & Gold theme matching app design
        - Card features:
          - Image (if available) with hover zoom effect
          - Category badge (yellow with background)
          - Title (bold, gold color, line-clamp-2)
          - Content snippet (first 100 chars + "...")
          - Date in Korean format
        - Empty state with BookOpen icon
        - Click card to view full content in modal
    - ✅ **Admin Features (CMS)**:
        - Floating Action Button (FAB) in bottom-right corner
        - "+" button opens editor modal
        - Editor form with 4 inputs:
          - Title (text input)
          - Category (text input)
          - Image URL (text input, optional)
          - Content (textarea, 200px min height)
        - "SAVE POST" and "CANCEL" buttons
        - Insert new post to database on save
        - Edit existing posts (click card → Edit button)
        - Delete posts (click card → Delete button with confirmation)
        - Success/error alerts
    - ✅ **Post Detail Modal**:
        - Full-screen modal with image header
        - Category badge and title
        - Full content display (whitespace preserved)
        - Admin: Edit and Delete buttons
        - Users: Close button only
        - Click outside to close
    - ✅ **Navigation**:
        - "LIBRARY" button in ClientHome
        - "LIBRARY" button in AdminHome
        - Accessible to all authenticated users

## ✅ Completed (Do not touch)
- [x] Auth & Profile Setup
- [x] Admin QR Scan & Check-in (Basic)
- [x] Booking System (Admin & Client)