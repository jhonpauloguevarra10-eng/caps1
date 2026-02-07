# Caps Meet — Video Conference

Lightweight, production-ready WebRTC video conferencing application using Node.js, Express, Socket.IO, and vanilla JavaScript.

Quick features:
- Camera & microphone with graceful permission handling
- Multi-peer video mesh (suitable for small groups)
- Real-time chat via Socket.IO
- Auto-generated meeting links
- Grid layout, active speaker highlighting (visual), responsive UI
- Host controls (end call)

Getting started (local):

1. Install dependencies

```bash
npm install
```

2. Run the server

```bash
npm start
```

3. Open http://localhost:3000 in your browser. Create a meeting or paste a shared link.

Browser testing: Chrome, Edge, Firefox (allow permissions for camera/mic). Open multiple tabs to simulate participants.

Project structure:
- `server.js` — Express + Socket.IO signaling server
- `public/` — frontend assets (`index.html`, `main.js`, `style.css`)
- `package.json` — start script and deps

Notes and limitations:
- This implementation uses a peer-to-peer mesh: each participant creates a PeerConnection with each other participant. This scales to small meetings (up to ~6–8 users depending on bandwidth). For larger groups, an SFU (e.g., mediasoup, Janus) is recommended.
- For production, deploy behind HTTPS / WSS (Railway or similar). Railway will provide HTTPS.
- The server stores rooms in memory; consider persistent storage for production.

If you want, I can:
- Add automated tests or CI
- Add Dockerfile and production optimizations
- Integrate a TURN server for NAT traversal
