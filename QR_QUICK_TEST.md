# QR Scanner Quick Test Guide

## 🚀 Quick Test (5 minutes)

### Step 1: Open Scanner
```
Admin Login → QR CODE button → Camera starts
```

### Step 2: Check Console (F12)
**Look for:**
```
✅ Camera started successfully - fps: 30, qrbox: 300x300
```

**If you DON'T see this:**
- Camera failed to start
- Check browser console for red errors
- Grant camera permission

### Step 3: Test with Any QR Code
Use a simple test QR:
1. Go to: https://www.qr-code-generator.com/
2. Type: "TEST123"
3. Generate QR code
4. Scan it with your phone

**Expected Result:**
```
Browser Alert: "✅ 인식됨: TEST123"
```

**If alert appears:** ✅ Scanner is working! QR detection successful.

**If no alert:** ❌ Scanner not detecting. See troubleshooting below.

### Step 4: Check Console Output
When QR detected, you should see:
```
═══════════════════════════════════════
🎯 RAW QR DATA: TEST123
📦 Result Object: {...}
═══════════════════════════════════════
⏸️ Stopping scanner to prevent double-scan...
```

**If you see this:** ✅ Scanner callback is firing correctly!

### Step 5: Test with Real Member QR
1. Login as member (different device/browser)
2. Click QR icon to show their UUID
3. Scan it with admin device

**Expected:**
- Alert: "✅ 인식됨: [UUID string]"
- RPC call executes
- Success modal shows member name

---

## 🔍 Console Log Cheat Sheet

### Good Logs (Everything Working)
```
✅ Camera started successfully - fps: 30, qrbox: 300x300
🎯 RAW QR DATA: [detected content]
⏸️ Stopping scanner to prevent double-scan...
🔄 Calling RPC: check_in_user with UUID: ...
✅ RPC Success: { remaining: 15 }
👤 User Name: 김민수
📳 Vibration triggered
🔊 Success beep played
✅ Success modal displayed
```

### Bad Logs (Problems)
```
❌ Camera start error: NotAllowedError
   → Grant camera permission

❌ Camera start error: NotReadableError
   → Close other apps using camera

⚠️ QR Scan Error (non-routine): ...
   → Camera/focus issue

❌ RPC Error: invalid input syntax for type uuid
   → Scanned wrong QR code (not a member UUID)

❌ Check-in error: No remaining sessions
   → Expected error, shows red modal
```

---

## ⚡ Quick Fixes

### Camera Won't Start
**Check:**
1. Browser permission (green camera icon in address bar?)
2. HTTPS connection (camera needs secure context)
3. Another tab/app using camera? Close it.

**Try:**
```
1. Refresh page (F5)
2. Clear site data (browser settings)
3. Try different browser (Chrome works best)
```

### QR Not Detected (Camera Works But No Alert)
**Check:**
1. QR code size (should be at least 3cm x 3cm)
2. Distance (10-20cm from camera)
3. Lighting (avoid shadows on QR)
4. Focus (tap screen if blurry)

**Try:**
```
1. Hold phone steady for 2 seconds
2. Move closer/farther
3. Increase screen brightness (if scanning from screen)
4. Print QR code on paper (better contrast)
```

### Alert Shows But Check-in Fails
**Check Console For:**
```
❌ RPC Error: No remaining sessions
   → Member needs to buy sessions

❌ RPC Error: invalid input syntax
   → Wrong QR code (not a member's UUID)

Network error / Timeout
   → Check internet connection
```

---

## 📊 Performance Benchmarks

### Ideal Performance
```
Camera Start:     < 1 second
QR Detection:     < 1 second (within 0.5s typically)
RPC Call:         < 500ms
Modal Display:    Instant
Total Time:       < 2 seconds (scan to modal)
```

### If Slower Than This
- Old device (expected)
- Slow network (RPC delay)
- Low light (camera struggles to focus)

---

## 🎯 Success Criteria

Before removing debug alert, verify:

✅ Alert pops up when scanning ANY QR code  
✅ Console shows "🎯 RAW QR DATA: ..."  
✅ Success modal appears for valid member  
✅ Error modal appears for invalid/no sessions  
✅ Camera restarts after 3 seconds  
✅ Can scan multiple members in a row  

---

## 🗑️ Remove Debug Alert (After Testing)

**File:** `App.jsx`  
**Line:** ~1359

**Delete this line:**
```javascript
window.alert("✅ 인식됨: " + decodedText);
```

**Keep all console.log() statements** for future debugging.

---

## 📱 Testing Matrix

| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| Scan test QR "HELLO" | Alert: "✅ 인식됨: HELLO" | ☐ |
| Scan member UUID | Check-in success, modal shows name | ☐ |
| Scan member (0 sessions) | Error modal: "잔여 세션이 없습니다" | ☐ |
| Scan invalid QR | Error modal with message | ☐ |
| Scan 3 members in a row | All succeed, camera restarts each time | ☐ |
| Close modal early (tap outside) | Modal closes, camera restarts | ☐ |

---

## 🆘 Emergency Rollback

If new settings cause issues, revert to old config:

**File:** `App.jsx`, `startCamera()` function

**Change:**
```javascript
// From:
fps: 30,
qrbox: 300,
aspectRatio: 1.0,
disableFlip: false

// Back to:
fps: 10,
qrbox: { width: 250, height: 250 }
```

---

## 📞 Support Checklist

When asking for help, provide:

1. **Console logs** (copy all red errors)
2. **Browser & OS** (e.g., "Chrome 120 on Android 13")
3. **What QR you scanned** (test QR vs member QR)
4. **What you saw** (alert? modal? nothing?)
5. **Screenshot** of console when scanning

---

## Status
- ✅ Scanner speed: 30 FPS
- ✅ Scan area: 300x300px
- ✅ Debug alert: Active (temporary)
- ✅ Console logging: Comprehensive
- ⏳ Testing phase: Remove alert after verification

**Next Step:** Test with real QR codes, then remove debug alert.
