# Medi Mitra

Minimal telemedicine platform with authentication, appointments, AI assistant, and a lightweight peer-to-peer video call (WebRTC) system.

## Quick Start
Backend:
1. Create `.env` with at least:
```
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=change_me
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_key
```
2. Install & run: `npm install` then `npm run dev` inside `backend/`.

Frontend:
1. Create `.env` with:
```
VITE_API_URL=http://localhost:5000
```
2. Install & run: `npm install` then `npm run dev` inside `frontend/`.

## WebRTC (Minimal Call Flow)
This project includes a deliberately minimal one-to-one video call implementation you can understand and extend easily.

### High-Level Flow
1. Caller clicks Start → emits `call:request` (no SDP yet)
2. Callee sees ringing UI → Accept or Reject
3. On Accept:
	- Caller creates offer SDP → `call:offer`
	- Callee sets remote, creates answer → `call:answer`
4. Both exchange ICE candidates via `call:ice`
5. Either side can end with `call:end`

### Signaling Events
| Event | Direction | Payload | Notes |
|-------|-----------|---------|-------|
| call:request | caller → callee | { callId, toUserId, fromName } | Creates in-memory call entry |
| call:cancel | caller → callee | { callId } | Before accept |
| call:reject | callee → caller | { callId } | Before offer exchange |
| call:accept | callee → caller | { callId } | Triggers caller to create offer |
| call:offer | caller → callee | { callId, sdp } | SDP offer |
| call:answer | callee → caller | { callId, sdp } | SDP answer |
| call:ice | either → peer | { callId, candidate } | ICE candidate relay |
| call:busy | server → caller | { callId } | Callee already engaged; no ringing shown |
| call:end | either → peer | { callId, reason } | Ends & cleans up |

### Frontend Pieces
Files:
- `src/webrtc/webrtcClient.js`: Core controller (no React inside)
- `src/hooks/useCall.js`: React hook bridging Redux user + controller
- `src/components/CallNotification.jsx`: Shows incoming ringing UI
- `src/pages/CallPage.jsx`: Displays streams & controls

Hook usage example:
```js
const {
	state,
	startCall,
	acceptCall,
	rejectCall,
	endCall,
	localStream,
	remoteStream,
	toggleAudio,
	toggleVideo,
	audioEnabled,
	videoEnabled,
	reason
} = useCall();
```

`state` can be: `idle | calling | ringing | connecting | active | busy | error | ended`.
`reason` stores the last terminal state cause (busy, cancelled, ended, error).

### ICE / Media & TURN (Prototype Friendly)
Default always includes Google STUN:
```js
{ urls: 'stun:stun.l.google.com:19302' }
```
Optionally add up to THREE TURN servers via frontend `.env` (leave blank if unused):
```
VITE_TURN_URL_1=turn:turn1.example.com:3478
VITE_TURN_USER_1=demo
VITE_TURN_PASS_1=demo
VITE_TURN_URL_2=
VITE_TURN_USER_2=
VITE_TURN_PASS_2=
VITE_TURN_URL_3=
VITE_TURN_USER_3=
VITE_TURN_PASS_3=
```
Only non-empty ones are injected into the ICE servers list.

Example resulting list:
```js
[
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'turn:turn1.example.com:3478', username: 'demo', credential: 'demo' }
]
```

### Media Controls
- `toggleAudio()` mute/unmute mic
- `toggleVideo()` disable/enable camera
- `audioEnabled` / `videoEnabled` booleans updated live
Implemented in `CallPage.jsx` with simple buttons.

### Backend Logic
Implemented in `backend/services/socket.js` inside the main connection handler.
Uses an in-memory `Map` (`io.activeCalls`). Not suitable for multi-instance scaling without Redis.

### Extending / Next Steps
- Add `call:busy` if callee already in a call
- Persist call logs in DB
- Add screen-share: `getDisplayMedia()` then addTrack
- Add mute/unmute toggles (track.enabled = false)
- Replace random ID with `uuid`

### Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| Remote video never appears | No ICE candidates exchanged | Ensure both sides fire `call:ice` and no CORS/socket errors |
| Immediate end after start | Callee auto-rejected (busy) | Make sure state is `idle` on receiver |
| Caller sees busy instantly | Callee already in another call | Inform user to retry later |
| Permissions denied | User blocked camera/mic | Re-prompt: browser settings → allow |
| Works locally, not in prod | NAT traversal issue | Add TURN server |

### Resetting a Broken Call
1. Both users close call page
2. Ensure no leftover camera indicators
3. Refresh page (resets in-memory state)

---
This minimal approach is meant as a teaching base; build reliability (TURN, reconnect, scaling) incrementally.