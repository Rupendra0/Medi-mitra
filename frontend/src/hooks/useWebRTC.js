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
  const lastRemoteStreamIdRef = useRef(null); // Track the stream already attached to avoid duplicate loads

  const ensureRemotePlayback = (videoEl, attempt = 0) => {
    if (!videoEl) return;
    if (videoEl !== remoteVideoRef.current) return; // element replaced during retry
    if (!videoEl.srcObject) return;

    // If already playing, nothing else to do
    if (!videoEl.paused && !videoEl.ended && videoEl.readyState >= 2) {
      return;
    }

    const maxAttempts = 9;
    const scheduleRetry = (reason) => {
      if (attempt >= maxAttempts) {
        console.warn('⚠️ Remote autoplay giving up after max attempts:', reason);
        return;
      }
      const delay = Math.min(900, 150 * (attempt + 1));
      setTimeout(() => ensureRemotePlayback(remoteVideoRef.current, attempt + 1), delay);
    };

    if (!videoEl.isConnected) {
      console.debug('⏸️ Remote video element not yet in DOM, retrying autoplay');
      scheduleRetry('not-connected');
      return;
    }

    const attemptPlay = () => {
      if (!videoEl || videoEl !== remoteVideoRef.current) return;
      if (!videoEl.srcObject) return;

      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(err => {
          console.warn('⚠️ Remote video autoplay failed (attempt):', err?.message || err);
          if (err?.name === 'AbortError' || /interrupted/i.test(err?.message || '')) {
            scheduleRetry('abort');
          } else if (err?.name === 'NotAllowedError') {
            scheduleRetry('not-allowed');
          }
        });
      }
    };

    if (videoEl.readyState < 1) {
      const onLoaded = () => ensureRemotePlayback(remoteVideoRef.current, attempt);
      videoEl.addEventListener('loadedmetadata', onLoaded, { once: true });
    }

    requestAnimationFrame(() => {
      if (!videoEl.isConnected) {
        scheduleRetry('raf-not-connected');
        return;
      }
      attemptPlay();
    });
  };

  // Enhanced ICE servers for better connectivity
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:80?transport=tcp",
        "turn:global.relay.metered.ca:443",
        "turns:global.relay.metered.ca:443?transport=tcp"
      ],
      username: "fccf4b3716ec7a673902fe44",
      credential: "I6Yf9nfUgNtctLfR"
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

    // Initialize local media stream for patients to ensure camera/mic is ready
    if (user?.role === 'patient') {
      console.log('👤 Patient detected - initializing camera/microphone...');
      initializeLocalMedia();
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
    
    // Check if we're already in a call to prevent duplicate processing
    if (callState !== 'idle') {
      console.log('⚠️ IGNORING OFFER: Already in call state:', callState);
      return;
    }
    
    setIncomingOffer(payload);
    setCallState('incoming');
    remoteUserIdRef.current = payload.from;
    
    console.log('✅ OFFER PROCESSED: State changed from idle to incoming - ready to answer');
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

        const attachStream = (videoEl, s) => {
          try {
            if (videoEl.srcObject === s || lastRemoteStreamIdRef.current === s.id) {
              console.log('🔁 Remote stream already attached, ensuring playback');
              ensureRemotePlayback(videoEl);
              return;
            }

            videoEl.srcObject = s;
            videoEl.muted = true; // keep muted for autoplay compliance
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.preload = 'auto';
            lastRemoteStreamIdRef.current = s.id;

            ensureRemotePlayback(videoEl);
          } catch (err) {
            console.warn('⚠️ Error attaching remote stream:', err);
          }
        };

        if (remoteVideoRef.current) {
          console.log('✅ Video element ready, attaching stream immediately');
          // schedule attachment on next tick to avoid DOM removal race
          setTimeout(() => attachStream(remoteVideoRef.current, stream), 0);
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
        unmuteRemote();
        if (pcRef.current) {
          pcRef.current.getReceivers().forEach(receiver => {
            if (receiver.track && receiver.track.kind === 'audio') {
              receiver.track.enabled = true;
            }
          });
        }
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

  // Initialize local media stream (for patients to be ready)
  const initializeLocalMedia = async () => {
    try {
      console.log('🚀 initializeLocalMedia called for patient');
      
      if (localStreamRef.current) {
        console.log('📱 Local media already initialized');
        return;
      }

      console.log('🎥 Initializing patient camera and microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('✅ Patient local video stream ready');
      } else {
        console.log('📦 Local video element not ready, stream stored');
      }
    } catch (error) {
      console.error('❌ Failed to initialize patient media:', error);
      if (error.name === 'NotAllowedError') {
        console.error('🚫 Camera/microphone permission denied');
      } else if (error.name === 'NotFoundError') {
        console.error('📷 No camera/microphone found');
      } else if (error.name === 'NotReadableError') {
        console.error('🔒 Camera/microphone already in use');
      }
    }
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
      const stream = pendingRemoteStreamRef.current;
      console.log('🎥 Attaching pending remote stream:', {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        active: stream.active
      });

      // reuse same attachment strategy as ontrack
      setTimeout(() => {
        try {
          if (remoteVideoRef.current.srcObject === stream || lastRemoteStreamIdRef.current === stream.id) {
            console.log('🔁 Remote stream already attached during retry, ensuring playback');
            remoteVideoRef.current.muted = true;
            ensureRemotePlayback(remoteVideoRef.current);
            return;
          }
          remoteVideoRef.current.srcObject = stream;
          // keep muted for autoplay compliance; UI can unmute later
          remoteVideoRef.current.muted = true;
          remoteVideoRef.current.autoplay = true;
          remoteVideoRef.current.playsInline = true;
          remoteVideoRef.current.preload = 'auto';
          lastRemoteStreamIdRef.current = stream.id;
          ensureRemotePlayback(remoteVideoRef.current);
        } catch (err) {
          console.warn('⚠️ Error during retry attachment:', err);
        }
      }, 0);

      console.log('✅ Pending remote stream attachment scheduled');
      return true;
    }
    return false;
  };

  // Retry local stream attachment when video element becomes available
  const retryLocalStreamAttachment = () => {
    if (localStreamRef.current && localVideoRef.current && !localVideoRef.current.srcObject) {
      console.log('📱 Attaching local stream to video element');
      localVideoRef.current.srcObject = localStreamRef.current;
      console.log('✅ Local stream attached successfully');
      return true;
    }
    return false;
  };

  const unmuteRemote = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
      ensureRemotePlayback(remoteVideoRef.current);
    }
    if (pcRef.current) {
      pcRef.current.getReceivers().forEach(receiver => {
        if (receiver.track && receiver.track.kind === 'audio') {
          receiver.track.enabled = true;
        }
      });
    }
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
    lastRemoteStreamIdRef.current = null; // Reset attached stream tracker
    
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
    retryLocalStreamAttachment,
    unmuteRemote,
    incomingOffer,
    callState
  };
}
