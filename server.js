const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rooms store: Map<roomId, { hostId, participants: Map<socketId, name> }>
const rooms = new Map();

app.post('/create-room', (req, res) => {
  const roomId = uuidv4();
  rooms.set(roomId, { hostId: null, participants: new Map() });
  res.json({ roomId });
});

app.get('/room-exists/:id', (req, res) => {
  const { id } = req.params;
  res.json({ exists: rooms.has(id) });
});

app.get('/r/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', socket => {
  socket.on('join-room', ({ roomId, name }, cb) => {
    if (!roomId) return cb && cb({ error: 'Invalid room id' });
    // create room if doesn't exist (allow join/create from client)
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { hostId: socket.id, participants: new Map() });
    }
    const room = rooms.get(roomId);
    // set host if not set
    if (!room.hostId) room.hostId = socket.id;

    room.participants.set(socket.id, name || 'Anonymous');
    socket.join(roomId);

    // notify others
    socket.to(roomId).emit('participant-joined', { id: socket.id, name });

    // return existing participants to caller
    const others = [];
    for (const [id, nm] of room.participants.entries()) {
      if (id !== socket.id) others.push({ id, name: nm });
    }
    cb && cb({ success: true, participants: others, hostId: room.hostId });
  });

  socket.on('signal', ({ to, data }) => {
    if (!to) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('chat-message', ({ roomId, message, name }) => {
    if (!roomId || !message) return;
    const ts = Date.now();
    io.to(roomId).emit('chat-message', { id: socket.id, name, message, ts });
  });

  socket.on('leave-room', ({ roomId }) => {
    leaveRoomCleanup(socket, roomId);
  });

  socket.on('end-room', ({ roomId }) => {
    // only host can end
    const room = rooms.get(roomId);
    if (room && room.hostId === socket.id) {
      io.to(roomId).emit('room-ended');
      // close sockets in that room
      for (const id of room.participants.keys()) {
        const s = io.sockets.sockets.get(id);
        if (s) s.leave(roomId);
      }
      rooms.delete(roomId);
    }
  });

  socket.on('disconnecting', () => {
    // remove from all rooms
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      leaveRoomCleanup(socket, roomId);
    }
  });

  function leaveRoomCleanup(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.participants.delete(socket.id);
    socket.to(roomId).emit('participant-left', { id: socket.id });
    // if host left, pick a new host
    if (room.hostId === socket.id) {
      const next = room.participants.keys().next();
      if (next.done) {
        rooms.delete(roomId);
      } else {
        room.hostId = next.value;
        io.to(roomId).emit('host-changed', { hostId: room.hostId });
      }
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
