// /utils/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (socket) return socket;
  const url = import.meta.env.VITE_API_URL;
  socket = io(url, {
    withCredentials: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ["websocket"],
  });
  socket.on('connect', () => console.debug('shared socket connected', socket.id));
  socket.on('disconnect', (reason) => console.debug('shared socket disconnected', reason));
  return socket;
}

export function disconnectSocket() {
  try {
    if (socket) { socket.disconnect(); socket = null; }
  } catch (e) { /* ignore */ }
}
