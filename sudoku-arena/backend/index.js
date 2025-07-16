// --- Basic Server Setup ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// --- CORRECTED Socket.IO CONFIGURATION ---
const io = new Server(server, {
  cors: {
    origin: "*", // Allows your frontend to connect
    methods: ["GET", "POST"]
  },
  // Add these options to handle connection health checks for Render
  pingInterval: 20000, // Sends a ping every 20 seconds
  pingTimeout: 5000,   // Waits 5 seconds for a pong response before closing
});
// -----------------------------------------


// --- Game State Management ---
const rooms = {};


// --- Socket.IO Event Handling ---
io.on('connection', (socket) => {
  console.log(`✅ User Connected: ${socket.id}`);

  socket.on('createRoom', ({ puzzle, initialPuzzle }) => {
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    socket.join(roomId);

    rooms[roomId] = {
      players: [{ id: socket.id }],
      puzzle: puzzle,
      initialPuzzle: initialPuzzle,
    };

    console.log(`🚪 Room Created: ${roomId} by ${socket.id}`);
    socket.emit('roomCreated', { roomId });
  });

  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.players.length < 2) {
      socket.join(roomId);
      room.players.push({ id: socket.id });
      console.log(`🤝 User ${socket.id} joined Room: ${roomId}`);
      io.to(roomId).emit('gameStart', {
        puzzle: room.puzzle,
        initialPuzzle: room.initialPuzzle,
        roomId: roomId
      });
    } else {
      socket.emit('error', { message: "Room is full or does not exist." });
    }
  });

  socket.on('playerMove', ({ roomId, puzzleState }) => {
    socket.to(roomId).emit('opponentMove', puzzleState);
  });
  
  socket.on('gameOver', ({ roomId }) => {
    socket.to(roomId).emit('opponentWon');
  });

  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('opponentLeft');
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`🗑️ Room ${roomId} is empty and has been deleted.`);
        }
        break;
      }
    }
  });
});


// --- Start the Server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});