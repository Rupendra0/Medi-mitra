// frontend/src/webrtc/webrtcClient.js
// Minimal WebRTC client helper implementing simple call:* signaling contract.
// Keeps things intentionally small & readable.
import { getSocket } from '../utils/socket';

// STUN + optional TURN (load up to 3 TURN entries from env for simplicity)
function buildIceServers() {
  const ice = [ { urls: 'stun:stun.l.google.com:19302' } ];
  const turnEntries = [
    { url: import.meta.env.VITE_TURN_URL_1, user: import.meta.env.VITE_TURN_USER_1, pass: import.meta.env.VITE_TURN_PASS_1 },
    { url: import.meta.env.VITE_TURN_URL_2, user: import.meta.env.VITE_TURN_USER_2, pass: import.meta.env.VITE_TURN_PASS_2 },
    { url: import.meta.env.VITE_TURN_URL_3, user: import.meta.env.VITE_TURN_USER_3, pass: import.meta.env.VITE_TURN_PASS_3 },
  ].filter(e => e.url);
  turnEntries.slice(0,3).forEach(t => {
    ice.push({ urls: t.url, username: t.user, credential: t.pass });
  });
  return ice;
}
export const ICE_SERVERS = buildIceServers();

// Generate a simple callId (you could swap to uuid later)
function simpleId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createCallController(currentUserId) {
  const socket = getSocket();
  let pc = null;
  let localStream = null;
  let remoteStream = null;
  let callId = null;
  let peerUserId = null;
  let state = 'idle'; // idle | ringing | calling | connecting | active | ended | busy | error
  let lastReason = null;

  const listeners = new Set();
  function emitUpdate() {
    for (const fn of listeners) fn(getSnapshot());
  }
  function getSnapshot() {
    return { state, callId, peerUserId, localStream, remoteStream, reason: lastReason };
  }

  function ensurePC() {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && callId) {
        socket.emit('call:ice', { callId, candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      remoteStream = e.streams[0];
      emitUpdate();
    };
    return pc;
  }

  async function getMedia() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return localStream;
  }

  async function startCall(targetUserId, fromName) {
    if (state !== 'idle') return;
    callId = simpleId();
    peerUserId = targetUserId;
    state = 'calling';
    socket.emit('call:request', { callId, toUserId: targetUserId, fromName });
    emitUpdate();
  }

  function cancelCall() {
    if (state === 'calling' && callId) {
      socket.emit('call:cancel', { callId });
      endInternal('cancelled');
    }
  }

  async function acceptCall(incoming) {
    if (state !== 'ringing') return;
    state = 'connecting';
    socket.emit('call:accept', { callId });
    // Offer will arrive from caller afterwards
    emitUpdate();
  }

  function rejectCall() {
    if (state === 'ringing' && callId) {
      socket.emit('call:reject', { callId });
      endInternal('rejected');
    }
  }

  async function handleOffer({ sdp }) {
    // We are callee, create answer
    const pc = ensurePC();
    const stream = await getMedia();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('call:answer', { callId, sdp: answer });
    localStream = stream;
    state = 'active';
    emitUpdate();
  }

  async function handleAccept() {
    // We are caller, now send offer
    state = 'connecting';
    const pc = ensurePC();
    const stream = await getMedia();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call:offer', { callId, sdp: offer });
    localStream = stream;
    emitUpdate();
  }

  async function handleAnswer({ sdp }) {
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    state = 'active';
    emitUpdate();
  }

  async function handleIce({ candidate }) {
    if (pc && candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  }

  function endInternal(reason) {
    if (pc) { pc.onicecandidate = null; pc.ontrack = null; pc.close(); pc = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); }
    lastReason = reason || null;
    state = reason === 'busy' ? 'busy' : (reason === 'error' ? 'error' : 'ended');
    emitUpdate();
    // Don't clear callId immediately so UI can show final state
    setTimeout(() => { callId = null; peerUserId = null; localStream = null; remoteStream = null; emitUpdate(); state = 'idle'; emitUpdate(); }, 800);
  }

  function endCall() {
    if (callId) socket.emit('call:end', { callId, reason: 'ended' });
    endInternal('ended');
  }

  // Socket inbound handlers
  socket.on('call:request', (p) => {
    if (p.toUserId && p.toUserId !== currentUserId) return;
    if (state !== 'idle') {
      // Instead of silent reject, signal busy (server may also send call:busy proactively)
      socket.emit('call:reject', { callId: p.callId });
      return;
    }
    callId = p.callId; peerUserId = p.fromUserId; state = 'ringing'; lastReason = null; emitUpdate();
  });
  socket.on('call:busy', ({ callId: cid }) => { if (cid === callId) { endInternal('busy'); } });
  socket.on('call:cancel', ({ callId: cid }) => { if (cid === callId) endInternal('cancelled'); });
  socket.on('call:reject', ({ callId: cid }) => { if (cid === callId) endInternal('rejected'); });
  socket.on('call:accept', ({ callId: cid }) => { if (cid === callId) handleAccept(); });
  socket.on('call:offer', ({ callId: cid, sdp }) => { if (cid === callId) handleOffer({ sdp }); });
  socket.on('call:answer', ({ callId: cid, sdp }) => { if (cid === callId) handleAnswer({ sdp }); });
  socket.on('call:ice', ({ callId: cid, candidate }) => { if (cid === callId) handleIce({ candidate }); });
  socket.on('call:end', ({ callId: cid }) => { if (cid === callId) endInternal('ended'); });

  // Media control helpers
  function toggleAudio() {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      emitUpdate();
    }
  }
  function toggleVideo() {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      emitUpdate();
    }
  }
  function getAudioEnabled() {
    return localStream ? localStream.getAudioTracks().some(t => t.enabled) : false;
  }
  function getVideoEnabled() {
    return localStream ? localStream.getVideoTracks().some(t => t.enabled) : false;
  }

  return {
    subscribe(fn) { listeners.add(fn); fn(getSnapshot()); return () => listeners.delete(fn); },
    startCall,
    cancelCall,
    acceptCall,
    rejectCall,
    endCall,
    getSnapshot,
    toggleAudio,
    toggleVideo,
    getAudioEnabled,
    getVideoEnabled,
  };
}
