import { io } from 'socket.io-client';

// The URL of our backend server
const URL = 'http://localhost:3001';

export const socket = io(URL);