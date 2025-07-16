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


// --- UPDATED API ENDPOINT FOR PUZZLES WITH DIFFICULTY ---
app.get('/api/new-puzzle', (req, res) => {
  const difficulty = req.query.difficulty || 'medium';
  let puzzle;
  let attempts = 0;
  const maxAttempts = 1000; // Safety break to prevent infinite loops

  // Loop until we find a puzzle of the correct difficulty or hit max attempts
  while (attempts < maxAttempts) {
    attempts++;
    const generatedPuzzle = sudoku.makepuzzle();
    const rating = sudoku.ratepuzzle(generatedPuzzle, 5); // Rate puzzle difficulty

    // Difficulty mapping (you can adjust these values if you like)
    const isEasy = rating < 0.5;
    const isMedium = rating >= 0.5 && rating < 0.75;
    const isHard = rating >= 0.75;

    if (
      (difficulty === 'easy' && isEasy) ||
      (difficulty === 'medium' && isMedium) ||
      (difficulty === 'hard' && isHard)
    ) {
      puzzle = generatedPuzzle;
      break; // Found a matching puzzle, exit the loop
    }
  }

  // If we couldn't find a matching puzzle, just send the last one generated
  if (!puzzle) {
    puzzle = sudoku.makepuzzle();
  }

  const puzzleString = puzzle.map(num => (num === null ? '.' : num + 1)).join('');
  
  console.log(`🧩 New '${difficulty}' puzzle generated and sent after ${attempts} attempts.`);
  res.json({ puzzle: puzzleString });
});
// --------------------------------------------------------


// --- Game State Management & Socket.IO (No changes here) ---
const rooms = {};

function handleLeave(socketId) {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socketId);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('opponentLeft');
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ puzzle, initialPuzzle }) => {
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    socket.join(roomId);
    rooms[roomId] = { players: [{ id: socket.id }], puzzle, initialPuzzle };
    socket.emit('roomCreated', { roomId });
  });

  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.players.length < 2) {
      socket.join(roomId);
      room.players.push({ id: socket.id });
      io.to(roomId).emit('gameStart', { puzzle: room.puzzle, initialPuzzle: room.initialPuzzle, roomId });
    } else {
      socket.emit('error', { message: "Room is full or does not exist." });
    }
  });

  socket.on('playerMove', ({ roomId, puzzleState }) => { socket.to(roomId).emit('opponentMove', puzzleState); });
  socket.on('gameOver', ({ roomId }) => { socket.to(roomId).emit('opponentWon'); });
  socket.on('leaveRoom', ({ roomId }) => { socket.leave(roomId); handleLeave(socket.id); });
  socket.on('disconnect', () => { handleLeave(socket.id); });
});

// --- Start the Server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});