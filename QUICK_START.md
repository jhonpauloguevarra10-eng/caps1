# 🚀 Quick Start Guide - VideoMeet

Get VideoMeet running in 3 minutes!

## ⚡ Quick Start (Local)

### 1. Start the Server
```bash
cd c:\Users\gueva\OneDrive\Documents\caps
npm start
```

You should see:
```
🚀 Server running on http://localhost:3000
📡 WebSocket ready for connections
```

### 2. Open in Browser
- Visit: `http://localhost:3000`
- You should see the landing page with "Start New Meeting" button

### 3. Start a Meeting
1. Click **"Start New Meeting"**
2. Enter your name (e.g., "Alice")
3. Click **"Join Meeting"**
4. Allow camera and microphone access
5. You'll join an empty video room

### 4. Join from Another Device/Tab
1. **Option A - Same Device (Test Tab)**:
   - Open new browser tab: `http://localhost:3000?room=XXXXX`
   - Or copy the meeting link
   - Enter name (e.g., "Bob")
   - Join

2. **Option B - Different Device**:
   - Get your computer's IP: `ipconfig` (Windows)
   - Share: `http://YOUR_IP:3000?room=XXXXX`
   - Other device joins the same meeting

### 5. Test Features
✅ **Video**: Should see both users  
✅ **Audio**: Mute/unmute works  
✅ **Chat**: Send messages  
✅ **Controls**: All buttons are functional  
✅ **Links**: Share and copy link button  

---

## 🌐 Deploy to Railway (5 minutes)

### 1. Create GitHub Repo
```bash
git add .
git commit -m "VideoMeet initial commit"
git push origin main
```

### 2. Go to Railway
- Visit: https://railway.app
- Login with GitHub
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose your videomeet repository
- Click "Deploy"

### 3. Railway Does Everything!
✅ Installs dependencies  
✅ Detects Node.js  
✅ Starts the server  
✅ Assigns you a URL  
✅ Auto-deploys on future pushes  

### 4. Your Live URL
After deployment (2-5 minutes):
```
https://your-app-name.up.railway.app
```

Share this with anyone in the world!

---

## 📝 Project Structure

```
videomeet/
├── public/              # Frontend (served by Express)
│   ├── index.html      # Main page
│   ├── css/style.css   # All styles (Responsive)
│   └── js/             # Vanilla JavaScript
│       ├── app.js             # Main app logic
│       ├── ui-manager.js      # UI updates
│       ├── webrtc.js          # P2P video/audio
│       ├── media-manager.js   # Camera/mic control
│       └── rtc-config.js      # WebRTC settings
├── server/
│   └── server.js       # Express + Socket.IO
├── package.json        # Dependencies
├── README.md           # Full documentation
├── DEPLOYMENT.md       # Railway guide
└── .gitignore         # Git rules
```

---

## 🎯 Features Quick Reference

| Feature | Status | How to Test |
|---------|--------|------------|
| 📹 Multi-user video | ✅ | Join from 2 tabs |
| 🎤 Audio | ✅ | Speak, hear other users |
| 🔇 Mute/Unmute | ✅ | Click mic button |
| 📷 Camera On/Off | ✅ | Click camera button |
| 💬 Chat | ✅ | Click chat, send message |
| 🔗 Share link | ✅ | Click link button |
| 📱 Mobile friendly | ✅ | Open on phone/tablet |
| 🌐 Responsive | ✅ | Resize browser window |
| 🚀 Production ready | ✅ | Deployed on Railway |

---

## 🔧 Troubleshooting

### "Server won't start"
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000
# Kill the process or use different port
set PORT=3001
npm start
```

### "Camera/microphone not working"
- Check browser permissions
- Reload the page
- Try different browser (Chrome/Edge/Firefox)
- Ensure camera/mic is connected

### "Can't see video from other user"
- Both users in same meeting room
- Check network connection
- No firewall blocking WebRTC
- Check browser console for errors

### "Chat not working"
- Check Socket.IO is connected
- Look for connection errors in console
- Try refreshing the page

---

## 📊 Testing Checklist

### Local Testing
- [ ] Server starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can create new meeting
- [ ] Can join meeting
- [ ] Can see own video
- [ ] Can see other user's video
- [ ] Can mute/unmute
- [ ] Can turn camera on/off
- [ ] Can send/receive chat
- [ ] Can copy meeting link
- [ ] Mobile view works

### Production Testing (Railway)
- [ ] Can access live URL
- [ ] All features work
- [ ] Multiple simultaneous users
- [ ] Stable connection
- [ ] No console errors
- [ ] Video quality good

---

## 📚 Learn More

- **README.md** - Full feature list and documentation
- **DEPLOYMENT.md** - Detailed Railway deployment
- **public/js/** - Source code of each module
- **server/server.js** - Server implementation

---

## 🚀 What's Next?

1. ✅ **Deploy**: Push to Railway
2. ✅ **Share**: Send link to friends
3. ✅ **Test**: Try with multiple users
4. ✅ **Enhance**: Add features (recording, screen share, etc.)
5. ✅ **Scale**: Add database for meeting history

---

## 💡 Common Use Cases

### 1 on 1 Call
1. Create meeting
2. Share link via email
3. Other person joins
4. Video call starts!

### Group Meeting
1. Host creates meeting
2. Shares link in chat/email
3. Everyone joins
4. See video grid with all participants

### Interview
1. Interviewer creates meeting
2. Sends link to candidate
3. Candidate joins
4. Interview happens!

### Team Standup
1. Manager creates meeting
2. Team members join
3. Everyone muted by default
4. Unmute to speak, then mute again

---

## 🎓 Understanding the Code

### App Initialization (app.js)
```javascript
// When page loads, app starts
new App() creates:
- MediaManager (camera/mic)
- WebRTCManager (video P2P)
- UIManager (interface)
- Socket connection (real-time)
```

### Joining a Meeting Flow
```javascript
1. Click "Join Meeting"
2. Get camera/mic (MediaManager)
3. Connect via Socket.IO
4. Exchange offers/answers (WebRTC)
5. P2P connection established
6. Video streams flow
```

### Real-time Chat Flow
```javascript
1. User types message
2. emit 'chat-message' via Socket.IO
3. Server broadcasts to room
4. All clients receive 'receive-message'
5. Message appears in chat panel
```

---

## 🌟 Tips & Tricks

### For Better Video Quality
- Use wired internet if possible
- Close background applications
- Good lighting for webcam

### For Better Audio
- Use external microphone
- Wear headphones (prevents echo)
- Test audio in browser settings first

### For Testing
- Use incognito windows to avoid caching
- Test on different browsers
- Test on mobile (iOS/Android)
- Test with multiple people simultaneously

### For Debugging
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for any red error messages
4. Check Network tab for Socket.IO connection

---

## 📞 Support

If something isn't working:

1. **Check Console** (F12 → Console tab)
2. **Check Logs** 
   - Local: terminal where you ran `npm start`
   - Railway: Dashboard → Logs tab
3. **Try Refreshing** - Sometimes fixes connection issues
4. **Try Different Browser** - Chrome, Edge, Firefox
5. **Restart Server** - `npm start` after Ctrl+C

---

## ✅ You're All Set!

Your VideoMeet app is ready to use:

**Locally**: http://localhost:3000
**Live**: https://your-app-name.up.railway.app

Start a meeting, invite friends, and enjoy crystal-clear video conferencing! 🎉

---

**Questions?** Check README.md or DEPLOYMENT.md for more details!
