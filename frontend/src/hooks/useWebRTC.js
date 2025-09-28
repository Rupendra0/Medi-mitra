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
  const queuedCandidatesRef = useRef([]); // Queue ICE candidates until remote description is set
  const pendingRemoteStreamRef = useRef(null); // Store remote stream when video element isn't ready

  // Enhanced ICE servers for better connectivity
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { 
      urls: ["turn:relay1.expressturn.com:3478?transport=udp", "turn:relay1.expressturn.com:3478?transport=tcp"],
      username: "efCZWX3MTI071W2V6N", 
      credential: "mGWa8dVKpR4FgpE" 
    },
    {
      urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443"],
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ];

  // Initialize
  useEffect(() => {
    socketRef.current = getSocket();

    // Register user - join room with their ID so they can receive WebRTC signals
    if (user?._id || user?.id) {
      const userId = user._id || user.id;
      console.log('🏠 Joining room for user:', userId);
      socketRef.current.emit("join", userId);
      
      // Also emit register for backup room joining
      socketRef.current.emit("register", userId);
      console.log('📝 Backup registration sent for user:', userId);
    }

    // Socket listeners
    socketRef.current.on("webrtc:offer", handleOffer);
    socketRef.current.on("webrtc:answer", handleAnswer);
    socketRef.current.on("webrtc:ice-candidate", handleIceCandidate);
    
    // Re-join room on socket reconnection
    socketRef.current.on("connect", () => {
      if (user?._id || user?.id) {
        const userId = user._id || user.id;
        console.log('🔄 Socket reconnected, re-joining room:', userId);
        socketRef.current.emit("join", userId);
        socketRef.current.emit("register", userId);
      }
    });
    
    // Debug: Log WebRTC listener status periodically
    const debugInterval = setInterval(() => {
      if (socketRef.current) {
        console.log('🔍 WebRTC Debug Check:', {
          socketConnected: socketRef.current.connected,
          hasOfferListener: socketRef.current.listeners('webrtc:offer').length > 0,
          callState: callState,
          userRole: user?.role,
          userId: user?._id || user?.id
        });
      }
    }, 10000); // Every 10 seconds

    return () => {
      clearInterval(debugInterval);
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
    console.log('� WEBRTC OFFER RECEIVED! 🚨');
    console.log('�📥 Incoming WebRTC offer from:', payload.from);
    console.log('📋 Offer payload:', payload);
    console.log('📋 Current call state:', callState);
    console.log('📋 Current user ID:', user?._id || user?.id);
    console.log('📋 Socket connected:', socketRef.current?.connected);
    
    setIncomingOffer(payload);
    setCallState('incoming');
    remoteUserIdRef.current = payload.from;
    
    console.log('✅ Offer processed, state set to incoming');
  };

  // Handle answer
  const handleAnswer = async (payload) => {
    try {
      console.log('📥 Received answer');
      if (pcRef.current && payload?.answer) {
        // Check signaling state before setting remote description
        const currentState = pcRef.current.signalingState;
        console.log('📋 Current signaling state:', currentState);
        
        if (currentState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          setCallState('active');
          
          // Process any queued ICE candidates
          console.log(`📥 Processing ${queuedCandidatesRef.current.length} queued ICE candidates`);
          for (const candidate of queuedCandidatesRef.current) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              console.log('✅ Queued ICE candidate processed');
            } catch (error) {
              console.warn('⚠️ Failed to process queued candidate:', error);
            }
          }
          queuedCandidatesRef.current = []; // Clear queue
        } else {
          console.warn('⚠️ Ignoring answer - not in correct signaling state:', currentState);
        }
      }
    } catch (error) {
      console.error('❌ Error processing answer:', error);
    }
  };

  // Handle ICE candidate with queuing
  const handleIceCandidate = async (payload) => {
    try {
      if (pcRef.current && payload?.candidate) {
        console.log('📥 Adding ICE candidate:', payload.candidate.candidate?.substring(0, 50) + '...');
        
        // Check if remote description is set
        if (pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          console.log('✅ ICE candidate added successfully');
        } else {
          // Queue candidate until remote description is available
          console.log('📦 Queueing ICE candidate - remote description not set yet');
          queuedCandidatesRef.current.push(payload.candidate);
        }
      }
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  };

  // Recreate peer connection if closed or invalid
  const createPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    
    pcRef.current = new RTCPeerConnection({ iceServers });
    
    // Set up event handlers
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && remoteUserIdRef.current) {
        console.log('📤 Sending ICE candidate');
        socketRef.current.emit("webrtc:ice-candidate", {
          candidate: event.candidate,
          to: remoteUserIdRef.current,
        });
      }
    };

    pcRef.current.ontrack = (event) => {
      console.log('📺 Received remote track:', event.track.kind);
      console.log('📺 Remote track details:', {
        trackId: event.track.id,
        trackEnabled: event.track.enabled,
        trackReadyState: event.track.readyState,
        streamsCount: event.streams.length,
        hasVideoElement: !!remoteVideoRef.current
      });
      
      if (event.streams[0]) {
        const stream = event.streams[0];
        console.log('🎥 Processing remote stream:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          active: stream.active
        });
        
        // Store the stream for later attachment if video element isn't ready
        pendingRemoteStreamRef.current = stream;
        
        if (remoteVideoRef.current) {
          console.log('✅ Video element ready, attaching stream immediately');
          remoteVideoRef.current.srcObject = stream;
          
          // Force video element to play
          remoteVideoRef.current.play().catch(e => {
            console.warn('⚠️ Remote video autoplay failed:', e);
          });
        } else {
          console.log('📦 Video element not ready, stream stored for later attachment');
        }
      } else {
        console.warn('⚠️ No stream in ontrack event');
      }
    };

    pcRef.current.oniceconnectionstatechange = () => {
      const state = pcRef.current.iceConnectionState;
      console.log('🔗 ICE Connection state:', state);
      
      if (state === 'connected' || state === 'completed') {
        console.log('✅ Call connected successfully!');
        setCallState('active');
      } else if (state === 'failed') {
        console.error('❌ ICE connection failed - checking firewall/network');
      } else if (state === 'disconnected') {
        console.warn('⚠️ ICE connection disconnected - may reconnect');
      } else if (state === 'checking') {
        console.log('🔍 ICE checking - establishing connection...');
      }
    };

    pcRef.current.onconnectionstatechange = () => {
      const state = pcRef.current.connectionState;
      console.log('🌐 Peer connection state:', state);
      
      if (state === 'failed') {
        console.error('❌ Peer connection failed completely');
      } else if (state === 'disconnected') {
        console.warn('⚠️ Peer connection disconnected');
      }
    };
  };

  // Start call (for doctor)
  const startCall = async (targetUserId) => {
    try {
      console.log('📞 Starting call to:', targetUserId);
      remoteUserIdRef.current = targetUserId;
      
      // Create fresh peer connection
      createPeerConnection();
      
      // Get local media with error handling
      console.log('🎥 Requesting camera and microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('✅ Local video stream attached');
      }
      
      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        console.log('➕ Adding track:', track.kind, track.label);
        pcRef.current.addTrack(track, stream);
      });
      
      // Create and send offer
      console.log('📝 Creating offer...');
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      console.log('✅ Local description set, sending offer');
      
      const offerPayload = {
        offer,
        to: targetUserId,
        from: user?._id || user?.id
      };
      console.log('📤 Emitting WebRTC offer:', offerPayload);
      socketRef.current.emit("webrtc:offer", offerPayload);
      
      setCallState('calling');
    } catch (error) {
      console.error('❌ Error starting call:', error);
      setCallState('idle');
    }
  };

  // Answer call (for patient)
  const answerCall = async () => {
    try {
      console.log('📞 Answering call');
      
      if (!incomingOffer) {
        console.error('❌ No incoming offer to answer');
        return;
      }
      
      // Create fresh peer connection for answering
      createPeerConnection();
      
      // Get local media
      console.log('🎥 Patient requesting camera and microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('✅ Patient local video stream attached');
      }
      
      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        console.log('➕ Patient adding track:', track.kind, track.label);
        pcRef.current.addTrack(track, stream);
      });
      
      // Set remote description and create answer
      console.log('📝 Setting remote description and creating answer...');
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingOffer.offer));
      
      // Process any queued ICE candidates now that remote description is set
      console.log(`📥 Processing ${queuedCandidatesRef.current.length} queued ICE candidates`);
      for (const candidate of queuedCandidatesRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('✅ Queued ICE candidate processed');
        } catch (error) {
          console.warn('⚠️ Failed to process queued candidate:', error);
        }
      }
      queuedCandidatesRef.current = []; // Clear queue
      
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      console.log('✅ Answer created and local description set');
      
      // Send answer
      socketRef.current.emit("webrtc:answer", {
        answer,
        to: incomingOffer.from,
      });
      console.log('📤 Answer sent to doctor');
      
      setCallState('active');
      setIncomingOffer(null);
    } catch (error) {
      console.error('❌ Error answering call:', error);
      setCallState('idle');
    }
  };

  // Retry attaching pending remote stream when video element becomes available
  const retryRemoteStreamAttachment = () => {
    if (pendingRemoteStreamRef.current && remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
      console.log('🔄 Retrying remote stream attachment');
      console.log('🎥 Attaching pending remote stream:', {
        streamId: pendingRemoteStreamRef.current.id,
        videoTracks: pendingRemoteStreamRef.current.getVideoTracks().length,
        audioTracks: pendingRemoteStreamRef.current.getAudioTracks().length,
        active: pendingRemoteStreamRef.current.active
      });
      
      remoteVideoRef.current.srcObject = pendingRemoteStreamRef.current;
      
      // Force video element to play
      remoteVideoRef.current.play().catch(e => {
        console.warn('⚠️ Remote video autoplay failed:', e);
      });
      
      console.log('✅ Pending remote stream attached successfully');
      return true;
    }
    return false;
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
      pcRef.current = null;
    }
    
    // Reset state
    setCallState('idle');
    setIncomingOffer(null);
    remoteUserIdRef.current = null;
    queuedCandidatesRef.current = []; // Clear queued candidates
    pendingRemoteStreamRef.current = null; // Clear pending remote stream
    
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
    retryRemoteStreamAttachment,
    incomingOffer,
    callState
  };
}
