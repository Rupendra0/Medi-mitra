// Fresh WebRTC Hook - Simplified for Demo
import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';

export default function useWebRTC(user) {
  // States
  const [callState, setCallState] = useState('idle'); // idle, incoming, active
  const [incomingOffer, setIncomingOffer] = useState(null);
  
  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);

  // Simple ICE servers
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { 
      urls: "turn:relay1.expressturn.com:3478",
      username: "efCZWX3MTI071W2V6N", 
      credential: "mGWa8dVKpR4FgpE" 
    }
  ];

  // Initialize
  useEffect(() => {
    socketRef.current = getSocket();
    
    // Create peer connection
    pcRef.current = new RTCPeerConnection({ iceServers });
    
    // Handle remote stream
    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    // Handle ICE candidates
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate && remoteUserIdRef.current) {
        socketRef.current.emit("webrtc:ice-candidate", {
          candidate: event.candidate,
          to: remoteUserIdRef.current,
        });
      }
    };
    
    // Connection state
    pcRef.current.oniceconnectionstatechange = () => {
      const state = pcRef.current.iceConnectionState;
      console.log('Connection state:', state);
      
      if (state === 'connected' || state === 'completed') {
        console.log('✅ Call connected successfully!');
        setCallState('active');
      }
    };

    // Register user
    if (user?._id) {
      socketRef.current.emit("register", user._id);
    }

    // Socket listeners
    socketRef.current.on("webrtc:offer", handleOffer);
    socketRef.current.on("webrtc:answer", handleAnswer);
    socketRef.current.on("webrtc:ice-candidate", handleIceCandidate);

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [user]);

  // Handle incoming offer
  const handleOffer = async (payload) => {
    console.log('📥 Incoming offer from:', payload.from);
    setIncomingOffer(payload);
    setCallState('incoming');
    remoteUserIdRef.current = payload.from;
  };

  // Handle answer
  const handleAnswer = async (payload) => {
    console.log('📥 Received answer');
    if (pcRef.current && payload?.answer) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
      setCallState('active');
    }
  };

  // Handle ICE candidate
  const handleIceCandidate = async (payload) => {
    if (pcRef.current && payload?.candidate) {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
  };

  // Start call (for doctor)
  const startCall = async (targetUserId) => {
    console.log('📞 Starting call to:', targetUserId);
    remoteUserIdRef.current = targetUserId;
    
    // Get local media
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    
    // Add tracks to peer connection
    stream.getTracks().forEach(track => {
      pcRef.current.addTrack(track, stream);
    });
    
    // Create and send offer
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    
    socketRef.current.emit("webrtc:offer", {
      offer,
      to: targetUserId,
    });
    
    setCallState('calling');
  };

  // Answer call (for patient)
  const answerCall = async () => {
    console.log('📞 Answering call');
    
    if (!incomingOffer) return;
    
    // Get local media
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    
    // Add tracks to peer connection
    stream.getTracks().forEach(track => {
      pcRef.current.addTrack(track, stream);
    });
    
    // Set remote description and create answer
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingOffer.offer));
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    
    // Send answer
    socketRef.current.emit("webrtc:answer", {
      answer,
      to: incomingOffer.from,
    });
    
    setCallState('active');
    setIncomingOffer(null);
  };

  // End call
  const endCall = () => {
    console.log('📞 Ending call');
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = new RTCPeerConnection({ iceServers });
      
      // Re-setup handlers
      pcRef.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      pcRef.current.onicecandidate = (event) => {
        if (event.candidate && remoteUserIdRef.current) {
          socketRef.current.emit("webrtc:ice-candidate", {
            candidate: event.candidate,
            to: remoteUserIdRef.current,
          });
        }
      };
    }
    
    // Reset state
    setCallState('idle');
    setIncomingOffer(null);
    remoteUserIdRef.current = null;
    
    // Clear video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  return {
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    endCall,
    incomingOffer,
    callState
  };
}
