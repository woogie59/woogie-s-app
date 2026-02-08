# Task 3.1 Complete: Database Update for Finance

## ✅ Implementation Summary

Task 3.1 adds financial tracking capabilities to the check-in system by storing session prices and logging all attendance with price snapshots.

---

## 🎯 What Was Built

### 1. Added `price_per_session` to `profiles` Table

**Purpose**: Store the price (in cents or base currency unit) that each user pays per session.

**Column Details**:
```sql
ALTER TABLE profiles 
ADD COLUMN price_per_session INT DEFAULT 0;
```

- **Type**: `INT` (stores price in cents, e.g., 5000 = $50.00)
- **Default**: `0` (no price set initially)
- **Use Case**: Each user can have a different session price (e.g., premium packages, discounts)

**Why Cents?**
- Avoids floating-point precision issues
- Standard practice for financial data
- Easy to format in UI: `price / 100` → `"$50.00"`

---

### 2. Created `attendance_logs` Table

**Purpose**: Log every check-in with a snapshot of the session price at that moment.

**Schema**:
```sql
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  check_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_price_snapshot INT NOT NULL
);
```

**Fields**:
- `id` - Unique identifier for each check-in
- `user_id` - Who checked in (foreign key to profiles)
- `check_in_at` - Exact timestamp of check-in
- `session_price_snapshot` - Price at the time of check-in

**Why "Snapshot"?**
If a user's `price_per_session` changes (e.g., package upgrade), we still know the historical price for past sessions. This is crucial for accurate revenue tracking.

**Example**:
```javascript
// User A checks in on Feb 1 (price: $40)
{ user_id: "uuid-a", check_in_at: "2026-02-01", session_price_snapshot: 4000 }

// Admin increases User A's price to $50 on Feb 5

// User A checks in on Feb 10 (new price: $50)
{ user_id: "uuid-a", check_in_at: "2026-02-10", session_price_snapshot: 5000 }

// Revenue calculation: $40 + $50 = $90 (accurate!)
```

---

### 3. RLS Policies for `attendance_logs`

**Policy 1: Admins can view all logs**
```sql
CREATE POLICY "Admins can view all attendance logs"
  ON attendance_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

**Policy 2: Users can view only their own logs**
```sql
CREATE POLICY "Users can view own attendance logs"
  ON attendance_logs
  FOR SELECT
  USING (auth.uid() = user_id);
```

**No INSERT Policy**: Insert is handled by the `check_in_user` function (which has `SECURITY DEFINER`), so no direct INSERT policy is needed.

---

### 4. Updated `check_in_user` RPC Function

**Old Behavior**:
- Decremented `remaining_sessions`
- Inserted into old `check_ins` table (basic logging)

**New Behavior**:
- ✅ Decrements `remaining_sessions`
- ✅ Inserts into `attendance_logs` with price snapshot
- ✅ Returns JSON with attendance details
- ✅ Atomic transaction (all or nothing)

**Function Signature**:
```sql
CREATE OR REPLACE FUNCTION check_in_user(user_uuid UUID)
RETURNS JSON
```

**Process Flow**:
```
1. Lock user row (FOR UPDATE)
2. Fetch: remaining_sessions, name, price_per_session
3. Validate: user exists, sessions > 0
4. Update: remaining_sessions = remaining_sessions - 1
5. Insert: attendance_logs (user_id, NOW(), price_snapshot)
6. Return: JSON with success and details
```

**Return Value**:
```json
{
  "success": true,
  "user_id": "uuid",
  "user_name": "John Doe",
  "remaining_sessions": 9,
  "session_price": 5000,
  "attendance_id": "uuid",
  "checked_in_at": "2026-02-10T14:30:00Z",
  "message": "Check-in successful"
}
```

**On Error**:
```json
{
  "success": false,
  "error": "No remaining sessions",
  "message": "Check-in failed: No remaining sessions"
}
```

---

## 📋 Database Schema Diagram

```
profiles
├── id (UUID, PK)
├── name (TEXT)
├── email (TEXT)
├── remaining_sessions (INT)
├── price_per_session (INT) ← NEW!
└── ...

attendance_logs ← NEW TABLE!
├── id (UUID, PK)
├── user_id (UUID, FK → profiles.id)
├── check_in_at (TIMESTAMP)
└── session_price_snapshot (INT)
```

**Relationship**: 
- One profile → Many attendance logs
- `ON DELETE CASCADE`: If user deleted, their logs are deleted too

---

## 🔒 Security & RLS

### RLS Enforcement

| Action | Admin | User | Anonymous |
|--------|-------|------|-----------|
| SELECT all logs | ✅ Yes | ❌ No | ❌ No |
| SELECT own logs | ✅ Yes | ✅ Yes | ❌ No |
| INSERT logs | 🔧 Via function | 🔧 Via function | ❌ No |
| UPDATE logs | ❌ No | ❌ No | ❌ No |
| DELETE logs | ❌ No | ❌ No | ❌ No |

**Note**: Attendance logs are immutable (no UPDATE/DELETE) for audit integrity.

### Function Security

The `check_in_user` function uses `SECURITY DEFINER`:
```sql
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner's privileges
```

This allows it to INSERT into `attendance_logs` even though users don't have direct INSERT permission.

---

## 📊 Revenue Tracking Queries

### Total Revenue

```sql
SELECT 
  SUM(session_price_snapshot) as total_revenue_cents,
  COUNT(*) as total_check_ins,
  AVG(session_price_snapshot) as avg_price_per_session
FROM attendance_logs;
```

**Example Output**:
```
total_revenue_cents | total_check_ins | avg_price_per_session
--------------------|-----------------|----------------------
        250000      |       50        |       5000
  ($2,500.00)       |                 |      ($50.00)
```

### Revenue by User

```sql
SELECT 
  p.name,
  p.email,
  COUNT(al.id) as total_check_ins,
  SUM(al.session_price_snapshot) as total_spent_cents,
  AVG(al.session_price_snapshot) as avg_price_per_session
FROM attendance_logs al
JOIN profiles p ON al.user_id = p.id
GROUP BY p.id, p.name, p.email
ORDER BY total_spent_cents DESC;
```

**Example Output**:
```
name       | email           | total_check_ins | total_spent_cents | avg_price
-----------|-----------------|-----------------|-------------------|----------
John Doe   | john@email.com  |       12        |      60000        |   5000
Jane Smith | jane@email.com  |       8         |      40000        |   5000
```

### Monthly Revenue

```sql
SELECT 
  DATE_TRUNC('month', check_in_at) as month,
  COUNT(*) as check_ins,
  SUM(session_price_snapshot) as revenue_cents
FROM attendance_logs
GROUP BY month
ORDER BY month DESC;
```

**Example Output**:
```
month      | check_ins | revenue_cents
-----------|-----------|---------------
2026-02-01 |    20     |   100000
2026-01-01 |    30     |   150000
```

### Today's Revenue

```sql
SELECT 
  COUNT(*) as check_ins_today,
  SUM(session_price_snapshot) as revenue_today_cents
FROM attendance_logs
WHERE DATE(check_in_at) = CURRENT_DATE;
```

---

## 🧪 Testing Guide

### Step 1: Run the SQL Script

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `update_finance_schema.sql`
3. Run the script
4. Verify no errors

### Step 2: Verify Schema Changes

```sql
-- Check if price_per_session column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'price_per_session';

-- Expected: price_per_session | integer | 0

-- Check attendance_logs table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance_logs';

-- Expected: id, user_id, check_in_at, session_price_snapshot
```

### Step 3: Set Sample Prices

```sql
-- Update existing users with sample prices
UPDATE profiles 
SET price_per_session = 5000  -- $50.00
WHERE role = 'user';

-- Verify
SELECT id, name, email, remaining_sessions, price_per_session 
FROM profiles 
WHERE role = 'user';
```

### Step 4: Test Check-In Function

```sql
-- Get a user ID (replace with actual UUID)
SELECT id, name, remaining_sessions, price_per_session 
FROM profiles 
WHERE role = 'user' 
LIMIT 1;

-- Test check-in (replace USER_UUID_HERE)
SELECT check_in_user('USER_UUID_HERE');

-- Expected: JSON with success=true, remaining_sessions decremented
```

### Step 5: Verify Attendance Log Created

```sql
-- View attendance logs with user info
SELECT 
  al.id,
  al.check_in_at,
  al.session_price_snapshot,
  p.name,
  p.email,
  p.remaining_sessions
FROM attendance_logs al
JOIN profiles p ON al.user_id = p.id
ORDER BY al.check_in_at DESC
LIMIT 5;

-- Should show the check-in you just created
```

### Step 6: Test Revenue Query

```sql
-- Calculate total revenue
SELECT 
  SUM(session_price_snapshot) / 100.0 as total_revenue_dollars,
  COUNT(*) as total_check_ins
FROM attendance_logs;

-- Should show at least 1 check-in with correct price
```

### Step 7: Test RLS Policies

**Admin View (if logged in as admin)**:
```javascript
// In browser console
const { data, error } = await supabase
  .from('attendance_logs')
  .select('*, profiles(name, email)');

console.log(data); // Should see all logs
```

**User View (if logged in as regular user)**:
```javascript
// In browser console
const { data, error } = await supabase
  .from('attendance_logs')
  .select('*');

console.log(data); // Should see only their own logs
```

---

## 🔄 Integration with Existing System

### Current QRScanner Component

**Location**: `src/App.jsx` - `QRScanner` component

**Current Behavior**:
```javascript
const { data, error } = await supabase.rpc('check_in_user', {
  user_uuid: userId
});
```

**After Task 3.1**:
- ✅ Function signature is the same (`check_in_user(user_uuid)`)
- ✅ No frontend changes needed for basic functionality
- ✅ Return value now includes `session_price` and `attendance_id`

**Optional Enhancement** (for Task 3.2):
```javascript
// Access new data in success modal
if (data.success) {
  setResult({
    success: true,
    userName: data.user_name,
    remainingSessions: data.remaining_sessions,
    sessionPrice: data.session_price,  // NEW!
    attendanceId: data.attendance_id,  // NEW!
    message: data.message
  });
}
```

---

## 💡 Use Cases

### 1. Variable Pricing
```sql
-- Student discount
UPDATE profiles SET price_per_session = 3000 WHERE email LIKE '%@student.edu';

-- Premium package
UPDATE profiles SET price_per_session = 7000 WHERE id = 'premium_user_uuid';
```

### 2. Revenue Reporting
- Monthly revenue dashboards
- Income forecasting
- Trainer performance tracking (in Phase 3, Task 3.3)

### 3. Audit Trail
- Historical price changes don't affect past revenue calculations
- Complete check-in history with exact prices paid

### 4. Tax Reporting
- Export attendance logs for tax purposes
- Accurate income tracking by month/quarter/year

---

## 🐛 Common Issues & Solutions

### Issue 1: Function Returns NULL

**Symptom**: `SELECT check_in_user(...)` returns `NULL`

**Cause**: User not found or no sessions remaining

**Solution**: Check the error in the returned JSON:
```sql
SELECT check_in_user('USER_UUID')::jsonb->>'error';
```

### Issue 2: RLS Policy Blocks Admin

**Symptom**: Admin cannot view attendance logs

**Cause**: Admin doesn't have `role = 'admin'` in profiles table

**Solution**:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@thecoach.com';
```

### Issue 3: Price is Always 0

**Symptom**: `session_price_snapshot` is always 0 in logs

**Cause**: `price_per_session` not set in profiles

**Solution**:
```sql
UPDATE profiles 
SET price_per_session = 5000  -- Set appropriate price
WHERE role = 'user';
```

### Issue 4: Foreign Key Violation

**Symptom**: Cannot create attendance log - foreign key error

**Cause**: `user_id` doesn't exist in profiles table

**Solution**: Ensure user exists before check-in:
```sql
SELECT id, name FROM profiles WHERE id = 'USER_UUID';
```

---

## 📈 Performance Considerations

### Indexes Created

1. **`idx_attendance_logs_user_id`**: Fast user-specific queries
2. **`idx_attendance_logs_check_in_at`**: Fast date-range queries
3. **`idx_attendance_logs_user_date`**: Fast combined queries

### Query Performance

| Query | Expected Time | Optimized For |
|-------|---------------|---------------|
| Check-in (single) | <50ms | Transaction atomic |
| Revenue (all time) | <100ms | Full table scan OK |
| Revenue (by user) | <50ms | Indexed on user_id |
| Revenue (by month) | <100ms | Indexed on check_in_at |

### For Large Datasets (>10,000 logs)

Consider:
- Materialized views for monthly aggregates
- Partitioning by month
- Archiving old logs (>1 year)

---

## 🚀 Next Steps

### Task 3.2: Admin Session Charge UI Update
- Update `MemberDetail` component
- Allow admin to set/update `price_per_session` when adding sessions
- UI: "Add 10 sessions at $50.00/session"

### Task 3.3: Admin Revenue Dashboard
- Create `AdminRevenue` component
- Calculate total PT revenue from `attendance_logs`
- Display: Base Salary + PT Revenue = Total Salary
- Match Excel "Sheet 2" format

---

## ✅ Task 3.1 Checklist

- [x] Added `price_per_session` column to profiles table
- [x] Created `attendance_logs` table with proper schema
- [x] Added foreign key relationship with CASCADE
- [x] Created 3 performance indexes
- [x] Enabled RLS on attendance_logs
- [x] Created admin SELECT policy
- [x] Created user SELECT policy (own logs only)
- [x] Updated `check_in_user` function to:
  - [x] Fetch price_per_session
  - [x] Insert into attendance_logs
  - [x] Return enhanced JSON response
- [x] Added SECURITY DEFINER for function
- [x] Included verification queries
- [x] Included revenue calculation queries
- [x] Added sample data setup
- [x] Created comprehensive documentation

---

## 🎉 Task 3.1 Complete!

The database now supports full financial tracking:

- ✅ Session prices stored per user
- ✅ Every check-in logged with price snapshot
- ✅ Historical accuracy maintained
- ✅ Revenue queries ready
- ✅ RLS security enforced
- ✅ Atomic transactions guaranteed

**Ready for Task 3.2: UI implementation!** 🚀
