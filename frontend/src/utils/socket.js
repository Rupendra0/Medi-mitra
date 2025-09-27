// /utils/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (socket) return socket;
  const url = import.meta.env.VITE_API_URL;
  const authToken = typeof window !== 'undefined' ? window.__AUTH_TOKEN : undefined;
  console.log("🔌 Creating socket connection:", { url, hasAuthToken: !!authToken });
  socket = io(url, {
    withCredentials: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ["websocket", "polling"],
    ...(authToken ? { auth: { token: authToken } } : {}),
  });
  socket.on('connect', () => console.log('✅ Shared socket connected:', socket.id));
  socket.on('disconnect', (reason) => console.log('❌ Shared socket disconnected:', reason));
  socket.on('connect_error', (error) => console.error('❌ Socket connection error:', error.message));
  if (import.meta.env.DEV) {
    socket.onAny((e, p) => console.debug('[socket:event]', e, p));
  }
  return socket;
}

// Reinitialize socket when a token becomes available after an unauth connection
export function ensureAuthedSocket() {
  const token = typeof window !== 'undefined' ? window.__AUTH_TOKEN : undefined;
  if (!token) return getSocket();
  if (socket && socket.auth?.token === token) return socket;
  if (socket && !socket.auth?.token) {
    console.log('🔄 Re-authenticating socket with token');
    try { socket.disconnect(); } catch {}
    socket = null;
  }
  return getSocket();
}

export function disconnectSocket() {
  try {
    if (socket) { socket.disconnect(); socket = null; }
  } catch (e) { /* ignore */ }
}
