# 🚀 Quick Reference: Task 3.1 Finance Schema

## SQL File Location
`/Users/woogie/Desktop/the coach/update_finance_schema.sql`

---

## What It Does

Adds financial tracking to check-in system:
1. ✅ Adds `price_per_session` column to profiles
2. ✅ Creates `attendance_logs` table
3. ✅ Updates `check_in_user` function to log with price snapshot
4. ✅ Sets up RLS policies

---

## Quick Setup

### 1. Run SQL Script
```bash
# In Supabase Dashboard → SQL Editor
# Copy and paste contents of update_finance_schema.sql
# Click "Run"
```

### 2. Set Sample Prices
```sql
-- Set $50.00 per session for all users
UPDATE profiles 
SET price_per_session = 5000 
WHERE role = 'user';
```

### 3. Test Check-In
```sql
-- Get a user ID
SELECT id, name FROM profiles WHERE role = 'user' LIMIT 1;

-- Check in (replace with actual UUID)
SELECT check_in_user('USER_UUID_HERE');
```

### 4. View Logs
```sql
SELECT 
  al.*,
  p.name,
  p.email
FROM attendance_logs al
JOIN profiles p ON al.user_id = p.id
ORDER BY check_in_at DESC;
```

---

## Key Tables

### profiles (Updated)
```
├── price_per_session (INT) ← NEW!
│   └── Default: 0
│   └── Example: 5000 = $50.00
```

### attendance_logs (New)
```
├── id (UUID)
├── user_id (UUID) → profiles.id
├── check_in_at (TIMESTAMP)
└── session_price_snapshot (INT)
```

---

## Key Queries

### Total Revenue
```sql
SELECT SUM(session_price_snapshot) / 100.0 as revenue_dollars
FROM attendance_logs;
```

### Monthly Revenue
```sql
SELECT 
  DATE_TRUNC('month', check_in_at) as month,
  SUM(session_price_snapshot) / 100.0 as revenue_dollars
FROM attendance_logs
GROUP BY month
ORDER BY month DESC;
```

### Revenue by User
```sql
SELECT 
  p.name,
  COUNT(al.id) as check_ins,
  SUM(al.session_price_snapshot) / 100.0 as spent_dollars
FROM attendance_logs al
JOIN profiles p ON al.user_id = p.id
GROUP BY p.name
ORDER BY spent_dollars DESC;
```

---

## Updated check_in_user Function

**Input**: `user_uuid` (UUID)

**Output**: JSON
```json
{
  "success": true,
  "user_name": "John Doe",
  "remaining_sessions": 9,
  "session_price": 5000,
  "attendance_id": "uuid",
  "checked_in_at": "timestamp",
  "message": "Check-in successful"
}
```

**Process**:
1. Lock user row
2. Validate sessions > 0
3. Decrement sessions
4. Insert attendance log with price snapshot
5. Return success JSON

---

## RLS Policies

| Who | Can View |
|-----|----------|
| Admin | All attendance logs |
| User | Only their own logs |
| Anonymous | Nothing |

---

## Price Format

**Storage**: Cents (INT)
- `5000` = $50.00
- `10000` = $100.00
- `7500` = $75.00

**Display** (in UI):
```javascript
const priceInDollars = (priceInCents / 100).toFixed(2);
// 5000 → "50.00"
```

**Input** (from UI):
```javascript
const priceInCents = Math.round(priceInDollars * 100);
// 50.00 → 5000
```

---

## Verification Checklist

- [ ] `price_per_session` column exists in profiles
- [ ] `attendance_logs` table exists
- [ ] Check-in creates log entry
- [ ] Price snapshot is recorded correctly
- [ ] Admin can view all logs
- [ ] User can view only own logs
- [ ] Revenue queries return correct sums

---

## Common Commands

### Check Schema
```sql
-- Verify price_per_session column
\d profiles

-- Verify attendance_logs table
\d attendance_logs
```

### Set User Price
```sql
UPDATE profiles 
SET price_per_session = 5000 
WHERE id = 'USER_UUID';
```

### View Recent Check-Ins
```sql
SELECT * FROM attendance_logs 
ORDER BY check_in_at DESC 
LIMIT 10;
```

### Calculate Today's Revenue
```sql
SELECT SUM(session_price_snapshot) / 100.0 as today_revenue
FROM attendance_logs
WHERE DATE(check_in_at) = CURRENT_DATE;
```

---

## Integration Notes

### No Frontend Changes Required
The existing `QRScanner` component will work without modification because:
- Function signature is unchanged: `check_in_user(user_uuid)`
- Return value is enhanced (backward compatible)

### Optional Enhancements (Task 3.2)
- Display `session_price` in success modal
- Show user's `price_per_session` in MemberDetail
- Allow admin to update price when adding sessions

---

## Next Task Preview

**Task 3.2**: Admin Session Charge UI Update
- Add price input in MemberDetail
- Allow setting price when adding sessions
- Display current price for each user

**Task 3.3**: Admin Revenue Dashboard
- Calculate total PT revenue
- Display salary calculation
- Match Excel "Sheet 2" format

---

## 🎉 Task 3.1 Status: COMPLETE

All database changes implemented and ready for frontend integration!
