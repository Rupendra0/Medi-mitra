// /utils/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  // Reuse existing instance to avoid multiple parallel handshakes
  if (socket) return socket;

  const url = import.meta.env.VITE_API_URL;
  const authToken = typeof window !== 'undefined' ? window.__AUTH_TOKEN : undefined;
  console.log("🔌 Creating socket connection:", {
    url,
    hasAuthToken: !!authToken,
    authToken: authToken ? `${authToken.substring(0, 10)}...` : 'none'
  });
  socket = io(url, {
    withCredentials: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ["websocket", "polling"],
    ...(authToken ? { auth: { token: authToken } } : {}),
  });
  socket.on('connect', () => console.log('✅ Shared socket connected:', socket.id));
  socket.on('disconnect', (reason) => console.log('❌ Shared socket disconnected:', reason));
  socket.on('connect_error', (error) => console.error('❌ Socket connection error:', error));
  return socket;
}

export function disconnectSocket() {
  try {
    if (socket) { socket.disconnect(); socket = null; }
  } catch (e) { /* ignore */ }
}
