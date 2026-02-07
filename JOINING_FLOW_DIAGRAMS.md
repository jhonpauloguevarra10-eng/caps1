# VideoMeet - Updated Meeting Flow Diagram

## Meeting Link Joining Flow (Google Meet Style)

### From Host Perspective
```
┌─────────────┐
│   Landing   │
└──────┬──────┘
       │ [New Meeting]
       ▼
┌─────────────────────────────┐
│  Setup Page                 │
│ (Device Selection)          │
│ ─ Select Camera            │
│ ─ Select Microphone        │
│ ─ Enter Name               │
└──────┬──────────────────────┘
       │ [Ready to Join]
       ▼
┌────────────────────────────────┐
│  emit: join-room(isHost=true)  │ ◄──── Socket Event
└──────┬─────────────────────────┘
       │
       ▼ (Server creates meeting)
┌────────────────────────────────┐
│  Server: emit room-created     │
└──────┬─────────────────────────┘
       │
       ▼
┌───────────────────────┐
│  Meeting Page         │
│ ─ Video Grid         │
│ ─ Controls           │
│ ─ Chat Panel         │
│ ─ Share Link Button  │ ◄──── Host can now share link
└───────────────────────┘
```

### From Guest Perspective (Clicking Link)

```
Receive: http://localhost:3000/?room=ABC12345
              │
              ▼
           Click Link
              │
              ▼
   Client detects ?room= parameter
              │
              ▼
       Auto-show Setup Page
              │
              ▼
┌──────────────────────┐
│ User enters name     │
│ [Ready to Join]      │
└──────┬───────────────┘
       │
       ▼ emit: join-room(isHost=false)
┌──────────────────────────────┐
│ Server: emit room-joined     │
│ + existing-users list        │
└────────┬─────────────────────┘
         │
         ▼
    WebRTC: Create Offers
    for existing users
         │
         ▼
┌──────────────────────┐
│  Meeting Page        │
│  See all participants│
└──────────────────────┘
```

### From Guest Perspective (Manual Code Entry)

```
Landing Page
     │
     ▼ [Join Button]
┌──────────────────────────┐
│ Join Input Focused      │
│ [Enter code]            │
│ [Arrow Button]          │
└──┬───────────────────────┘
   │
   ▼ Enter: ABC12345
   │
   ▼ Parse & Validate Code
   │
   ▼
┌──────────────────────────┐
│  Setup Page              │
│  (See device options)    │
└──┬───────────────────────┘
   │
   ▼ Enter name & [Ready to Join]
   │
   ▼ emit: join-room(roomId, name)
   │
   ▼
   Meeting Page
```

## Socket Event Flow

```
CLIENT                          SERVER                    OTHER_CLIENTS
  │                               │                            │
  ├─ emit: join-room ─────────────>                           │
  │                               │                            │
  │                      [validate room]                       │
  │                               │                            │
  │                      [add to participants]                 │
  │                               │                            │
  │       <─ emit: room-joined ───┤                           │
  │                               │                            │
  │                              ├─> emit: user-joined ───────>│
  │                              │        to others             │
  │                              │                             │
  │                      [get existing users]                  │
  │                              │                            │
  │       <─ emit: existing-users ┤                           │
  │         (list of participants)│                           │
  │                               │                            │
  │─ emit: send-offer ────────────>─────> emit: receive-offer ─>
  │                               │                           │
  │       <──────── emit: receive-answer ─────────────────────┤
  │                               │                            │
  │─ emit: send-ice-candidate ────>─────> emit: receive-ice ──>
  │     (multiple over time)       │                            │
  │                               │                            │
```

## Link Format Support

```
All these formats work:

1. Full URL from host:
   ✓ http://localhost:3000/?room=ABC12345
   ✓ https://videomeet.example.com/?room=ABC12345
   
2. Query parameter only:
   ✓ /?room=ABC12345
   
3. Path format (auto-redirects):
   ✓ /room/ABC12345 → /?room=ABC12345
   
4. Just the code:
   ✓ ABC12345
   ✓ abc12345 (converted to uppercase)
   
Error cases (handled gracefully):
   ✗ ABCDE           → "Invalid code length"
   ✗ ABC@DEFG        → "Invalid characters"
   ✗ (empty)         → "Please enter a code"
   ✗ WRONGCODE       → "Room doesn't exist"
```

## State Transitions

```
Landing Page
    ├─ [New Meeting] ──> Setup (isHost=true, roomId=generated)
    ├─ [Join] ─────────> Join Input (focus on input)
    └─ ?room=CODE ─────> Setup (isHost=false, roomId=URL param)

Setup Page
    ├─ [Device Selection] ──> User adjusts camera/mic
    ├─ [Name Input] ────────> User enters name
    ├─ [Back] ──────────────> Back to Landing (cleanup)
    └─ [Ready to Join] ─────> Meeting Page (after socket join)

Meeting Page
    ├─ [Leave] ────────────> Landing (cleanup)
    ├─ [Camera/Mic Toggle] ─> Update UI & broadcast
    ├─ [Share Screen] ─────> Start screen share (TODO)
    ├─ [Record] ───────────> Start recording (host only, TODO)
    └─ [End Meeting] ──────> Landing (host only, all disconnected)
```

## Error Handling Flow

```
User Action Error Cases:

1. Invalid Code Input
   Empty string
   ├─> Validation fails
   └─> Show: "Please enter a meeting link or code"
   
2. Invalid Code Format
   "ABCD" (too short)
   ├─> Format validation fails
   └─> Show: "Invalid meeting code..."
   
3. Room Doesn't Exist
   "WRONGCODE"
   ├─> Server rejects join
   ├─> Server emits: room-error
   └─> Show: "This meeting doesn't exist..."
   
4. Camera Permission Denied
   Browser blocks access
   ├─> getUserMedia fails with NotAllowedError
   ├─> Continue with audio-only
   └─> Show: "Camera access blocked - audio-only mode"
   
5. Network Connection Lost
   Websocket disconnects
   ├─> Socket reconnects automatically
   ├─> If not in meeting: Show notification
   └─> If in meeting: Show "Lost connection" & retry
```

## Device Preparation Flow

```
prepareForMeeting() Process:

1. Show Loading: "Preparing meeting..."

2. Enumerate Devices
   ├─ Success ──> Populate device selects
   └─ Fail ────> Log warning, continue

3. Request User Media
   ├─ Success ──> Show preview, enable camera toggle
   ├─ NotAllowedError ──> Audio-only mode (show warning)
   ├─ NotFoundError ───> No devices found (show warning)  
   └─ NotReadableError -> Device in use (show warning)

4. Show Setup Page
   └─> User can still join without video

5. Hide Loading & Focus Username Input

Total time: ~500-2000ms depending on device availability
```

## Performance Timeline

```
T+0ms   User clicks link or enters code
        ├─> Parse URL/code
        └─> Validate format

T+100ms prepareForMeeting() starts
        ├─> Enumerate devices (~50ms)
        └─> Request user media (~200-500ms)

T+300ms Setup page appears
        └─> User enters name

T+500ms User clicks "Ready to Join"
        └─> Check socket connection

T+600ms Socket connected (usually instant)
        └─> Show meeting page

T+650ms emit join-room event

T+700ms Server processes join
        ├─> Validate/create room
        ├─> Add participant
        └─> Send existing-users list

T+900ms Client receives events
        ├─> room-joined or room-created
        ├─> existing-users list
        └─> Start creating WebRTC offers

T+1200ms WebRTC offers sent to peers

T+1500ms ICE candidates exchanged

T+2000ms Video streams established
        └─> Full meeting active

Total Time: ~2 seconds from click to active meeting
```

## Quality of Experience Features

```
✓ Progress Indicators
  ├─ Loading states during transitions
  ├─ Toast notifications for actions
  └─ Connection status indicator

✓ User Guidance
  ├─ Clear error messages
  ├─ Format examples in error text
  ├─ Inline help text ("paste link or enter code")
  └─ Input placeholders

✓ Accessibility
  ├─ Auto-focus on input fields
  ├─ Scroll to visible area on mobile
  ├─ Keyboard enter support
  └─ Clear button labels

✓ Responsiveness
  ├─ Mobile-optimized layout
  ├─ Touch-friendly buttons
  ├─ Landscape/portrait support
  └─ Adaptive font sizes

✓ Smart Defaults
  ├─ Auto-uppercase room codes
  ├─ Auto-detect URL parameters
  ├─ Preferred camera/mic remembered (future)
  └─ Camera on by default
```

## Server-Client Message Exchange

```
Time    Client                    Server        Action
─────────────────────────────────────────────────────────
0ms     [User clicks join]
5ms     emit: join-room ──────────>            
10ms                              Validate room
15ms                              Create/update room
20ms                              Add participant
25ms    <──── room-created/joined  Send response
30ms    Process participants list                
35ms     emit: send-offer ────────>            
40ms                              Route to peer A
45ms    <── receive-offer (peer A)              
50ms     emit: send-answer ───────>            
55ms                              Route to peer A
60ms    <── receive-answer ────────              
65ms     emit: ice-candidate ────> (multiple times)
70ms                              Route candidates
75ms    <── receive-ice-candidate              
80ms    Video stream established
```

## Migration from Other Platforms

### From Google Meet
```
Google Meet: meet.google.com/?authuser=0#<CODE>
VideoMeet:   localhost:3000/?room=<CODE>

Users can use same workflow:
1. Host creates meeting ✓
2. Copy link ✓
3. Share with guests ✓
4. Guests click link → auto-join setup ✓
5. Enter name → join ✓
6. See video grid ✓
```

### From Zoom
```
Zoom: zoom.us/j/<MEETING_ID>
VideoMeet: localhost:3000/?room=<ROOM_CODE>

Key differences:
- Zoom: Numeric IDs (10 digits)
- VideoMeet: Alphanumeric codes (8 chars)
- Zoom: Password optional
- VideoMeet: Unlisted (no discovery), more private

Both support instant joining with no registration
```

## Summary

The updated meeting link joining system now provides:
- ✅ Google Meet-like convenience
- ✅ Multiple joining methods
- ✅ Robust error handling
- ✅ Clear user feedback
- ✅ Fast connection (~2 seconds)
- ✅ Graceful degradation
- ✅ Mobile-friendly UX
