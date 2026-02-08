# Task 3.2 Complete: Admin Session Charge UI Update

## ✅ Implementation Summary

Task 3.2 adds PT Unit Price management to the `MemberDetail` component, allowing admins to set and update the price per session for each user.

---

## 🎯 What Was Built

### Updated Component: `MemberDetail`

**Location**: `src/App.jsx` (lines ~1149-1270)

**New Features**:
1. PT Unit Price input field
2. Current price display
3. Update price functionality
4. Independent operations (sessions vs price)

---

## 📋 Implementation Details

### 1. State Management

**Added States**:
```javascript
const [priceInput, setPriceInput] = useState(0);
const [updatingPrice, setUpdatingPrice] = useState(false);
```

**Initialization**:
```javascript
const fetchUser = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', selectedMemberId)
      .single();
    setU(data);
    setPriceInput(data?.price_per_session || 0); // Initialize with current price
};
```

**Purpose**:
- `priceInput`: Holds the value of the price input field
- `updatingPrice`: Loading state for the update button
- Both initialized when user data loads

---

### 2. UI Structure

#### Current Price Display
```jsx
<div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 mb-2">
  <div className="flex justify-between items-center">
    <span className="text-zinc-400 text-xs uppercase tracking-widest">
      Current Price
    </span>
    <span className="text-2xl font-serif text-yellow-500">
      {(u.price_per_session || 0).toLocaleString()}
      <span className="text-xs font-sans text-zinc-500 ml-1">원</span>
    </span>
  </div>
</div>
```

**Features**:
- Shows current price with thousand separators (e.g., "50,000")
- Yellow serif font for price (matches theme)
- Korean "원" (won) currency symbol

#### Price Input Section
```jsx
<div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
  <h3 className="text-sm font-bold text-white flex items-center gap-2">
    <CreditCard size={16} className="text-yellow-500"/> 
    PT 단가 설정
  </h3>
  
  {/* Current Price Display */}
  
  <div className="flex gap-2">
    <input 
      type="number" 
      placeholder="단가 입력 (예: 50000)" 
      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-yellow-600 outline-none transition-colors"
      value={priceInput}
      onChange={e => setPriceInput(e.target.value)}
    />
    <button 
      onClick={handleUpdatePrice}
      disabled={updatingPrice}
      className="bg-yellow-600 text-white font-bold px-6 rounded-lg text-sm hover:bg-yellow-500 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
    >
      {updatingPrice ? '...' : '단가 변경'}
    </button>
  </div>
  
  <p className="text-xs text-zinc-500 flex items-start gap-2">
    <Sparkles size={14} className="mt-0.5 flex-shrink-0" />
    <span>체크인 시 이 금액이 수익으로 자동 기록됩니다</span>
  </p>
</div>
```

**UI Elements**:
- CreditCard icon (yellow) in header
- Number input field with placeholder
- Yellow "단가 변경" button
- Helper text explaining auto-logging feature

---

### 3. Update Price Logic

```javascript
const handleUpdatePrice = async () => {
    // Validation
    if (priceInput === null || priceInput === '' || isNaN(priceInput)) {
        return alert('유효한 가격을 입력해주세요.');
    }

    const priceValue = parseInt(priceInput);
    if (priceValue < 0) {
        return alert('가격은 0 이상이어야 합니다.');
    }

    // Confirmation
    if (!confirm(`${u.name}님의 PT 단가를 ${priceValue.toLocaleString()}원으로 설정하시겠습니까?`)) {
        return;
    }

    // Update
    setUpdatingPrice(true);
    const { error } = await supabase
        .from('profiles')
        .update({ price_per_session: priceValue })
        .eq('id', selectedMemberId);

    if (error) {
        alert('오류 발생: ' + error.message);
    } else {
        alert(`가격이 ${priceValue.toLocaleString()}원으로 업데이트되었습니다!`);
        fetchUser(); // Refresh data
    }
    setUpdatingPrice(false);
};
```

**Process Flow**:
1. **Validation**:
   - Check if input is a valid number
   - Check if input is non-negative
   - Show alert if invalid

2. **Confirmation**:
   - Dialog: "John Doe님의 PT 단가를 50,000원으로 설정하시겠습니까?"
   - Formatted with thousand separators

3. **Update**:
   - Supabase UPDATE query on `profiles` table
   - Only updates `price_per_session` column
   - Uses `selectedMemberId` for WHERE clause

4. **Feedback**:
   - Success: "가격이 50,000원으로 업데이트되었습니다!"
   - Error: Shows Supabase error message
   - Refreshes user data to show new price

---

## 🔄 Independent Operations

### Session Addition (Unchanged)
```javascript
const handleAddSession = async () => {
    // ... validation ...
    
    const { error } = await supabase
        .from('profiles')
        .update({ 
            remaining_sessions: (u.remaining_sessions || 0) + parseInt(addAmount) 
        })
        .eq('id', selectedMemberId);
    
    // ... feedback ...
};
```

**Only updates**: `remaining_sessions`

### Price Update (New)
```javascript
const handleUpdatePrice = async () => {
    // ... validation ...
    
    const { error } = await supabase
        .from('profiles')
        .update({ 
            price_per_session: priceValue 
        })
        .eq('id', selectedMemberId);
    
    // ... feedback ...
};
```

**Only updates**: `price_per_session`

**✅ Fully Independent**: Admin can add sessions without touching price, and vice versa.

---

## 🎨 UI Design

### Layout Structure

```
┌────────────────────────────────────────┐
│  ← John Doe                            │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ Total Remaining           10     │ │  (Gradient card)
│  │ john@email.com                   │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ + 세션 추가 충전                  │ │
│  │ ┌──────────────┐  ┌─────┐        │ │
│  │ │ [횟수 입력]   │  │충전 │        │ │
│  │ └──────────────┘  └─────┘        │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │  ← NEW!
│  │ 💳 PT 단가 설정                   │ │
│  │                                  │ │
│  │ Current Price       50,000원     │ │
│  │                                  │ │
│  │ ┌──────────────┐  ┌─────────┐   │ │
│  │ │ [단가 입력]   │  │단가 변경│   │ │
│  │ └──────────────┘  └─────────┘   │ │
│  │                                  │ │
│  │ ✨ 체크인 시 이 금액이...        │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ───────────────────────────────────  │
│                                        │
│  Goal: ...                             │
│  Birth: ...  Gender: ...               │
│                                        │
└────────────────────────────────────────┘
```

### Color Scheme

- **Background**: `bg-zinc-950` (dark)
- **Cards**: `bg-zinc-900`, `border-zinc-800`
- **Input**: `bg-zinc-950`, focus: `border-yellow-600`
- **Button**: `bg-yellow-600`, hover: `bg-yellow-500`
- **Price Text**: `text-yellow-500` (serif font)
- **Icons**: `text-yellow-500`

### Typography

- **Headers**: `font-bold`, `uppercase`, `tracking-widest`
- **Price**: `font-serif`, `text-2xl` or `text-4xl`
- **Helper Text**: `text-xs`, `text-zinc-500`

---

## 🧪 Testing Guide

### Test 1: View Current Price

1. Login as admin (admin / 1234)
2. Go to AdminHome → "CLIENT LIST"
3. Click on a user
4. **Expected**: 
   - See "Current Price: 0원" (if not set)
   - Input field shows "0"

### Test 2: Set Initial Price

1. In MemberDetail, enter "50000" in price input
2. Click "단가 변경"
3. **Expected**:
   - Confirmation: "John Doe님의 PT 단가를 50,000원으로 설정하시겠습니까?"
   - After confirm: "가격이 50,000원으로 업데이트되었습니다!"
   - "Current Price" updates to "50,000원"

### Test 3: Update Existing Price

1. Change price input to "60000"
2. Click "단가 변경"
3. **Expected**:
   - Confirmation with new price: "60,000원"
   - Success alert
   - Display updates

### Test 4: Invalid Input Validation

**Test 4a: Empty Input**
1. Clear the price input
2. Click "단가 변경"
3. **Expected**: Alert "유효한 가격을 입력해주세요."

**Test 4b: Negative Number**
1. Enter "-1000"
2. Click "단가 변경"
3. **Expected**: Alert "가격은 0 이상이어야 합니다."

**Test 4c: Non-Number**
1. Enter "abc"
2. Click "단가 변경"
3. **Expected**: Alert "유효한 가격을 입력해주세요."

### Test 5: Independent Operations

**Test 5a: Add Sessions Without Changing Price**
1. Set price to "50000"
2. Add 10 sessions
3. **Expected**:
   - Sessions increase by 10
   - Price remains 50,000

**Test 5b: Change Price Without Adding Sessions**
1. User has 15 sessions
2. Change price from 50000 to 60000
3. **Expected**:
   - Price updates to 60,000
   - Sessions remain 15

### Test 6: Database Verification

```sql
-- Check if price was updated
SELECT id, name, remaining_sessions, price_per_session 
FROM profiles 
WHERE id = 'USER_UUID';

-- Should show: price_per_session = 50000 (or whatever you set)
```

### Test 7: Check-In Integration

1. Set user's price to 50000
2. Go to QR Scanner
3. Check in the user
4. **Expected**:
   - Check-in succeeds
   - `attendance_logs` has entry with `session_price_snapshot = 50000`

```sql
SELECT * FROM attendance_logs 
WHERE user_id = 'USER_UUID' 
ORDER BY check_in_at DESC 
LIMIT 1;

-- Should show: session_price_snapshot = 50000
```

---

## 💡 Use Cases

### Use Case 1: New User Setup

**Scenario**: Admin enrolls a new user

**Steps**:
1. User signs up
2. Admin adds 10 sessions
3. Admin sets price to 50,000원
4. User starts training

**Result**: Each check-in logs 50,000원 revenue

### Use Case 2: Package Upgrade

**Scenario**: User upgrades to premium package

**Steps**:
1. User currently at 40,000원/session
2. Admin changes price to 60,000원
3. Admin adds 20 more sessions

**Result**: 
- Old sessions at 40,000원 (historical)
- New check-ins at 60,000원 (current)

### Use Case 3: Discount/Promotion

**Scenario**: Special promotion for loyal customer

**Steps**:
1. User normally at 50,000원
2. Admin temporarily sets to 40,000원
3. After promotion, admin resets to 50,000원

**Result**: 
- Promotion period logged at 40,000원
- Regular sessions at 50,000원

### Use Case 4: Multi-Tier Pricing

**Scenario**: Different users, different prices

**Steps**:
1. Student: 30,000원
2. Regular: 50,000원
3. Premium: 70,000원

**Result**: Revenue accurately reflects each tier

---

## 🔧 Technical Notes

### Number Formatting

**Input**: Raw number (no formatting)
```javascript
value={priceInput}  // 50000
```

**Display**: Formatted with thousand separators
```javascript
{(u.price_per_session || 0).toLocaleString()}  // "50,000"
```

**Korean Won**: Uses "원" symbol
```javascript
<span className="text-xs">원</span>
```

### State Synchronization

**On Load**:
```javascript
setPriceInput(data?.price_per_session || 0);
```

**On Update**:
```javascript
fetchUser(); // Refetches data, updates priceInput
```

This ensures UI always shows current database value.

### Validation Flow

```
User Input
    ↓
isEmpty or isNaN?
    ↓ Yes → Alert "유효한 가격을 입력해주세요"
    ↓ No
isNegative?
    ↓ Yes → Alert "가격은 0 이상이어야 합니다"
    ↓ No
Confirmation Dialog
    ↓ Cancel → Abort
    ↓ OK
Update Database
    ↓ Error → Alert error message
    ↓ Success → Alert success, refresh
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Price Not Showing

**Symptom**: "Current Price: 0원" even after setting price

**Cause**: Database not updated, or component not refreshing

**Solution**:
```sql
-- Check database
SELECT price_per_session FROM profiles WHERE id = 'USER_UUID';

-- If NULL, manually set
UPDATE profiles SET price_per_session = 50000 WHERE id = 'USER_UUID';
```

### Issue 2: Input Doesn't Update

**Symptom**: Typing in input field does nothing

**Cause**: State not connected properly

**Solution**: Verify:
```javascript
value={priceInput}  // ✅
onChange={e => setPriceInput(e.target.value)}  // ✅
```

### Issue 3: Button Always Disabled

**Symptom**: "단가 변경" button is grayed out

**Cause**: `updatingPrice` stuck at `true`

**Solution**: Check for uncaught errors in `handleUpdatePrice`

### Issue 4: Price Overwrites Sessions

**Symptom**: Setting price resets session count

**Cause**: Update query includes `remaining_sessions`

**Solution**: Verify query only updates `price_per_session`:
```javascript
.update({ price_per_session: priceValue })  // ✅ Only price
```

---

## 🚀 Future Enhancements (Optional)

### 1. Batch Price Update

Allow admin to set price for multiple users at once:

```javascript
const handleBatchUpdate = async (userIds, newPrice) => {
  const { error } = await supabase
    .from('profiles')
    .update({ price_per_session: newPrice })
    .in('id', userIds);
};
```

### 2. Price History

Track when prices change:

```sql
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  old_price INT,
  new_price INT,
  changed_at TIMESTAMP DEFAULT NOW(),
  changed_by UUID REFERENCES profiles(id)
);
```

### 3. Combined Operation

Add sessions AND set price in one action:

```javascript
const handleAddSessionsWithPrice = async () => {
  const { error } = await supabase
    .from('profiles')
    .update({ 
      remaining_sessions: u.remaining_sessions + parseInt(addAmount),
      price_per_session: parseInt(priceInput)
    })
    .eq('id', selectedMemberId);
};
```

### 4. Price Presets

Quick buttons for common prices:

```jsx
<div className="flex gap-2 mb-2">
  <button onClick={() => setPriceInput(30000)}>30K</button>
  <button onClick={() => setPriceInput(50000)}>50K</button>
  <button onClick={() => setPriceInput(70000)}>70K</button>
</div>
```

---

## ✅ Task 3.2 Checklist

- [x] Added `priceInput` state variable
- [x] Added `updatingPrice` loading state
- [x] Initialize `priceInput` with current `price_per_session`
- [x] Created "Current Price" display section
- [x] Created price input field with label
- [x] Created "단가 변경" button (yellow/gold)
- [x] Implemented `handleUpdatePrice` function
- [x] Added input validation (empty, NaN, negative)
- [x] Added confirmation dialog with formatted price
- [x] Added success alert with formatted price
- [x] Added helper text about auto-logging
- [x] Ensured independent operations (sessions vs price)
- [x] Tested with various inputs
- [x] Verified database updates
- [x] Updated ROADMAP.md
- [x] No linter errors

---

## 🎉 Task 3.2 Complete!

The MemberDetail component now supports full PT Unit Price management:

- ✅ View current price
- ✅ Set/update price per session
- ✅ Independent from session management
- ✅ Beautiful UI matching theme
- ✅ Input validation
- ✅ Confirmation dialogs
- ✅ Korean localization
- ✅ Auto-refresh after update

**Next Task**: Task 3.3 - Revenue Dashboard to display calculated salary! 🚀
