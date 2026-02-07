const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Store active meetings and users
const meetings = new Map();
const users = new Map();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API endpoint to create meeting
app.get('/api/create-meeting', (req, res) => {
  const meetingId = uuidv4().substring(0, 8).toUpperCase();
  meetings.set(meetingId, {
    id: meetingId,
    createdAt: new Date(),
    participants: []
  });
  res.json({ meetingId });
});

// WebSocket events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User joins a meeting
  socket.on('join-meeting', (data) => {
    const { roomId, username, userId } = data;
    
    // Validate meeting exists or create if joining via link
    if (!meetings.has(roomId)) {
      meetings.set(roomId, {
        id: roomId,
        createdAt: new Date(),
        participants: []
      });
    }

    socket.join(roomId);
    
    // Store user info
    users.set(socket.id, {
      socketId: socket.id,
      username,
      userId,
      roomId,
      joinedAt: new Date()
    });

    // Add to meeting participants
    const meeting = meetings.get(roomId);
    meeting.participants.push({
      socketId: socket.id,
      username,
      userId
    });

    // Notify others in room
    socket.broadcast.to(roomId).emit('user-joined', {
      socketId: socket.id,
      username,
      userId
    });

    // Send existing users to new joiner
    io.to(socket.id).emit('existing-users', 
      meeting.participants.filter(p => p.socketId !== socket.id)
    );

    console.log(`${username} joined meeting ${roomId}`);
  });

  // WebRTC Signaling - SDP Offer
  socket.on('send-offer', (data) => {
    const { to, offer } = data;
    io.to(to).emit('receive-offer', {
      from: socket.id,
      offer
    });
  });

  // WebRTC Signaling - SDP Answer
  socket.on('send-answer', (data) => {
    const { to, answer } = data;
    io.to(to).emit('receive-answer', {
      from: socket.id,
      answer
    });
  });

  // WebRTC Signaling - ICE Candidates
  socket.on('send-ice-candidate', (data) => {
    const { to, candidate } = data;
    io.to(to).emit('receive-ice-candidate', {
      from: socket.id,
      candidate
    });
  });

  // Chat messages
  socket.on('chat-message', (data) => {
    const { roomId, message, username } = data;
    const user = users.get(socket.id);
    
    if (user && user.roomId === roomId) {
      io.to(roomId).emit('receive-message', {
        username,
        message,
        timestamp: new Date(),
        socketId: socket.id
      });
      console.log(`Chat in ${roomId}: ${username}: ${message}`);
    }
  });

  // Media state updates
  socket.on('media-state', (data) => {
    const { roomId, mediaState } = data;
    const user = users.get(socket.id);
    
    if (user && user.roomId === roomId) {
      socket.broadcast.to(roomId).emit('user-media-state', {
        socketId: socket.id,
        mediaState
      });
    }
  });

  // User leaves
  socket.on('leave-meeting', () => {
    const user = users.get(socket.id);
    
    if (user) {
      const { roomId, username } = user;
      
      socket.broadcast.to(roomId).emit('user-left', {
        socketId: socket.id,
        username
      });

      // Remove from meeting participants
      const meeting = meetings.get(roomId);
      if (meeting) {
        meeting.participants = meeting.participants.filter(
          p => p.socketId !== socket.id
        );

        // Delete meeting if empty
        if (meeting.participants.length === 0) {
          meetings.delete(roomId);
          console.log(`Meeting ${roomId} closed (no participants)`);
        }
      }

      socket.leave(roomId);
      users.delete(socket.id);
      console.log(`${username} left meeting ${roomId}`);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    
    if (user) {
      const { roomId, username } = user;
      
      socket.broadcast.to(roomId).emit('user-disconnected', {
        socketId: socket.id,
        username
      });

      // Clean up meeting
      const meeting = meetings.get(roomId);
      if (meeting) {
        meeting.participants = meeting.participants.filter(
          p => p.socketId !== socket.id
        );

        if (meeting.participants.length === 0) {
          meetings.delete(roomId);
        }
      }

      users.delete(socket.id);
      console.log(`User disconnected: ${socket.id}`);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
});
