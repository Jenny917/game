// src/socket.js
import { io } from 'socket.io-client';

// Use the production URL from Vercel, or fallback to localhost for development
const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const socket = io(URL);