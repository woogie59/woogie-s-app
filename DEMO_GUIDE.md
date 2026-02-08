# 🎬 Task 1.3 Demo Guide

## How to Test the Complete Check-in System

### 🧑 User Journey (Regular Member)

#### Step 1: Login as User
```
Email: your-user@example.com
Password: your-password
```

#### Step 2: View ClientHome
- See your name in header
- See remaining sessions count (bottom-left)
- See large QR button in center

#### Step 3: Open QR Modal
1. Click the **"CHECK-IN"** button (center)
2. Modal appears with animation
3. See:
   - Your UUID (long string)
   - Your name
   - Remaining sessions count
   - Instructions in Korean

#### Step 4: Show to Admin
- Keep modal open
- Show screen to admin/trainer
- Admin will scan or read your UUID

#### Step 5: Close Modal
Choose any method:
- Click **X** (top-right)
- Click **CLOSE** button (bottom)
- Click outside the modal (dark area)

---

### 👨‍💼 Admin Journey (Trainer/Manager)

#### Step 1: Login as Admin
```
Username: admin
Password: 1234
```

#### Step 2: Open QR Scanner
1. See AdminHome screen
2. Click **"QR SCAN"** button (center)

#### Step 3: Find User
**Option A: Scroll**
- Scroll through user list
- Each card shows name, email, session count

**Option B: Search**
- Type in search bar (top)
- Filter by name or email
- Results update in real-time

#### Step 4: Check-in User
1. Click user's card
2. Confirm dialog appears
3. Click **"확인"** (Confirm)
4. See success modal:
   - ✅ Green checkmark
   - User's name
   - "Check-in successful"
   - Updated session count

#### Step 5: Verify
- User list automatically refreshes
- User's session count is now -1
- If sessions = 0, card is disabled (red)

---

## 🔄 Complete Workflow Test

### Scenario: New Member Check-in

**Starting State:**
- User "John Doe" has 10 sessions

**Step-by-Step:**

1. **User Side** (Mobile/Screen 1):
   ```
   Login → ClientHome → Click QR Button → Show UUID
   ```

2. **Admin Side** (Tablet/Screen 2):
   ```
   Login (admin/1234) → QR Scanner → Search "John" → Click card
   ```

3. **Confirm Check-in**:
   ```
   Admin sees: "John Doe님을 체크인 하시겠습니까?"
   Admin clicks: "확인"
   ```

4. **Success**:
   ```
   Admin sees: 
     ✅ Check-in successful
     Remaining: 9
   
   User refreshes:
     Bottom-left now shows: "9 Sessions"
   ```

5. **Verification in Database**:
   ```sql
   -- In Supabase SQL Editor:
   SELECT * FROM profiles WHERE name = 'John Doe';
   -- remaining_sessions should be 9
   
   SELECT * FROM check_ins WHERE user_id = '[John's UUID]' ORDER BY checked_in_at DESC LIMIT 1;
   -- Should show latest check-in
   ```

---

## 🎨 UI Elements to Notice

### ClientHome QR Modal
- **Color scheme**: Black modal, yellow borders, white QR box
- **Typography**: Font-serif for numbers, font-mono for UUID
- **Spacing**: Generous padding, clear hierarchy
- **Icons**: QrCode (large), X (close), Sparkles (info)

### Admin QR Scanner
- **Search bar**: Magnifying glass icon, real-time filter
- **User cards**: 
  - Available: White text, green checkmark, clickable
  - Depleted: Red text, X icon, disabled
- **Success modal**: Green theme, large checkmark, session count
- **Info footer**: Sticky at bottom, helpful tip

---

## ⚠️ Edge Cases Covered

### User Side
- ✅ Profile not loaded yet → Shows "Loading..."
- ✅ Sessions = 0 → Still shows QR (admin will see error)
- ✅ Network error → Shows error in console

### Admin Side
- ✅ No users found → Shows empty state with icon
- ✅ Search no results → Shows "No users found"
- ✅ Sessions = 0 → Card disabled, can't click
- ✅ Check-in fails → Red error modal with message
- ✅ Network error → Error caught and displayed

---

## 📊 What Gets Updated

### After Successful Check-in:

| Location | What Changes |
|----------|-------------|
| `profiles` table | `remaining_sessions` -1 |
| `check_ins` table | New row inserted |
| Admin UI | User list refreshes, count updates |
| User UI | Session count updates (after refresh) |
| Success modal | Shows new count |

---

## 🐛 Troubleshooting

### "Function not found" error
→ Run `supabase_check_in_function.sql` in Supabase SQL Editor

### User's QR modal shows "Loading..."
→ Check browser console for errors, verify Supabase connection

### Admin can't see users
→ Verify users have `role = 'user'` in profiles table

### Check-in button does nothing
→ Check browser console, verify RPC function permissions

### Modal won't close
→ Click outside modal area or use X/CLOSE buttons

---

## 🎉 Success Indicators

You know it's working when:
- ✅ User clicks QR → Modal opens smoothly
- ✅ UUID displays correctly (long string)
- ✅ Admin searches → Results filter instantly
- ✅ Admin clicks user → Confirm dialog appears
- ✅ After confirm → Green success modal
- ✅ Session count decrements by 1
- ✅ User list refreshes automatically
- ✅ Database has new check_ins row

---

**Phase 1 Status: 100% Complete** 🎊

Next up: **Phase 2 - Class Booking System**
