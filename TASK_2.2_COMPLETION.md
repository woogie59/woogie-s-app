# ✅ Task 2.2: Booking Logic (Backend) - COMPLETED

## 🎯 Objective
Create backend functions to fetch available time slots and enforce 1-hour intervals (10:00 - 21:00).

## ✅ Already Implemented in Task 2.1!

The booking logic was fully implemented as part of the database schema in Task 2.1. Here's what we have:

### 1. Available Time Slots Function ✅

**Function**: `get_available_slots(booking_date DATE)`

**What it does**:
- Generates all 1-hour time slots from 10:00 to 21:00
- Checks which slots are already booked
- Returns each slot with availability status
- Excludes cancelled bookings from the check

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION get_available_slots(booking_date DATE)
RETURNS TABLE(time_slot TEXT, is_available BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  WITH time_slots AS (
    SELECT to_char(generate_series(
      '10:00'::time,
      '21:00'::time,
      '1 hour'::interval
    ), 'HH24:MI') AS slot
  ),
  booked_slots AS (
    SELECT time
    FROM bookings
    WHERE date = booking_date
      AND status != 'cancelled'
  )
  SELECT 
    ts.slot AS time_slot,
    (bs.time IS NULL) AS is_available
  FROM time_slots ts
  LEFT JOIN booked_slots bs ON ts.slot = bs.time
  ORDER BY ts.slot;
END;
$$ LANGUAGE plpgsql;
```

**Returns**:
```json
[
  { "time_slot": "10:00", "is_available": true },
  { "time_slot": "11:00", "is_available": false },  // Already booked
  { "time_slot": "12:00", "is_available": true },
  { "time_slot": "13:00", "is_available": true },
  { "time_slot": "14:00", "is_available": false },  // Already booked
  { "time_slot": "15:00", "is_available": true },
  { "time_slot": "16:00", "is_available": true },
  { "time_slot": "17:00", "is_available": true },
  { "time_slot": "18:00", "is_available": true },
  { "time_slot": "19:00", "is_available": true },
  { "time_slot": "20:00", "is_available": true },
  { "time_slot": "21:00", "is_available": true }
]
```

### 2. Time Interval Enforcement ✅

**Hard-coded 1-hour intervals**:
```sql
generate_series(
  '10:00'::time,
  '21:00'::time,
  '1 hour'::interval    // ← 1-hour intervals
)
```

**Time slots generated**:
- 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00, 20:00, 21:00
- Total: **12 slots per day**

### 3. Booking Validation ✅

**Function**: `create_booking(user_id, date, time)`

**Time range validation**:
```sql
-- Check if time slot is valid (10:00-21:00)
IF p_time < '10:00' OR p_time > '21:00' THEN
  RAISE EXCEPTION 'Invalid time slot. Available times: 10:00 - 21:00';
END IF;
```

**Additional validations**:
- ✅ User exists
- ✅ User has remaining sessions
- ✅ Date is not in the past
- ✅ Time is within 10:00-21:00
- ✅ Slot is available (not already booked)

## 📊 How It Works

### Flow Diagram
```
User selects date (e.g., 2024-02-10)
         ↓
Call get_available_slots('2024-02-10')
         ↓
Function generates all slots (10:00-21:00)
         ↓
Function checks bookings table for that date
         ↓
Returns 12 slots with availability status
         ↓
UI disables booked slots
         ↓
User selects available slot
         ↓
Call create_booking(user_id, date, time)
         ↓
Validates all rules
         ↓
Creates booking OR returns error
```

## 🎯 Requirements Met

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Fetch available time slots | ✅ | `get_available_slots()` function |
| Exclude existing bookings | ✅ | JOIN with booked_slots CTE |
| Enforce 1-hour intervals | ✅ | `generate_series()` with 1 hour |
| Time range 10:00-21:00 | ✅ | Hard-coded in function |
| Prevent double-booking | ✅ | Unique constraint + validation |

## 🧪 Testing

### Test 1: Get Available Slots
```javascript
const { data, error } = await supabase.rpc('get_available_slots', {
  booking_date: '2024-02-10'
});

console.log(data);
// Expected: Array of 12 slots with availability
```

### Test 2: Create Booking (Valid Time)
```javascript
const { data, error } = await supabase.rpc('create_booking', {
  p_user_id: userId,
  p_date: '2024-02-10',
  p_time: '14:00'  // Valid: within 10:00-21:00
});

console.log(data.success);  // true
```

### Test 3: Create Booking (Invalid Time)
```javascript
const { data, error } = await supabase.rpc('create_booking', {
  p_user_id: userId,
  p_date: '2024-02-10',
  p_time: '09:00'  // Invalid: before 10:00
});

console.log(error.message);
// "Invalid time slot. Available times: 10:00 - 21:00"
```

### Test 4: Double-Booking Prevention
```javascript
// First booking
await supabase.rpc('create_booking', {
  p_user_id: user1,
  p_date: '2024-02-10',
  p_time: '14:00'
});

// Second booking (same slot)
const { error } = await supabase.rpc('create_booking', {
  p_user_id: user2,
  p_date: '2024-02-10',
  p_time: '14:00'  // Same slot!
});

console.log(error.message);
// "Time slot already booked. Please choose another time."
```

## 💡 Design Decisions

### Why 1-hour intervals?
- ✅ Standard for personal training sessions
- ✅ Easy to understand for users
- ✅ Prevents scheduling conflicts
- ✅ Allows 12 sessions per day (10:00-21:00)

### Why 10:00-21:00?
- ✅ Typical gym operating hours
- ✅ Accommodates morning (10:00-12:00)
- ✅ Accommodates afternoon (13:00-17:00)
- ✅ Accommodates evening (18:00-21:00)
- ✅ 12 slots = reasonable capacity

### Why soft delete (status change)?
- ✅ Keeps booking history
- ✅ Allows analytics (cancellation rate)
- ✅ Can restore if needed
- ✅ Audit trail for disputes

## 🔄 Integration with UI

### For Task 2.3 (Booking UI):

#### Step 1: Fetch available slots
```javascript
const slots = await supabase.rpc('get_available_slots', {
  booking_date: selectedDate
});
```

#### Step 2: Render time slot grid
```javascript
slots.forEach(slot => {
  <Button
    disabled={!slot.is_available}
    onClick={() => bookSlot(slot.time_slot)}
  >
    {slot.time_slot}
  </Button>
});
```

#### Step 3: Create booking
```javascript
const handleBooking = async (time) => {
  const { data, error } = await supabase.rpc('create_booking', {
    p_user_id: user.id,
    p_date: selectedDate,
    p_time: time
  });
  
  if (data.success) {
    alert('Booking confirmed!');
  }
};
```

## 🎉 Task 2.2 Complete!

### Summary
- ✅ Available slots function implemented
- ✅ 1-hour intervals enforced
- ✅ Time range 10:00-21:00 set
- ✅ Double-booking prevention
- ✅ Full validation logic
- ✅ Ready for UI integration

### What's Next?
✅ Task 2.1 Done - Database schema  
✅ Task 2.2 Done - Booking logic (you are here)  
⏭️ Task 2.3 Next - Build the booking UI

---

**Status**: ✅ **COMPLETE** (implemented in Task 2.1)  
**Functions Created**: `get_available_slots()`, `create_booking()`, `cancel_booking()`  
**Time Slots**: 12 per day (10:00-21:00)  
**Interval**: 1 hour  
**Validation**: Complete
