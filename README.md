# 🎥 VideoMeet - Video Conferencing App

A production-ready video conferencing web application similar to Zoom and Google Meet, built with WebRTC, Node.js, Express, and Socket.IO.

## ✨ Features

### 🎬 Core Video Features
- ✅ **Multi-user video conferencing** - Support for multiple simultaneous video streams
- ✅ **Real-time audio** - Crystal clear audio with echo cancellation and noise suppression
- ✅ **Camera control** - Turn camera on/off, switch between devices
- ✅ **Microphone control** - Mute/unmute, switch between devices
- ✅ **Active speaker detection** - Displays who is currently speaking
- ✅ **Adaptive video grid layout** - Automatically adjusts to number of participants

### 🔗 Meeting Management
- ✅ **Unique meeting IDs** - Auto-generated 8-character meeting codes
- ✅ **Shareable meeting links** - One-click copy to clipboard
- ✅ **Join via link** - Paste meeting link to join instantly
- ✅ **Permission handling** - Graceful handling of camera/mic access denial

### 💬 Real-time Chat
- ✅ **Socket.IO powered** - Instant message delivery
- ✅ **Username + timestamp** - Know who sent what and when
- ✅ **No duplicate messages** - Idempotent message handling
- ✅ **Message notification badge** - See unread message count

### 🎛 Control Buttons (All Functional)
- ✅ Join meeting
- ✅ Leave meeting
- ✅ Mute/Unmute microphone
- ✅ Camera on/off
- ✅ Copy meeting link
- ✅ Open/Close chat panel
- ✅ Fullscreen mode
- ✅ End meeting (host)

### 📱 Responsive Design
- ✅ **Desktop** - Full experience with all controls visible
- ✅ **Tablet** - Optimized layout with adaptive grid
- ✅ **Mobile** - Touch-friendly controls with collapsible panels
- ✅ **Landscape mode** - Special adjustments for small screens

### 🚀 Production Ready
- ✅ **No console errors** - Clean error handling throughout
- ✅ **Cross-browser support** - Chrome, Edge, Firefox, Safari
- ✅ **WebRTC signaling** - SDP offer/answer with ICE candidates
- ✅ **Graceful error handling** - User-friendly error messages
- ✅ **Performance optimized** - Smooth video experience

## 🛠 Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Flexbox, Grid, animations, responsive design
- **Vanilla JavaScript ES6+** - No frameworks, pure modern JS

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web server framework
- **Socket.IO** - Real-time WebSocket communication
- **WebRTC** - Peer-to-peer video/audio
- **UUID** - Meeting ID generation

## 📋 Requirements

- **Node.js** 18.x or higher
- **npm** or **yarn**
- Modern browser with WebRTC support (Chrome, Edge, Firefox, Safari)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/videomeet.git
cd videomeet
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```

The application will be available at `http://localhost:3000`

### 4. Development Mode
```bash
npm run dev
```

## 📖 How to Use

### Starting a Meeting
1. Click **"Start New Meeting"** on the landing page
2. Enter your name
3. Allow camera/microphone access (if prompted)
4. Click **"Join Meeting"**

### Joining an Existing Meeting
1. Get the meeting link from someone already in the meeting
2. Paste it in the input field on the landing page
3. Click **"Join Meeting"**
4. Enter your name and allow access
5. You'll be connected to the meeting

### During the Meeting
- **Mute/Unmute** - Click the microphone button
- **Camera On/Off** - Click the camera button
- **Chat** - Click the chat button to open/close the chat panel
- **Share Link** - Click the link button to copy meeting link
- **Fullscreen** - Click the fullscreen button
- **Leave** - Click the phone button to leave the meeting

## 🌐 Deployment on Railway

Railway makes deployment simple and free!

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Authorize Railway to access your GitHub account

### Step 2: Connect GitHub Repository
1. Create new project
2. Select "Deploy from GitHub repo"
3. Choose your VideoMeet repository
4. Grant permissions if needed

### Step 3: Add Environment Variables
1. In Railway dashboard, go to your project
2. Click "Variables" tab
3. **Port is automatically set** - Railway uses `$PORT` environment variable

### Step 4: Deploy
1. Railway automatically deploys on push to main branch
2. View logs in the dashboard
3. Your app URL will be: `https://your-app-name.up.railway.app`

### Step 5: Test Deployment
1. Visit your Railway URL
2. Test creating and joining meetings
3. Verify camera, microphone, and chat work
4. Share the link with others to test multi-user

## 🔧 Project Structure

```
videomeet/
├── public/
│   ├── index.html              # Main HTML file
│   ├── css/
│   │   └── style.css           # All styles (responsive)
│   └── js/
│       ├── rtc-config.js       # WebRTC configuration
│       ├── media-manager.js    # Camera/microphone control
│       ├── webrtc.js           # WebRTC peer connections
│       ├── ui-manager.js       # UI updates and interactions
│       └── app.js              # Main application logic
├── server/
│   └── server.js               # Express + Socket.IO server
├── package.json                # Dependencies and scripts
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
└── .env (optional)            # Environment variables
```

## 📊 Architecture

### Signal Flow
```
User A                          Server                          User B
  |                              |                               |
  |-- join-meeting ------------->|                               |
  |                              |<-- user-joined --------- (notify User B)
  |                              |
  |                              |-- existing-users ---> (User B -> User A)
  |                              |
  |<-- receive-offer ----------- (User B creates offer)
  |
  |-- send-answer ------------->|
  |                              |
  |<-- receive-answer ---------- (User B receives answer)
  |
  |-- send-ice-candidate ------>|-- receive-ice-candidate --->
  |
  |                 WebRTC P2P Connection Established
  |                 (Video/Audio streaming)
```

### WebSocket Events
- `join-meeting` - User joins a room
- `send-offer` - WebRTC offer (SDP)
- `receive-offer` - Incoming WebRTC offer
- `send-answer` - WebRTC answer (SDP)
- `receive-answer` - Incoming WebRTC answer
- `send-ice-candidate` - ICE candidate for connection
- `receive-ice-candidate` - Incoming ICE candidate
- `chat-message` - Send chat message
- `receive-message` - Receive chat message
- `user-joined` - Notify others of new user
- `user-left` - User left the meeting
- `media-state` - Media status update

## 🐛 Troubleshooting

### Camera/Microphone Not Accessing
- Check browser permissions
- Ensure HTTPS is used (required for media access)
- Try a different browser
- Check if devices are already in use

### No Video from Other Users
- Check internet connection
- Verify firewall allows WebSocket connections
- Check browser console for errors
- Ensure both users are in same meeting

### Audio Issues
- Check microphone levels in browser settings
- Disable browser extensions that might interfere
- Try different microphone device
- Check system audio settings

### Connection Issues
- Verify you're on the same network or internet
- Check if server is running (local) or deployed (Railway)
- Verify correct meeting link is being used
- Check browser WebRTC support

## 🧪 Testing Checklist

- [ ] **locally**: Multiple users on same network
- [ ] **Mobile**: Join on phone and tablet
- [ ] **Browsers**: Test Chrome, Edge, Firefox
- [ ] **Media**: Camera on/off works
- [ ] **Media**: Microphone mute/unmute works
- [ ] **Chat**: Messages send and receive
- [ ] **Link**: Share and join via link works
- [ ] **Meeting Link**: Copy to clipboard works
- [ ] **Responsive**: All screen sizes work
- [ ] **Performance**: No lag or stuttering
- [ ] **Errors**: No console errors
- [ ] **Railway**: Deployed live link works

## 🔐 Security

The application includes:
- CORS configuration for cross-origin requests
- Input sanitization for chat messages
- No sensitive data in client code
- XSS protection through HTML escaping
- CSRF protection via Socket.IO

For production:
- Use HTTPS/WSS only
- Implement authentication if needed
- Add rate limiting
- Use Redis for session management (optional)

## 📚 Resources

- [WebRTC Documentation](https://webrtc.org)
- [Socket.IO Docs](https://socket.io/docs/)
- [Express.js Guide](https://expressjs.com/)
- [MDN Media API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Streams_API)
- [Railway Docs](https://docs.railway.app)

## 🤝 Contributing

Contributions are welcome! Feel free to:
1. Fork the repository
2. Create a feature branch
3. Make changes
4. Submit a pull request

## 📝 License

MIT License - feel free to use for personal or commercial projects

## ✅ Deployed URL

**Live Application**: `https://your-app-name.up.railway.app`

Replace `your-app-name` with your actual Railway app name after deployment.

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Create an issue on GitHub

---

**Built with ❤️ using WebRTC, Node.js, and Socket.IO**

Happy video conferencing! 🎉
