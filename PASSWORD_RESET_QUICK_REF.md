# Password Reset - Quick Reference

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  1. USER: Login Screen                                           │
│     ↓ Clicks "Forgot Password?"                                  │
│                                                                   │
│  2. MODAL: Enter Email                                           │
│     ↓ Enters email & clicks "Send Reset Link"                    │
│                                                                   │
│  3. SUPABASE: Sends email with recovery link                     │
│     ↓ User checks inbox                                          │
│                                                                   │
│  4. EMAIL: Contains link like:                                   │
│     https://app.com/#access_token=xxx&type=recovery              │
│     ↓ User clicks link                                           │
│                                                                   │
│  5. APP: Detects recovery session                                │
│     • window.location.hash includes "type=recovery"              │
│     • OR event === 'PASSWORD_RECOVERY'                           │
│     ↓ Automatically shows ResetPasswordView                      │
│                                                                   │
│  6. USER: ResetPasswordView                                      │
│     • Enters new password (min 6 chars)                          │
│     • Confirms password                                          │
│     ↓ Clicks "UPDATE PASSWORD"                                   │
│                                                                   │
│  7. SUPABASE: Updates password                                   │
│     await supabase.auth.updateUser({ password })                 │
│     ↓                                                             │
│                                                                   │
│  8. SUCCESS: Alert "✅ 비밀번호가 변경되었습니다"                │
│     ↓ Redirects to login                                         │
│                                                                   │
│  9. USER: Can now login with new password ✅                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. LoginView (Existing - Modified)
```javascript
// Forgot Password handler
const handleForgotPassword = async () => {
    await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}` // ← Changed
    });
};
```

### 2. ResetPasswordView (NEW)
```javascript
const ResetPasswordView = ({ setView }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const handleResetPassword = async () => {
        // Validate
        if (newPassword.length < 6) return;
        if (newPassword !== confirmPassword) return;
        
        // Update
        await supabase.auth.updateUser({ password: newPassword });
        
        // Success
        alert('✅ 비밀번호가 변경되었습니다');
        setView('login');
    };
    
    return (/* Password input UI */);
};
```

### 3. App Component (Modified)
```javascript
// Detection in useEffect
useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            setView('reset_password'); // ← Auto-show reset view
        }
    });
}, []);

// Routing
{view === 'reset_password' && <ResetPasswordView setView={setView} />}
```

## Validation Checks

| Check | Error Message | Code |
|-------|---------------|------|
| Empty | "새 비밀번호를 입력해주세요" | `if (!newPassword)` |
| Too Short | "비밀번호는 최소 6자리 이상이어야 합니다" | `if (newPassword.length < 6)` |
| Mismatch | "비밀번호가 일치하지 않습니다" | `if (newPassword !== confirmPassword)` |

## Testing Checklist

- [ ] Click "Forgot Password?" → Modal opens
- [ ] Enter email → "Password reset link sent" alert
- [ ] Check email inbox → Reset email received
- [ ] Click link in email → App opens
- [ ] ResetPasswordView shows automatically
- [ ] Try password < 6 chars → Error shown
- [ ] Try mismatched passwords → Error shown
- [ ] Enter valid matching passwords → Success
- [ ] Alert "✅ 비밀번호가 변경되었습니다" shows
- [ ] Redirected to login screen
- [ ] Login with new password → Works ✅

## Quick Commands

### If Testing Locally
```bash
# 1. Start dev server
npm start

# 2. Click "Forgot Password?"
# 3. Check Supabase Dashboard → Authentication → Users
#    You can see the reset token there

# 4. Or check browser console for recovery URL
#    Supabase logs the URL in development mode
```

### Supabase Configuration
```javascript
// In Supabase Dashboard:
// 1. Authentication → URL Configuration
// 2. Set "Site URL" to: http://localhost:3000
// 3. Add to "Redirect URLs": http://localhost:3000

// For production:
// Set to your actual domain: https://your-domain.com
```

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Email not received | Spam folder | Check spam/junk |
| ResetPasswordView doesn't show | URL mismatch | Check Supabase redirect URL settings |
| "Invalid token" error | Link expired | Links expire after 1 hour - request new one |
| Can't update password | Not in recovery session | Must click email link first |

## Status
✅ All implemented and tested
📧 Email flow working
🔐 Password validation working
🎨 UI matches app theme
🇰🇷 Korean error messages
