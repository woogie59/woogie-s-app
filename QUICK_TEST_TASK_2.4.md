# 🧪 Quick Test Guide: Task 2.4

## Setup (One-Time)

1. **Verify Foreign Key** (in Supabase SQL Editor):
```sql
SELECT * FROM information_schema.table_constraints 
WHERE table_name = 'bookings' AND constraint_type = 'FOREIGN KEY';
```
Should see: `bookings_user_id_fkey`

2. **Create Test Data**:
```sql
-- Ensure you have at least 2 test users in profiles table
SELECT id, name, email FROM profiles WHERE role = 'user' LIMIT 2;
```

---

## Test 1: Client Books Classes

1. Login as a regular user (not admin)
2. Click "CLASS BOOKING"
3. Select today's date
4. Book 3 different time slots (e.g., 10:00, 14:00, 18:00)
5. Verify success modals appear

---

## Test 2: Client Views My Schedule

1. From ClientHome, click "MY SCHEDULE"
2. **Expected**: Modal opens showing your 3 bookings
3. **Check**:
   - ✅ All 3 bookings visible
   - ✅ Dates and times correct
   - ✅ "Booked on" timestamp shown
   - ✅ Trash icon appears on each

---

## Test 3: Client Cancels Booking

1. In My Schedule modal, click trash icon on one booking
2. Confirm the dialog
3. **Expected**:
   - ✅ Success alert: "Booking cancelled successfully!"
   - ✅ Booking disappears from list
   - ✅ Only 2 bookings remain

4. Verify in database:
```sql
SELECT * FROM bookings WHERE user_id = 'YOUR_USER_ID';
-- Should show only 2 bookings now
```

---

## Test 4: Admin Views All Schedules

1. Logout
2. Login as admin (admin / 1234)
3. From AdminHome, click "SCHEDULE"
4. **Expected**:
   - ✅ See ALL bookings from all users
   - ✅ Each booking shows user name AND email
   - ✅ Bookings sorted by date, then time
   - ✅ Trash icon on each booking

**Example Display**:
```
John Doe
john@example.com
📅 2026-02-10  🕐 14:00  [🗑️]

Jane Smith  
jane@example.com
📅 2026-02-10  🕐 18:00  [🗑️]
```

---

## Test 5: Verify Join Query Works

Open browser console and run:

```javascript
const { data, error } = await supabase
  .from('bookings')
  .select('*, profiles(name, email)')
  .limit(1);

console.log('Booking:', data[0]);
console.log('User Name:', data[0].profiles.name);
console.log('User Email:', data[0].profiles.email);
```

**Expected Output**:
```javascript
Booking: {
  id: "uuid",
  user_id: "uuid",
  date: "2026-02-10",
  time: "14:00",
  created_at: "...",
  profiles: {
    name: "John Doe",
    email: "john@example.com"
  }
}
User Name: "John Doe"
User Email: "john@example.com"
```

---

## Test 6: Admin Cancels User Booking (May Fail - Expected)

1. As admin, in Schedule view, click trash on any booking
2. Confirm dialog

**Scenario A**: Admin using backdoor (admin/1234)
- ❌ **May fail** with RLS error
- **Why**: No `auth.uid()` for backdoor login
- **Fix**: See solution below

**Scenario B**: Admin logged in via Supabase Auth
- ✅ **Works** if Policy 4 is enabled
- ❌ **Fails** if Policy 4 is disabled (admin can only delete own bookings)

### Solution: Enable Admin Override

Run this SQL in Supabase:

```sql
CREATE POLICY "Admins can delete any booking"
  ON bookings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

Then:
1. Create a real admin account in Supabase Auth
2. Set their `role = 'admin'` in profiles table:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@thecoach.com';
```
3. Logout and login with the real admin account
4. Try cancelling again → Should work

---

## Test 7: RLS Security Check

1. Login as User A
2. Book a class (note the booking ID)
3. Login as User B
4. Open browser console and try to delete User A's booking:

```javascript
// Replace with actual booking ID from User A
const { error } = await supabase
  .from('bookings')
  .delete()
  .eq('id', 'USER_A_BOOKING_ID');

console.log(error);
```

**Expected**: 
```
Error: new row violates row-level security policy for table "bookings"
```

✅ This confirms users cannot delete each other's bookings!

---

## Test 8: Empty States

### Client Empty State
1. Login as user
2. Cancel ALL your bookings
3. Open "MY SCHEDULE" again
4. **Expected**:
   - 📅 Calendar icon
   - "No Bookings"
   - "You haven't booked any classes yet"

### Admin Empty State
1. As admin, go to Schedule view
2. If no bookings exist in database:
   - 📅 Calendar icon
   - "No Bookings"
   - "No scheduled classes yet"

---

## Common Issues & Quick Fixes

### Issue: `profiles` is undefined

**Check in console**:
```javascript
const { data } = await supabase
  .from('bookings')
  .select('*, profiles(name, email)')
  .limit(1);

console.log(data[0].profiles); // Should NOT be undefined
```

**If undefined**:
```sql
-- Add/verify foreign key
ALTER TABLE bookings 
ADD CONSTRAINT fk_bookings_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
```

### Issue: Modal doesn't open

**Check**:
1. Open DevTools → Console
2. Click "MY SCHEDULE"
3. Look for errors

**Common fix**: Refresh the page

### Issue: Can't cancel booking

**Check RLS policies**:
```sql
SELECT * FROM pg_policies WHERE tablename = 'bookings';
```

Should see 3 policies:
- `Users can create own bookings`
- `Authenticated users can view all bookings`
- `Users can delete own bookings`

---

## Success Criteria ✅

- [x] Client can view their own bookings
- [x] Client can cancel their own bookings
- [x] Admin can view ALL bookings with user names
- [x] User names appear correctly (not undefined)
- [x] Bookings sorted by date, then time
- [x] Trash icons appear and are clickable
- [x] Confirmation dialogs work
- [x] Success alerts appear
- [x] Lists refresh after deletion
- [x] Empty states display correctly
- [x] RLS prevents users from deleting others' bookings

---

## 🎉 If All Tests Pass

Task 2.4 is complete and working correctly!

**Next**: Move on to Phase 3 or implement optional enhancements.
