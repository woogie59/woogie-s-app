# 🔧 Black Screen Fix - Admin Login Issue

## Problem
When logging in with admin credentials (`admin` / `1234`), the app showed a black screen because:
- The LoginView set `view` to `'admin_home'` without creating a Supabase session
- All admin views (AdminHome, MemberList, MemberDetail, Scanner) required `session && view === 'xxx'`
- Since `session` was null, no components rendered → black screen

## Solution
Modified the conditional rendering logic in the App component's return statement:

### Before (Lines 260-285):
```javascript
{/* 관리자 화면 */}
{session && view === 'admin_home' && (
  <AdminRoute session={session}>
    <AdminHome setView={setView} logout={handleLogout} />
  </AdminRoute>
)}
```
❌ **Problem**: Required `session` to be truthy

### After:
```javascript
{/* 관리자 화면 (session 없이도 접근 가능 - admin backdoor) */}
{view === 'admin_home' && (
  <AdminRoute session={session}>
    <AdminHome setView={setView} logout={handleLogout} />
  </AdminRoute>
)}
```
✅ **Fixed**: Only checks `view`, allows access without session

## Changes Made

### File: `src/App.jsx` (Lines 243-291)

**Removed `session &&` from:**
1. ✅ `admin_home` view (Line 259)
2. ✅ `member_list` view (Line 266)
3. ✅ `member_detail` view (Line 273)
4. ✅ `scanner` view (Line 280)

**Kept `session &&` for:**
- ✅ `client_home` view (Line 257) - Regular users need Supabase auth

## Flow Diagram

```
Admin Login Flow:
┌─────────────────┐
│ Login: admin/1234│
└────────┬────────┘
         │
         v
┌─────────────────┐
│ setView('admin_home')│  ← No Supabase session created
└────────┬────────┘
         │
         v
┌─────────────────┐
│ view === 'admin_home' ?│  ← NEW: No session check
└────────┬────────┘
         │ YES
         v
┌─────────────────┐
│ Render AdminHome│  ✅ Success!
└─────────────────┘
```

## Testing Checklist

- [x] Login with `admin` / `1234` → AdminHome renders
- [x] Click "QR SCAN" → Scanner renders
- [x] Click "CLIENT LIST" → MemberList renders
- [x] Click on a member → MemberDetail renders
- [x] Click back buttons → Navigation works
- [x] Logout → Returns to login screen
- [x] No linter errors

## Additional Notes

### AdminRoute Component
The `AdminRoute` wrapper (Lines 671-679) currently:
- Always returns `true` for `isAdmin` (hardcoded)
- Accepts null `session` parameter
- This allows the admin backdoor to work without Supabase auth

### Future Improvements
If you want to add real admin authentication:
1. Create an `isAdminLoggedIn` state in App component
2. Set it to `true` when admin backdoor is used
3. Check this state in AdminRoute instead of hardcoding `true`
4. Reset it in `handleLogout`

Example:
```javascript
const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

// In LoginView handleLogin:
if (email === 'admin' && pw === '1234') {
  setIsAdminLoggedIn(true);
  setView('admin_home');
  return;
}

// In handleLogout:
setIsAdminLoggedIn(false);
await supabase.auth.signOut();
setView('login');

// In AdminRoute:
const isAdmin = session?.user?.role === 'admin' || isAdminLoggedIn;
```

## Result
✅ Admin backdoor (`admin`/`1234`) now works correctly
✅ All admin views render without Supabase session
✅ Navigation between admin views works
✅ Logout properly returns to login screen
