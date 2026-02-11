# Quick Test: Password Reset Flow

## Open Browser Console (F12) First!

The console will show exactly what's happening.

---

## Test Flow

### 1️⃣ Request Reset
```
Login Screen
  ↓ Click "Forgot Password?"
  ↓ Enter email
  ↓ Click "Send Reset Link"
  ↓ Check email inbox
```

### 2️⃣ Click Email Link

**What You'll See in Console:**
```
Initial session check: {user: {...}}
🔐 PASSWORD RECOVERY DETECTED - Showing reset form
✅ ResetPasswordView mounted - User can now reset password
```

**What You'll See on Screen:**
```
┌─────────────────────────────┐
│           🔐                 │
│                             │
│     Reset Password          │
│  ENTER YOUR NEW PASSWORD    │
│                             │
│  New Password               │
│  [________________]         │
│                             │
│  Confirm Password           │
│  [________________]         │
│                             │
│  [UPDATE PASSWORD]          │
│                             │
│  ← Back to Login           │
│                             │
│  Recovery session active    │
└─────────────────────────────┘
```

### 3️⃣ Update Password

**Enter:**
- New password: `test123` (or any 6+ chars)
- Confirm: `test123` (must match)

**Click:** UPDATE PASSWORD

**Console Output:**
```
🔄 Starting password reset...
📝 Calling supabase.auth.updateUser...
✅ Password updated successfully: {user: {...}}
```

**Alert:**
```
✅ 비밀번호가 변경되었습니다
```

**Result:** Redirected to login screen

### 4️⃣ Login

Use the NEW password → Should work! ✅

---

## Troubleshooting

### ❌ Problem: Shows Dashboard Instead of Reset Form

**Console shows:**
```
Auth state change: SIGNED_IN
(No "PASSWORD RECOVERY DETECTED" message)
```

**Fix:**
1. Check Supabase Dashboard:
   - Settings → URL Configuration
   - Verify Site URL matches your app
   
2. Request new reset link
3. Try again

### ❌ Problem: "Invalid recovery token"

**Cause:** Link expired (> 1 hour old)

**Fix:** Request new reset link

### ❌ Problem: Alert shows "오류: ..."

**Check console for error details:**
```
❌ Password update error: {message: "..."}
```

Common errors:
- Password too short (< 6 chars)
- Recovery session expired
- Network error

---

## Expected Console Log Sequence

```
[Page Load]
1. Initial session check: null

[Click Email Link]
2. Initial session check: {user: {...}, access_token: "..."}
3. 🔐 PASSWORD RECOVERY DETECTED - Showing reset form
4. ✅ ResetPasswordView mounted - User can now reset password

[Enter Passwords & Click Update]
5. 🔄 Starting password reset...
6. 📝 Calling supabase.auth.updateUser...
7. ✅ Password updated successfully: {user: {...}}
8. Auth state change: SIGNED_OUT null

[Redirected to Login]
9. Auth state change: SIGNED_OUT null
```

If you see this sequence → **Everything is working perfectly!** ✅

---

## Visual Indicators

### Reset Form is Showing if You See:
1. ✅ 🔐 Icon at top
2. ✅ "Reset Password" heading
3. ✅ Two password input fields
4. ✅ "UPDATE PASSWORD" button
5. ✅ "Recovery session active" text at bottom

### You're on Wrong Screen if You See:
- ❌ Dashboard with session count
- ❌ QR code display
- ❌ Navigation buttons

---

## Quick Fix Checklist

If reset form doesn't show:

```bash
# 1. Check URL hash
console.log(window.location.hash)
# Should include: type=recovery

# 2. Check current view
console.log(view)
# Should be: "reset_password"

# 3. Force reset view (temporary debug)
setView('reset_password')
```

---

## Success Criteria

✅ Console shows "🔐 PASSWORD RECOVERY DETECTED"  
✅ Reset form appears with lock icon  
✅ Password update succeeds  
✅ Alert shows Korean success message  
✅ Redirects to login  
✅ Can login with new password

**If all ✅ → Implementation is correct!**
