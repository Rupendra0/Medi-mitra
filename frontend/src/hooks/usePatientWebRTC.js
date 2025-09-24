import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { getSocket } from '../utils/socket';

export const usePatientWebRTC = () => {
  const { user } = useSelector((state) => state.auth);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const pcRef = useRef(null); // PeerConnection
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = getSocket();
    
    const handleOffer = (data) => {
      console.log("Incoming call offer from doctor:", data);
      const pc = new RTCPeerConnection(); // Create PeerConnection on offer
      pcRef.current = pc;
      
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };
      
      // Add more WebRTC event listeners here (onicecandidate, etc.)
      
      setIncomingCall({ from: data.fromUserId, offer: data.offer });
    };

    socketRef.current.on('webrtc:offer', handleOffer);

    return () => {
      socketRef.current.off('webrtc:offer', handleOffer);
    };
  }, []);

  const acceptCall = async () => {
    if (!incomingCall || !pcRef.current) return;
    
    const pc = pcRef.current;
    
    // Get local media
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    setLocalStream(stream);

    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit('webrtc:answer', { to: incomingCall.from, answer });
    setIncomingCall(null); // Clear the incoming call notification
  };

  const declineCall = () => {
    // Logic to decline the call
    setIncomingCall(null);
  };
  
  const endCall = () => {
    // Logic to end an active call
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setRemoteStream(null);
  };

  return { incomingCall, localStream, remoteStream, acceptCall, declineCall, endCall };
};
