# Connection Status Implementation - Testing Guide

**Date**: November 17, 2025  
**Status**: READY FOR QA  
**Version**: 2.2

---

## Quick Test Checklist

- [ ] Database column `last_updated` exists on stations table
- [ ] API returns `last_updated` field in responses
- [ ] Connection status badge shows correctly for fresh data
- [ ] Connection status badge shows correctly for stale data
- [ ] Tab switching works without losing state
- [ ] Public stations view works
- [ ] User's own stations view works
- [ ] Badge styling (green/red) is correct
- [ ] Performance is acceptable
- [ ] No console errors

---

## Test Environment Setup

### Prerequisites
```bash
# 1. Navigate to project
cd c:\Users\Administrator\Desktop\kode\wapi_2

# 2. Verify Python environment
python --version

# 3. Install dependencies (if needed)
pip install -r requirements.txt

# 4. Start server
python runserver.py
```

**Expected Output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

---

## Test 1: Verify API Response Includes `last_updated`

### Steps
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Navigate to http://localhost:8000/
4. Filter network requests to `public`
5. Click on `/stations/public` request
6. Check **Response** tab

### Expected Result
```json
[
  {
    "station_id": 1,
    "location": "New York",
    "owner": "demo_user",
    "temperature": 22.5,
    "humidity": 65,
    "wind_speed": 12.3,
    "created_at": "2025-11-17T08:00:00",
    "last_updated": "2025-11-17T10:30:00",  ← Should be here
    "is_public": true
  }
]
```

### ✅ Passes If
- Response includes `last_updated` field
- Timestamp is in ISO format (YYYY-MM-DDTHH:MM:SS)
- All stations have a `last_updated` value

### ❌ Fails If
- Field is missing
- Field is null/empty
- Invalid timestamp format

---

## Test 2: Connection Status Badge - Fresh Data

### Setup
1. Create a station (or use existing one)
2. Send current data: POST `/stations/data` with current timestamp
3. Wait 2 seconds for response
4. Refresh page

### Steps
1. View public stations page
2. Look for the station you just updated
3. Check the connection status badge

### Expected Result
```
Badge: Green with "Connected" text
Badge Class: badge-connected
```

### ✅ Passes If
- Badge shows green color
- Badge text says "Connected"
- Badge appears in correct location on card

### ❌ Fails If
- Badge is red instead of green
- Badge text is wrong
- Badge is missing entirely

---

## Test 3: Connection Status Badge - Stale Data

### Setup (Manual Database Update)
1. Open database tool (SQL client or Django shell)
2. Find a test station ID
3. Run SQL:
```sql
UPDATE stations 
SET last_updated = NOW() - INTERVAL '3 hours'
WHERE station_id = <YOUR_STATION_ID>;
```

### Steps
1. Refresh the page
2. Look for the station you updated
3. Check the connection status badge

### Expected Result
```
Badge: Red with "Disconnected" text
Badge Class: badge-disconnected
```

### ✅ Passes If
- Badge shows red color
- Badge text says "Disconnected"
- Badge appears in correct location

### ❌ Fails If
- Badge is green instead of red
- Badge text is wrong
- Badge is missing entirely

---

## Test 4: Connection Status Badge - Never Connected

### Setup
1. Create a new station WITHOUT sending any data
2. Keep `last_updated` as null

### Steps
1. Refresh page
2. Look for the new station in public stations list
3. Check the connection status badge

### Expected Result
```
Badge: Red with "Never Connected" text
Badge Class: badge-disconnected
```

### ✅ Passes If
- Badge shows red color
- Badge text says "Never Connected"
- Badge appears without errors

### ❌ Fails If
- Badge text is wrong
- Badge is missing entirely
- Badge shows error in console

---

## Test 5: Real-Time Update Test

### Setup
1. Open two browser windows side-by-side
2. Window 1: Public stations page
3. Window 2: Ready to make API call
4. Identify a test station

### Steps
1. In Window 2, send data to station:
```bash
curl -X POST "http://localhost:8000/stations/data" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 23.5,
    "humidity": 70,
    "wind_speed": 15.2,
    "location": "Test Location"
  }'
```

2. Immediately look at Window 1
3. Refresh page or wait for auto-update

### Expected Result
- Badge updates to "Connected" (green)
- Timestamp in Network tab shows current time

### ✅ Passes If
- Badge updates correctly after data is sent
- No errors in console
- Response includes new timestamp

### ❌ Fails If
- Badge doesn't update
- Console shows errors
- API call fails

---

## Test 6: Tab Switching (Authenticated User)

### Setup
1. Login to application
2. Have at least one owned station
3. Have multiple public stations available

### Steps
1. Click on **"My Stations"** tab
2. Verify connection badges show correctly
3. Click on **"Public Stations"** tab
4. Verify connection badges show correctly
5. Switch back and forth 3 times

### Expected Result
- Badges display correctly in both tabs
- Tab content switches without errors
- No data loss or visual glitches

### ✅ Passes If
- Tab switching is smooth
- Both tabs show correct connection status
- No console errors
- All badges render properly

### ❌ Fails If
- Badge disappears in one tab
- Badges show incorrect status
- Console shows errors
- Tab switching is slow

---

## Test 7: UI/UX Test

### Steps
1. Navigate to public stations page (not logged in)
2. Observe all station cards
3. Check badge styling and positioning
4. Note any visual issues

### Expected Result
```
✓ Badges are visible and readable
✓ Badge colors are distinct (green vs red)
✓ Badge text is clear
✓ Badge positioning matches other elements
✓ Cards layout is not broken by badges
✓ Responsive design works on mobile
```

### Visual Checklist
- [ ] Badge is positioned in top-right or consistent location
- [ ] Green color is clearly "connected"
- [ ] Red color is clearly "disconnected"
- [ ] Text is readable (good contrast)
- [ ] Badge doesn't overlap other content
- [ ] Spacing is consistent
- [ ] Mobile view shows badges correctly

---

## Test 8: Performance Test

### Steps
1. Open DevTools **Performance** tab
2. Start recording
3. Load public stations page with 20+ stations
4. Stop recording

### Expected Result
```
Page load time: < 2 seconds
First contentful paint: < 1 second
No janky animations or layout shifts
Badge rendering: < 100ms for all stations
```

### Performance Metrics to Check
- Network tab: All requests complete quickly
- Console: No errors or warnings
- Performance tab: No long-running tasks
- No excessive DOM updates

### ✅ Passes If
- Page loads in < 2 seconds
- No lag when switching tabs
- Badges render without delay

### ❌ Fails If
- Page takes > 5 seconds to load
- Significant lag when switching tabs
- Visible delay in badge rendering

---

## Test 9: Cross-Browser Test

Test on these browsers:

### Chrome/Edge
```
✓ Badges render correctly
✓ Date parsing works
✓ No console errors
```

### Firefox
```
✓ Badges render correctly
✓ Date parsing works
✓ No console errors
```

### Safari
```
✓ Badges render correctly
✓ Date parsing works
✓ No console errors
```

### Mobile (Chrome Mobile)
```
✓ Badges visible on mobile
✓ Responsive layout works
✓ Date parsing works
```

---

## Test 10: Error Handling Test

### Test 10a: Null `last_updated`
**Setup**: Create station without data
**Expected**: "Never Connected" badge shows, no error

### Test 10b: Invalid Date Format
**Setup**: Manually set invalid `last_updated` in DB
**Expected**: Falls back to "Disconnected", no crash

### Test 10c: Missing Field in API Response
**Setup**: Simulate old API response without `last_updated`
**Expected**: Graceful degradation, no crash

### Test 10d: Server Error
**Setup**: Disconnect from server
**Expected**: Error message shown, not blank page

---

## Console Testing

### Open Developer Console (F12 → Console tab)

### Test JavaScript Directly
```javascript
// Test the function manually
function getConnectionStatus(lastUpdated) {
  if (!lastUpdated) {
    return {
      isConnected: false,
      status: "Never Connected",
      badgeClass: "badge-disconnected"
    };
  }
  
  const now = new Date();
  const lastUpdate = new Date(lastUpdated);
  const minutesAgo = (now - lastUpdate) / (1000 * 60);
  const isConnected = minutesAgo <= 120;
  
  return {
    isConnected,
    status: isConnected ? "Connected" : "Disconnected",
    badgeClass: isConnected ? "badge-connected" : "badge-disconnected"
  };
}

// Test 1: Recent data (5 minutes ago)
getConnectionStatus("2025-11-17T10:25:00");
// Expected: { isConnected: true, status: "Connected", ... }

// Test 2: Old data (3 hours ago)
getConnectionStatus("2025-11-17T07:30:00");
// Expected: { isConnected: false, status: "Disconnected", ... }

// Test 3: No data
getConnectionStatus(null);
// Expected: { isConnected: false, status: "Never Connected", ... }
```

---

## API Endpoint Testing

### Test `/stations/public`
```bash
curl -X GET "http://localhost:8000/stations/public" \
  -H "Content-Type: application/json"
```

**Verify in Response**:
- [ ] All stations have `last_updated`
- [ ] Timestamps are valid ISO format
- [ ] No null values (unless never connected)

### Test `/stations/all` (Authenticated)
```bash
curl -X GET "http://localhost:8000/stations/all" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Verify in Response**:
- [ ] All stations have `last_updated`
- [ ] Timestamps are valid

### Test `/stations/{id}/details`
```bash
curl -X GET "http://localhost:8000/stations/1/details" \
  -H "Content-Type: application/json"
```

**Verify in Response**:
- [ ] `last_updated` field present
- [ ] Timestamp matches database

---

## Database Verification

### SQL Queries to Run

#### Check Column Exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stations' AND column_name = 'last_updated';
```

**Expected Result**:
```
column_name: last_updated
data_type: timestamp with time zone
```

#### Check Values
```sql
SELECT station_id, created_at, last_updated 
FROM stations 
LIMIT 5;
```

**Expected Result**:
```
station_id | created_at              | last_updated
1          | 2025-11-17 08:00:00+00  | 2025-11-17 10:30:00+00
2          | 2025-11-17 09:00:00+00  | 2025-11-17 10:28:00+00
3          | 2025-11-17 10:00:00+00  | NULL (if never received data)
```

#### Check Recent Updates
```sql
SELECT station_id, location, last_updated 
FROM stations 
WHERE last_updated > NOW() - INTERVAL '1 hour' 
ORDER BY last_updated DESC;
```

**Expected Result**: Shows stations updated in last hour

---

## Sign-Off Checklist

### Functionality
- [ ] Database column created successfully
- [ ] API returns `last_updated` in responses
- [ ] Fresh data (< 2 hours) shows "Connected"
- [ ] Stale data (> 2 hours) shows "Disconnected"
- [ ] Never-connected shows "Never Connected"
- [ ] Badges update in real-time
- [ ] Tab switching works correctly

### UI/UX
- [ ] Green badge for connected stations
- [ ] Red badge for disconnected stations
- [ ] Badge positioning is consistent
- [ ] Mobile responsive design works
- [ ] No overlapping elements

### Performance
- [ ] Page loads in < 2 seconds
- [ ] No console errors
- [ ] Tab switching is smooth
- [ ] No memory leaks

### Cross-Browser
- [ ] Chrome/Edge works
- [ ] Firefox works
- [ ] Safari works
- [ ] Mobile works

### Error Handling
- [ ] Null values handled gracefully
- [ ] Invalid dates handled
- [ ] Missing fields don't crash
- [ ] Server errors shown properly

---

## Known Issues to Watch For

1. **Timezone Issues**
   - Watch for: Connection status wrong by exact number of hours
   - Fix: Ensure all times in UTC

2. **Database Not Migrated**
   - Watch for: `column 'last_updated' not found` error
   - Fix: Run migration or recreate tables

3. **Old API Responses**
   - Watch for: `last_updated` undefined in console
   - Fix: Ensure server is running latest code

4. **Browser Clock Off**
   - Watch for: Status wrong but consistent
   - Fix: This is client-side issue, not server issue

---

## Test Results Template

Use this to document test results:

```
Date: ___________
Tester: _________
Build Version: ___________

Test Results:
[ ] Test 1: API Response - PASS / FAIL / N/A
[ ] Test 2: Fresh Data Badge - PASS / FAIL / N/A
[ ] Test 3: Stale Data Badge - PASS / FAIL / N/A
[ ] Test 4: Never Connected - PASS / FAIL / N/A
[ ] Test 5: Real-Time Update - PASS / FAIL / N/A
[ ] Test 6: Tab Switching - PASS / FAIL / N/A
[ ] Test 7: UI/UX - PASS / FAIL / N/A
[ ] Test 8: Performance - PASS / FAIL / N/A
[ ] Test 9: Cross-Browser - PASS / FAIL / N/A
[ ] Test 10: Error Handling - PASS / FAIL / N/A

Issues Found:
1. ________________
2. ________________
3. ________________

Approved For: [ ] Development [ ] Staging [ ] Production
```

---

## Sign-Off

**Testing Guide**: ✅ COMPLETE  
**Ready for QA**: ✅ YES  
**All Tests Documented**: ✅ YES  

**Next Step**: Run through tests and report any issues

---

**Happy Testing! 🧪**

**Last Updated**: November 17, 2025  
**Version**: 2.2  
