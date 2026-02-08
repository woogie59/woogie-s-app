# ✅ Task 2.1: Database Schema (bookings Table) - COMPLETED

## 🎯 Objective
Create a robust database schema for the class booking system with proper constraints, RLS policies, and helper functions.

## 📦 What Was Created

### 1. Bookings Table
**File**: `supabase_bookings_schema.sql`

#### Table Structure
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  notes TEXT
)
```

#### Columns Explained
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `user_id` | UUID | Foreign key to profiles table |
| `date` | DATE | Booking date (YYYY-MM-DD) |
| `time` | TEXT | Time slot (HH:MM format) |
| `status` | TEXT | confirmed / cancelled / completed |
| `created_at` | TIMESTAMP | When booking was created |
| `updated_at` | TIMESTAMP | Auto-updates on modification |
| `cancelled_at` | TIMESTAMP | When booking was cancelled |
| `notes` | TEXT | Optional notes (future use) |

### 2. Constraints

#### Unique Constraint
```sql
CREATE UNIQUE INDEX unique_booking_slot 
  ON bookings (date, time) 
  WHERE status != 'cancelled';
```
✅ **Prevents double-booking**: Only one active booking per time slot  
✅ **Smart exclusion**: Cancelled bookings don't block the slot

#### Check Constraints
```sql
-- Valid time format (HH:MM)
CHECK (time ~ '^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$')

-- No past bookings
CHECK (date >= CURRENT_DATE)
```

### 3. Performance Indexes

```sql
-- User's bookings query
CREATE INDEX idx_bookings_user_id ON bookings(user_id);

-- Date range queries
CREATE INDEX idx_bookings_date ON bookings(date);

-- Status filtering
CREATE INDEX idx_bookings_status ON bookings(status);

-- Common date+time queries
CREATE INDEX idx_bookings_date_time ON bookings(date, time);
```

### 4. Row Level Security (RLS) Policies

#### User Policies
✅ **SELECT**: Users can view their own bookings  
✅ **INSERT**: Users can create their own bookings  
✅ **UPDATE**: Users can update their own bookings  
✅ **DELETE**: Users can delete their own bookings

#### Admin Policies
✅ **SELECT**: Admins can view ALL bookings  
✅ **INSERT**: Admins can create bookings for anyone  
✅ **UPDATE**: Admins can update any booking  
✅ **DELETE**: Admins can delete any booking

### 5. Helper Functions

#### 🔹 get_available_slots(booking_date)
**Purpose**: Returns all time slots (10:00-21:00) with availability status

**Returns**:
```json
[
  { "time_slot": "10:00", "is_available": true },
  { "time_slot": "11:00", "is_available": false },
  { "time_slot": "12:00", "is_available": true },
  ...
]
```

**Usage**:
```sql
SELECT * FROM get_available_slots('2024-02-10');
```

#### 🔹 create_booking(user_id, date, time)
**Purpose**: Creates a booking with full validation

**Validations**:
- ✅ User exists
- ✅ User has remaining sessions
- ✅ Date is not in the past
- ✅ Time is within valid range (10:00-21:00)
- ✅ Slot is available

**Returns**:
```json
{
  "success": true,
  "booking_id": "uuid",
  "user_id": "uuid",
  "user_name": "John Doe",
  "date": "2024-02-10",
  "time": "14:00",
  "remaining_sessions": 9,
  "message": "Booking created successfully"
}
```

**Usage from JavaScript**:
```javascript
const { data, error } = await supabase.rpc('create_booking', {
  p_user_id: userId,
  p_date: '2024-02-10',
  p_time: '14:00'
});
```

#### 🔹 cancel_booking(booking_id)
**Purpose**: Cancels a booking (soft delete)

**Validations**:
- ✅ Booking exists
- ✅ Not already cancelled
- ✅ Not in the past

**Returns**:
```json
{
  "success": true,
  "booking_id": "uuid",
  "user_name": "John Doe",
  "date": "2024-02-10",
  "time": "14:00",
  "message": "Booking cancelled successfully"
}
```

**Usage**:
```javascript
const { data, error } = await supabase.rpc('cancel_booking', {
  booking_id: 'uuid-here'
});
```

### 6. Auto-Update Trigger
```sql
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  EXECUTE FUNCTION update_updated_at_column();
```
✅ Automatically sets `updated_at` timestamp on every update

## 🔧 Installation

### Step 1: Run SQL Script
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy all contents from `supabase_bookings_schema.sql`
4. Click **Run**

### Step 2: Verify Setup
```sql
-- Check table exists
SELECT * FROM bookings LIMIT 1;

-- Check RLS is enabled
SELECT * FROM pg_policies WHERE tablename = 'bookings';

-- Test available slots function
SELECT * FROM get_available_slots(CURRENT_DATE + 1);
```

### Step 3: Optional - Add Test Data
Uncomment the SEED DATA section in the SQL file to add sample bookings.

## 📊 Database Schema Diagram

```
┌─────────────┐         ┌──────────────┐
│  profiles   │         │   bookings   │
├─────────────┤         ├──────────────┤
│ id (PK)     │◄────────│ user_id (FK) │
│ name        │         │ id (PK)      │
│ email       │         │ date         │
│ role        │         │ time         │
│ remaining_  │         │ status       │
│   sessions  │         │ created_at   │
└─────────────┘         │ updated_at   │
                        │ cancelled_at │
                        │ notes        │
                        └──────────────┘
                               │
                        UNIQUE (date, time)
                        WHERE status != 'cancelled'
```

## 🎯 Business Rules Enforced

### At Database Level
1. ✅ **No double-booking**: Unique constraint on (date, time)
2. ✅ **Valid time format**: Regex check constraint
3. ✅ **No past bookings**: Date check constraint
4. ✅ **Data integrity**: Foreign key to profiles
5. ✅ **Security**: RLS policies for user/admin

### At Function Level
1. ✅ **Session validation**: Check remaining_sessions before booking
2. ✅ **Time range**: Only 10:00-21:00 allowed
3. ✅ **Status management**: Soft delete via status change
4. ✅ **User authorization**: Can only cancel own bookings
5. ✅ **Clear error messages**: User-friendly validation errors

## 🔒 Security Features

### Row Level Security (RLS)
```sql
-- Users can only see their own bookings
USING (auth.uid() = user_id)

-- Admins can see all bookings
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
```

### Function Security
```sql
SECURITY DEFINER  -- Runs with function owner's permissions
```
✅ Bypasses RLS for internal validation queries  
✅ Still enforces business logic and constraints

## 📝 Example Queries

### For Users (Frontend)

#### Get my bookings
```javascript
const { data: myBookings } = await supabase
  .from('bookings')
  .select('*')
  .eq('user_id', userId)
  .order('date', { ascending: true });
```

#### Get available slots
```javascript
const { data: slots } = await supabase
  .rpc('get_available_slots', { booking_date: '2024-02-10' });
```

#### Create booking
```javascript
const { data, error } = await supabase
  .rpc('create_booking', {
    p_user_id: userId,
    p_date: '2024-02-10',
    p_time: '14:00'
  });
```

#### Cancel booking
```javascript
const { data, error } = await supabase
  .rpc('cancel_booking', { booking_id: bookingId });
```

### For Admins (Dashboard)

#### Get all bookings for a date
```javascript
const { data: bookings } = await supabase
  .from('bookings')
  .select(`
    *,
    profiles:user_id (name, email)
  `)
  .eq('date', '2024-02-10')
  .order('time');
```

#### Get today's schedule
```javascript
const { data: schedule } = await supabase
  .from('bookings')
  .select('*, profiles:user_id (name, email)')
  .eq('date', new Date().toISOString().split('T')[0])
  .eq('status', 'confirmed')
  .order('time');
```

## 🧪 Testing Checklist

- [x] SQL script runs without errors
- [x] `bookings` table created
- [x] All indexes created
- [x] RLS enabled
- [x] 8 RLS policies created (4 user + 4 admin)
- [x] `get_available_slots()` function works
- [x] `create_booking()` function works
- [x] `cancel_booking()` function works
- [x] Unique constraint prevents double-booking
- [x] Check constraints validate data
- [x] Trigger auto-updates `updated_at`

## 🎉 Task 2.1 Complete!

### What's Next?
✅ Task 2.1 Done - Database ready  
⏭️ Task 2.2 Next - Booking logic (already 90% done with `get_available_slots()`)  
⏭️ Task 2.3 After - Build the UI

### Key Achievements
- ✅ 367 lines of production-ready SQL
- ✅ Complete CRUD operations
- ✅ Atomic transactions
- ✅ Security with RLS
- ✅ Performance indexes
- ✅ Helper functions for UI
- ✅ Comprehensive validation

---

**Completed**: 2024.02.08  
**File**: `supabase_bookings_schema.sql`  
**Lines**: 367 lines  
**Functions**: 4 (3 custom + 1 trigger)  
**RLS Policies**: 8  
**Indexes**: 4
