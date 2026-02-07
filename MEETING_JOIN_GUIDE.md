# Multi-Participant Meeting Joining Guide

## Fixed Issue
✅ Participants can now join meetings via shared link or code  
✅ Supports up to 3 participants (host + 2 remote) per meeting  
✅ On-demand meeting creation prevents "meeting doesn't exist" errors  

## How It Works

### Host Creates Meeting
1. Click **"New Meeting"** button on landing page
2. Meeting code is generated (e.g., `A1B2C3D4`)
3. Code is displayed in setup screen and share link
4. Device selection and preview shown
5. Host enters username and clicks **"Join Now"**

### Participant Joins Meeting
1. Receive meeting code/link from host
2. Paste code or link in **"Join"** section on landing page
3. Click **"Join"** button
4. Device setup screen shown
5. Enter your name and click **"Join Now"**
6. **Connected to meeting with video/audio tiles showing**

## Key Features

#### Meeting Code Format
- 8-character alphanumeric code (e.g., `X7Y8Z9AB`)
- Shared as code or as part of URL
- Works in multiple formats:
  - Direct code: `X7Y8Z9AB`
  - Query param: `?room=X7Y8Z9AB` or hostname`/?room=X7Y8Z9AB`
  - Path format: `/room/X7Y8Z9AB`

#### Video Tile Limits
- **Maximum 3 participants per meeting** (1 host + 2 remote)
- If 3rd participant joins, oldest remote tile is removed to make room
- Participants can still hear/communicate with all up to 3 people

#### Media Device Handling
- **Fallback strategy**: Camera denied → audio-only; Mic denied → video-only
- **Device detection**: Mobile vs Desktop constraints
- **Real-time indicators**: Camera/mic status badges in UI

#### Error Recovery
- If meeting doesn't exist on server, it's created on-demand
- Better error messages for users
- Console logging for debugging

## Testing Steps

### Test 1: Single Host → Single Participant
1. **Host**: Click "New Meeting" → note the code
2. **Host**: Enter name, click "Join Now"
3. **Participant**: Paste code/link → "Join"
4. **Participant**: Enter name, click "Join Now"
5. ✅ Both see each other's video tiles

### Test 2: Host → Multiple Participants
1. **Host**: Create and join meeting (as above)
2. **Participant 1**: Enter link, set name, join
3. **Participant 2**: Enter link, set name, join
4. ✅ All see video tiles (max 3: host + 2 remotes)

### Test 3: Device Switching
1. In setup page, use **"Camera"** and **"Microphone"** dropdowns to switch devices
2. Status badges update automatically
3. ✅ Smooth switching without reconnection

### Test 4: Mobile Responsiveness
1. Test on mobile device or mobile browser mode (DevTools)
2. Check that controls resize properly
3. Verify video grid adjusts to screen size
4. ✅ Touch-friendly button sizes

### Test 5: Permission Denial
1. **Deny camera access** in browser permissions
2. See "Camera access unavailable" alert
3. ✅ Can still join with audio only
4. (Repeat with microphone permission)

## Debug Console Output

Look for these logs in browser DevTools → Console:

```
✓ Meeting created on server: A1B2C3D4     [Good - HTTP API worked]
⚠ Using client-generated room ID: X7Y8Z9AB [Fallback - HTTP API failed silently]
✓ User joined room: A1B2C3D4
```

Server logs (terminal running `npm start`):

```
✓ New room created: A1B2C3D4 by Host
User Alice (socket-id) joining room A1B2C3D4, host: false
✓ User connected: (socket-id)
```

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Meeting doesn't exist" | Participant tries to join before host | Now auto-creates on-demand - should not happen |
| Can't see participant | 4th person joining | Max 3 limit enforced - oldest remote removed |
| No camera preview | Permission denied | Check browser permissions, try audio-only |
| Link not shared properly | Code format wrong | Use the 8-char code from setup page |

## Technical Changes

### Server (`server/server.js`)
- ✅ On-demand meeting creation for participants
- ✅ 3-participant maximum with error feedback
- ✅ Better logging for debugging

### Client (`public/js/app.js`)
- ✅ Better HTTP API error handling
- ✅ Prominent meeting code notification
- ✅ Debug logging for meeting creation
- ✅ Fallback to client-generated codes

### WebRTC Manager (`public/js/webrtc.js`)
- ✅ Enforces max 2 remote peer connections

### UI Manager (`public/js/ui-manager.js`)
- ✅ `ensureMaxTiles(3)` - removes older tiles when needed
- ✅ Status badges for camera/microphone state
