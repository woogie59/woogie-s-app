# 🚀 THE COACH - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Database Setup (2 minutes)
```bash
# 1. Open Supabase Dashboard
# 2. Go to SQL Editor
# 3. Copy + Paste + Run these files in order:

✅ supabase_check_in_function.sql
✅ supabase_bookings_schema.sql
```

### Step 2: Verify Database (1 minute)
```sql
-- Run these queries in SQL Editor:

-- Check tables exist
SELECT * FROM profiles LIMIT 1;
SELECT * FROM check_ins LIMIT 1;
SELECT * FROM bookings LIMIT 1;

-- Test functions
SELECT * FROM get_available_slots(CURRENT_DATE + 1);
```

### Step 3: Run the App (2 minutes)
```bash
# Terminal:
npm install
npm run dev

# Browser:
# Open http://localhost:5173
```

---

## 🧪 Quick Test

### Test 1: User Flow (2 minutes)
1. Register new account
2. Login
3. Click QR button → See UUID
4. Click "CLASS BOOKING"
5. Select tomorrow
6. Book a time slot
7. See success modal ✅

### Test 2: Admin Flow (2 minutes)
1. Login as admin (admin/1234)
2. Click "QR SCAN"
3. Search for user
4. Click to check-in
5. See success modal ✅
6. Go to "CLIENT LIST"
7. Click member → Add sessions ✅

---

## 🎯 Key Features

### Users Can:
- ✅ Register & Login
- ✅ Show QR for check-in
- ✅ Book classes (7-day calendar)
- ✅ View remaining sessions

### Admins Can:
- ✅ Login (admin/1234)
- ✅ Scan QR (check-in users)
- ✅ View all members
- ✅ Add session packs
- ✅ View member details

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main application (859 lines) |
| `supabase_check_in_function.sql` | Check-in system DB |
| `supabase_bookings_schema.sql` | Booking system DB |
| `MASTER_SUMMARY.md` | Complete overview |
| `DEMO_GUIDE.md` | Testing instructions |

---

## 🐛 Troubleshooting

### "Function not found"
→ Run SQL files in Supabase SQL Editor

### Black screen after login
→ Already fixed! Make sure you have the latest App.jsx

### Can't book classes
→ Check if user has remaining_sessions > 0

### Slots not loading
→ Verify `get_available_slots()` function exists

---

## 🎊 You're All Set!

**The Coach** is ready to use! 🏋️‍♀️

**Quick Demo**:
1. Login as user
2. Book a class
3. Login as admin (admin/1234)
4. Check-in the user
5. Verify session count decreased

**Status**: ✅ Production Ready  
**Features**: ✅ All Implemented  
**Documentation**: ✅ Complete  
**Testing**: ✅ Verified  

**Enjoy your premium gym management system! 💪**
