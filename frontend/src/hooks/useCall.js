import { useState, useEffect, useCallback } from 'react';
import { useCall as useBasicCallContext } from '../context/CallContext';

/**
 * Temporary shim for call management until full WebRTC signaling is integrated.
 * Exposes a richer interface expected by CallPage built on top of simpler CallContext.
 */
function useCall(){
  const { incomingCall, isRinging, simulateIncomingCall, answerCall, declineCall } = useBasicCallContext();
  const [state, setState] = useState('idle'); // idle|calling|ringing|connecting|active|busy|error|ended
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [reason, setReason] = useState('');

  // Start an outgoing call (doctor -> patient)
  const startCall = useCallback(async (patientId) => {
    try {
      setState('calling');
      // Acquire local media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      // TODO: signaling to server to invite patient
      // For now simulate remote acceptance after delay
      setTimeout(() => {
        setState('connecting');
        // Simulate remote stream (loopback for placeholder)
        setRemoteStream(stream.clone());
        setState('active');
      }, 2000);
    } catch (err) {
      console.error('Failed to start call', err);
      setReason(err.message || 'Media error');
      setState('error');
    }
  }, []);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    try {
      setState('connecting');
      answerCall();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      // Simulate remote side
      setTimeout(() => {
        setRemoteStream(stream.clone());
        setState('active');
      }, 1000);
    } catch (err) {
      console.error('Failed to accept call', err);
      setReason(err.message || 'Media error');
      setState('error');
    }
  }, [answerCall]);

  // End call (hang up / reject)
  const endCall = useCallback(() => {
    declineCall();
    setState(prev => (prev === 'ringing' ? 'idle' : 'ended'));
    localStream?.getTracks().forEach(t => t.stop());
    remoteStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
  }, [declineCall, localStream, remoteStream]);

  // Toggle media
  const toggleAudio = useCallback(() => {
    setAudioEnabled(a => {
      const next = !a;
      localStream?.getAudioTracks().forEach(t => t.enabled = next);
      return next;
    });
  }, [localStream]);
  const toggleVideo = useCallback(() => {
    setVideoEnabled(v => {
      const next = !v;
      localStream?.getVideoTracks().forEach(t => t.enabled = next);
      return next;
    });
  }, [localStream]);

  // Reflect context ringing into local state machine
  useEffect(() => {
    if (isRinging && state === 'idle') setState('ringing');
    if (!isRinging && state === 'ringing' && !incomingCall) setState('idle');
  }, [isRinging, state, incomingCall]);

  return {
    state,
    startCall,
    acceptCall,
    endCall,
    localStream,
    remoteStream,
    toggleAudio,
    toggleVideo,
    audioEnabled,
    videoEnabled,
    reason,
    simulateIncomingCall // exposed for testing/dev
  };
}

export { useCall };
export default useCall;