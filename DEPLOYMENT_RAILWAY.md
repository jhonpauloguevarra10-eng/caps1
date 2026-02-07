# Deployment on Railway

This guide explains deploying the app to Railway (or similar platforms).

1. Create a new Railway project and link your repository.

2. Ensure `package.json` has a start script (already present):

```json
"scripts": { "start": "node server.js" }
```

3. Railway will set the `PORT` environment variable. The app reads `process.env.PORT` already.

4. Socket.IO will work over secure WebSocket (wss) automatically when Railway provides HTTPS. No additional configuration needed for basic usage.

5. Optional: Add a TURN server for better connectivity. Configure STUN/TURN in `ICE_CONFIG` in `public/main.js`.

6. Deploy and open the provided URL. Use `/r/<roomId>` links to join meetings.

Security & production tips:
- Use a persistent storage for rooms if you need persistence.
- Add rate limiting and authentication for private rooms.
- Provision a TURN server (coturn) to improve NAT traversal.
