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
  },
  pingTimeout: 60000,
  pingInterval: 25000
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

// Room-specific URL - redirect to query param format
app.get('/room/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  res.redirect(`/?room=${roomId}`);
});

// API endpoint to create meeting
app.get('/api/create-meeting', (req, res) => {
  const meetingId = uuidv4().substring(0, 8).toUpperCase();
  meetings.set(meetingId, {
    id: meetingId,
    host: null,
    createdAt: new Date(),
    participants: new Map(),
    isActive: true
  });
  res.json({ meetingId });
});

// WebSocket events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create or join room
  socket.on('join-room', async (data) => {
    const { roomId, username, userId, isHost = false } = data;
    
    console.log(`User ${username} (${socket.id}) joining room ${roomId}, host: ${isHost}`);
    
    // Validate or create room
    if (!meetings.has(roomId)) {
      if (isHost) {
        // Host creating a new room
        meetings.set(roomId, {
          id: roomId,
          host: socket.id,
          createdAt: new Date(),
          participants: new Map(),
          isActive: true
        });
        console.log(`New room created: ${roomId} by ${username}`);
      } else {
        // User trying to join non-existent room
        socket.emit('room-error', { message: 'Room does not exist' });
        return;
      }
    }

    const meeting = meetings.get(roomId);
    
    // Check if room is active
    if (!meeting.isActive) {
      socket.emit('room-error', { message: 'Meeting has ended' });
      return;
    }

    // Enforce maximum participants per meeting (including host)
    const MAX_PARTICIPANTS = 3;
    if (meeting.participants.size >= MAX_PARTICIPANTS) {
      socket.emit('room-full', { message: 'Meeting is full. Maximum 3 participants allowed.' });
      return;
    }

    // Check if user is already in the room
    if (meeting.participants.has(socket.id)) {
      socket.emit('room-error', { message: 'Already in this meeting' });
      return;
    }

    // Join socket room
    socket.join(roomId);
    
    // Store user info
    users.set(socket.id, {
      socketId: socket.id,
      username,
      userId,
      roomId,
      joinedAt: new Date(),
      isHost
    });

    // Add to meeting participants
    meeting.participants.set(socket.id, {
      socketId: socket.id,
      username,
      userId,
      joinedAt: new Date(),
      mediaState: {
        camera: true,
        microphone: true,
        screenShare: false
      }
    });

    // Update host if this is the first participant (only if not explicitly set as host)
    if (meeting.participants.size === 1 && !isHost) {
      meeting.host = socket.id;
      users.get(socket.id).isHost = true;
    }

    // Notify the host about room creation
    if (isHost && meeting.participants.size === 1) {
      socket.emit('room-created', {
        roomId,
        isHost: true
      });
    } else {
      // Notify joining participant
      socket.emit('room-joined', {
        roomId,
        participants: Array.from(meeting.participants.values()).map(p => ({
          socketId: p.socketId,
          username: p.username,
          userId: p.userId
        })),
        isHost: users.get(socket.id).isHost
      });
    }

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      username,
      userId
    });

    // Send existing users to the new joiner
    const existingUsers = Array.from(meeting.participants.values())
      .filter(p => p.socketId !== socket.id)
      .map(p => ({
        socketId: p.socketId,
        username: p.username,
        userId: p.userId
      }));
    
    if (existingUsers.length > 0) {
      socket.emit('existing-users', existingUsers);
    }

    console.log(`${username} joined meeting ${roomId} (Total: ${meeting.participants.size})`);
  });

  // WebRTC Signaling - SDP Offer
  socket.on('send-offer', (data) => {
    const { to, offer } = data;
    console.log(`Offer from ${socket.id} to ${to}`);
    
    if (io.sockets.sockets.has(to)) {
      io.to(to).emit('receive-offer', {
        from: socket.id,
        offer
      });
    }
  });

  // WebRTC Signaling - SDP Answer
  socket.on('send-answer', (data) => {
    const { to, answer } = data;
    console.log(`Answer from ${socket.id} to ${to}`);
    
    if (io.sockets.sockets.has(to)) {
      io.to(to).emit('receive-answer', {
        from: socket.id,
        answer
      });
    }
  });

  // WebRTC Signaling - ICE Candidates
  socket.on('send-ice-candidate', (data) => {
    const { to, candidate } = data;
    console.log(`ICE candidate from ${socket.id} to ${to}`);
    
    if (io.sockets.sockets.has(to)) {
      io.to(to).emit('receive-ice-candidate', {
        from: socket.id,
        candidate
      });
    }
  });

  // Chat messages
  socket.on('chat-message', (data) => {
    const { roomId, message, username } = data;
    const user = users.get(socket.id);
    
    if (user && user.roomId === roomId) {
      const timestamp = new Date();
      console.log(`Chat in ${roomId}: ${username}: ${message}`);
      
      io.to(roomId).emit('receive-message', {
        username,
        message,
        timestamp,
        socketId: socket.id
      });
    }
  });

  // Media state updates
  socket.on('media-state', (data) => {
    const { roomId, mediaState } = data;
    const user = users.get(socket.id);
    
    if (user && user.roomId === roomId) {
      // Update user's media state
      const meeting = meetings.get(roomId);
      if (meeting && meeting.participants.has(socket.id)) {
        meeting.participants.get(socket.id).mediaState = mediaState;
      }
      
      // Broadcast to others in room
      socket.to(roomId).emit('user-media-state', {
        socketId: socket.id,
        mediaState
      });
    }
  });

  // Screen share events
  socket.on('start-screen-share', (data) => {
    const { roomId, username } = data;
    socket.to(roomId).emit('screen-share-started', {
      socketId: socket.id,
      username
    });
  });

  socket.on('stop-screen-share', (data) => {
    const { roomId, username } = data;
    socket.to(roomId).emit('screen-share-stopped', {
      socketId: socket.id,
      username
    });
  });

  // User leaves meeting
  socket.on('leave-room', (data) => {
    const { roomId } = data;
    const user = users.get(socket.id);
    
    if (user && user.roomId === roomId) {
      const meeting = meetings.get(roomId);
      if (meeting) {
        // Remove participant from meeting
        meeting.participants.delete(socket.id);
        
        // Notify others in the room
        socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          username: user.username,
          participantCount: meeting.participants.size
        });
        
        // If no more participants, deactivate the meeting
        if (meeting.participants.size === 0) {
          meeting.isActive = false;
          meetings.delete(roomId);
          console.log(`Meeting ${roomId} closed (no participants)`);
        } else {
          // Assign new host if needed
          if (user.isHost && meeting.participants.size > 0) {
            const firstParticipant = Array.from(meeting.participants.values())[0];
            meeting.host = firstParticipant.socketId;
            io.to(roomId).emit('host-changed', {
              newHostId: firstParticipant.socketId,
              newHostName: firstParticipant.username
            });
          }
        }
      }
      
      // Remove user from users map
      users.delete(socket.id);
      console.log(`${user.username} left meeting ${roomId}`);
    }
    
    // Leave socket room
    socket.leave(roomId);
  });

  // End meeting (host only)
  socket.on('end-meeting', (data) => {
    const { roomId } = data;
    const user = users.get(socket.id);
    
    if (user && user.isHost && user.roomId === roomId) {
      const meeting = meetings.get(roomId);
      if (meeting) {
        // Notify all participants
        io.to(roomId).emit('meeting-ended', {
          endedBy: user.username
        });
        
        // Clean up meeting
        meeting.participants.forEach((participant, participantId) => {
          if (io.sockets.sockets.has(participantId)) {
            io.sockets.sockets.get(participantId).leave(roomId);
          }
          users.delete(participantId);
        });
        
        meetings.delete(roomId);
        console.log(`Meeting ${roomId} ended by host`);
      }
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    
    if (user) {
      const { roomId, username } = user;
      const meeting = meetings.get(roomId);
      
      if (meeting) {
        // Remove from meeting participants
        meeting.participants.delete(socket.id);
        
        // Notify others
       socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          username
        });
        
        // Handle host leaving
        if (meeting.host === socket.id && meeting.participants.size > 0) {
          const newHost = Array.from(meeting.participants.keys())[0];
          meeting.host = newHost;
          
          if (users.has(newHost)) {
            users.get(newHost).isHost = true;
            io.to(newHost).emit('host-changed', { isHost: true });
          }
        }
        
        // Clean up empty meeting
        if (meeting.participants.size === 0) {
          meetings.delete(roomId);
          console.log(`Meeting ${roomId} closed (no participants)`);
        } else {
          console.log(`${username} left meeting ${roomId} (Remaining: ${meeting.participants.size})`);
        }
      }
      
      users.delete(socket.id);
      console.log(`User disconnected: ${socket.id} (${username})`);
    }
  });

  // Error handler
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Start server with retry on EADDRINUSE
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;

function startServer(port = DEFAULT_PORT, maxRetries = 5) {
  let attempts = 0;

  function tryListen(p) {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${p} in use, trying port ${p + 1}...`);
        attempts++;
        if (attempts <= maxRetries) {
          tryListen(p + 1);
        } else {
          console.error(`Failed to bind server after ${attempts} attempts:`, err);
          process.exit(1);
        }
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });

    server.listen(p, () => {
      console.log(`🚀 Server running on http://localhost:${p}`);
      console.log('📡 WebSocket ready for connections');
      // remove the one-time error handler to avoid memory leaks
      server.removeAllListeners('error');
    });
  }

  tryListen(port);
}

startServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  io.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});