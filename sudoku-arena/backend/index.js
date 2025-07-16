// --- Basic Server Setup ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allows your frontend to connect
    methods: ["GET", "POST"]
  }
});

// --- Game State Management ---
// This simple object will store the state of all active game rooms.
const rooms = {};


// --- Socket.IO Event Handling ---
io.on('connection', (socket) => {
  console.log(`✅ User Connected: ${socket.id}`);

  // Event: When a player wants to create a new game room
  socket.on('createRoom', ({ puzzle, initialPuzzle }) => {
    // Generate a simple, random 6-digit room ID
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    socket.join(roomId);

    // Store the room's initial state
    rooms[roomId] = {
      players: [{ id: socket.id }],
      puzzle: puzzle,
      initialPuzzle: initialPuzzle,
    };

    console.log(`🚪 Room Created: ${roomId} by ${socket.id}`);
    // Send the new room's ID back to the player who created it
    socket.emit('roomCreated', { roomId });
  });

  // Event: When a player wants to join an existing room
  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];

    // Check if the room exists and is not full
    if (room && room.players.length < 2) {
      socket.join(roomId);
      room.players.push({ id: socket.id, puzzle: null });
      
      console.log(`🤝 User ${socket.id} joined Room: ${roomId}`);

      // Both players are in, let's start the game!
      // Broadcast the initial puzzle AND THE ROOM ID to everyone.
      io.to(roomId).emit('gameStart', {
        puzzle: room.puzzle,
        initialPuzzle: room.initialPuzzle,
        roomId: roomId // <-- THE FIX: Send the roomId to both players
      });

    } else {
      // If room is full or doesn't exist, send an error
      socket.emit('error', { message: "Room is full or does not exist." });
    }
  });

  // Event: When a player makes a move, broadcast it to the other player
  socket.on('playerMove', ({ roomId, puzzleState }) => {
    // 'socket.to(roomId)' sends a message to everyone in the room *except* the sender.
    socket.to(roomId).emit('opponentMove', puzzleState);
  });
  
  // Event: When a player wins, notify the other player
  socket.on('gameOver', ({ roomId }) => {
    socket.to(roomId).emit('opponentWon');
  });

  // Event: Clean up when a player disconnects
  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    // We need to find which room the player was in to notify the opponent
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        // Remove the player and tell the other one their opponent left
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('opponentLeft');
        
        // If the room is now empty, we can delete it
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