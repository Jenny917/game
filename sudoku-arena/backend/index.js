// --- Basic Server Setup ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const sudoku = require('sudoku');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 20000,
  pingTimeout: 5000,
});

// --- API ENDPOINT FOR PUZZLES ---
app.get('/api/new-puzzle', (req, res) => {
  const puzzle = sudoku.makepuzzle();
  const puzzleString = puzzle.map(num => (num === null ? '.' : num + 1)).join('');
  console.log('🧩 New puzzle generated and sent.');
  res.json({ puzzle: puzzleString });
});

// --- Game State Management ---
const rooms = {};

// --- Helper function to handle leaving a room ---
function handleLeave(socketId) {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socketId);
      
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
}

// --- Socket.IO Event Handling ---
io.on('connection', (socket) => {
  console.log(`✅ User Connected: ${socket.id}`);

  socket.on('createRoom', ({ puzzle, initialPuzzle }) => {
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    socket.join(roomId);
    rooms[roomId] = { players: [{ id: socket.id }], puzzle, initialPuzzle };
    console.log(`🚪 Room Created: ${roomId} by ${socket.id}`);
    socket.emit('roomCreated', { roomId });
  });

  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.players.length < 2) {
      socket.join(roomId);
      room.players.push({ id: socket.id });
      console.log(`🤝 User ${socket.id} joined Room: ${roomId}`);
      io.to(roomId).emit('gameStart', { puzzle: room.puzzle, initialPuzzle: room.initialPuzzle, roomId });
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

  // --- NEW: Handle a player intentionally leaving a match ---
  socket.on('leaveRoom', ({ roomId }) => {
      console.log(`🚶 User ${socket.id} left Room: ${roomId}`);
      socket.leave(roomId);
      handleLeave(socket.id);
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    handleLeave(socket.id); // Use the same logic for disconnects
  });
});


// --- Start the Server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});