// frontend/src/hooks/useWebRTC.js
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../utils/socket";

export default function useWebRTC(user) {
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, incoming, answering, active, ended
  const [connectionQuality, setConnectionQuality] = useState('unknown'); // unknown, poor, good, excellent

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const answeredOfferRef = useRef(null); // Track which offer we've answered
  const processedCandidates = useRef(new Set()); // Track processed ICE candidates
  const callSessionRef = useRef(null); // Track active call sessions

  // Helper function to create peer connection with enhanced configuration
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        // Primary STUN servers (most reliable)
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        
        // Primary TURN servers (working well based on logs)
        {
          urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:80?transport=tcp"],
          username: "openrelayproject",
          credential: "openrelayproject"
        },
        {
          urls: ["turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"],
          username: "openrelayproject", 
          credential: "openrelayproject"
        },
        
        // Additional reliable TURN servers
        {
          urls: ["turn:relay1.expressturn.com:3478", "turn:relay1.expressturn.com:3478?transport=tcp"],
          username: "efGYBOFVAIH72FAMXX",
          credential: "Q21GhNwhZcMNd6r3"
        },
        
        // Backup TURN servers
        {
          urls: ["turn:numb.viagenie.ca:3478", "turn:numb.viagenie.ca:3478?transport=tcp"],
          username: "webrtc@live.com",
          credential: "muazkh"
        }
      ],
      iceCandidatePoolSize: 0, // Disable pre-gathering to reduce candidate flood
      iceTransportPolicy: 'all', // Allow both relay and direct connections
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    // Enhanced connection monitoring with quality tracking
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('🔗 Connection state changed to:', state);
      
      if (state === 'connected') {
        console.log("✅ Call connected successfully");
        setConnectionQuality('excellent');
      } else if (state === 'connecting') {
        setConnectionQuality('fair');
      } else if (state === 'disconnected') {
        setConnectionQuality('poor');
        console.log("🔄 Connection disconnected, attempting recovery...");
      } else if (state === 'failed') {
        console.log("❌ Connection failed");
        setConnectionQuality('poor');
      }
    };

    let connectionTimeout;
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log("🧊 ICE Connection state:", iceState);
      
      if (iceState === 'connected' || iceState === 'completed') {
        console.log("✅ WebRTC connected successfully!");
        setConnectionQuality(iceState === 'completed' ? 'excellent' : 'good');
        setCallState('active');
        if (connectionTimeout) clearTimeout(connectionTimeout);
      } else if (iceState === 'checking') {
        console.log("🔍 Checking connectivity (TURN servers will help if needed)...");
        setConnectionQuality('fair');
        // Set a timeout for connection attempts
        connectionTimeout = setTimeout(() => {
          if (pc.iceConnectionState === 'checking') {
            console.log("⏱️ Connection taking time - TURN servers are working to establish relay...");
          }
        }, 15000); // Increased timeout for TURN relay
      } else if (iceState === 'failed') {
        console.log("❌ Connection failed");
        if (connectionTimeout) clearTimeout(connectionTimeout);
        
        // Immediate retry with new peer connection
        console.log("🔄 Attempting automatic reconnection...");
        setTimeout(() => {
          if (userRole === 'doctor' && callState !== 'active') {
            handleDoctorStart();
          }
        }, 2000); // Quick retry
      } else if (iceState === 'disconnected') {
        console.log("⚠️ Connection disconnected - will attempt recovery");
        
        // Set timeout for automatic recovery attempt
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.log("🔄 Attempting automatic reconnection...");
            if (pc.restartIce && typeof pc.restartIce === 'function') {
              try {
                pc.restartIce();
              } catch (err) {
                console.error("❌ Auto-reconnection failed:", err);
              }
            }
          }
        }, 3000);
      }
    };

    // Simple ICE gathering monitoring
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        console.log("✅ ICE gathering complete");
      }
    };

    // Enhanced error handling with TURN server status
    pc.onicecandidateerror = (event) => {
      if (event.url && event.url.includes('turn')) {
        console.log("🔄 TURN server attempting relay:", event.url);
      } else {
        console.log("ℹ️ ICE server issue:", event.url || 'unknown');
      }
    };

    return pc;
  };

  useEffect(() => {
    socketRef.current = getSocket();
    console.log("🔌 WebRTC Hook initialized:", {
      socketConnected: socketRef.current?.connected,
      userId: user?._id,
      userRole: user?.role,
      socketId: socketRef.current?.id
    });

    if (user?._id) {
      // 🔑 Register user with signaling server
      socketRef.current.emit("register", user._id);
      console.log("📝 Registered user with socket:", user._id);
    }
      const pc = new RTCPeerConnection({
        iceServers: [
          // Use only the most reliable servers
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ],
        iceCandidatePoolSize: 0, // Disable pre-gathering to reduce candidate flood
        iceTransportPolicy: 'all' // Allow both relay and direct connections
      });

      // Simple connection monitoring
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          console.log("✅ Call connected successfully");
        } else if (state === 'failed') {
          console.log("❌ Connection failed");
        }
      };

      let connectionTimeout;
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        console.log("🧊 ICE Connection state:", iceState);
        
        if (iceState === 'connected' || iceState === 'completed') {
          console.log("✅ WebRTC connected successfully!");
          if (connectionTimeout) clearTimeout(connectionTimeout);
        } else if (iceState === 'checking') {
          // Set a timeout for connection attempts
          connectionTimeout = setTimeout(() => {
            if (pc.iceConnectionState === 'checking') {
              console.log("⏱️ Connection timeout - both peers may be behind NAT");
            }
          }, 10000);
        } else if (iceState === 'failed') {
          console.log("❌ Connection failed - both peers likely behind NAT/firewall");
          if (connectionTimeout) clearTimeout(connectionTimeout);
        }
      };

      // Simple ICE gathering monitoring
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          console.log("✅ ICE gathering complete");
        }
      };

      pc.onicecandidateerror = (event) => {
        // Simplified error handling - only log critical errors
        console.log("ℹ️ ICE server issue:", event.url || 'unknown');
      };

    // Create RTCPeerConnection
    pcRef.current = createPeerConnection();

    // When remote track arrives, attach it to remote video
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

    // Note: we defer requesting local media until the user initiates/answers a call.
    // Requesting media on mount can cause silent failures in some environments (SSR, embedded webviews).

    // Incoming offer: payload shape { offer, from }
    const handleOffer = async (payload) => {
      console.log("📥 Incoming Offer:", payload);
      
      if (!payload?.offer) {
        console.log("❌ Invalid offer - missing offer data");
        return;
      }

      const sessionId = `${payload.from}-${Date.now()}`;
      
      console.log("📥 Offer details:", {
        hasOffer: !!payload?.offer,
        from: payload?.from,
        offerType: payload?.offer?.type,
        socketConnected: socketRef.current?.connected,
        currentCallState: callState,
        pcState: pcRef.current?.signalingState,
        activeSession: callSessionRef.current,
        newSessionId: sessionId
      });
      
      // Check if we've already processed this offer or are in an active call
      if (answeredOfferRef.current === payload.from || callState === 'answering' || callState === 'active') {
        console.log("🚫 Ignoring duplicate or invalid offer - already in call state:", callState);
        return;
      }

      // Prevent processing if we have an active session with different caller
      if (callSessionRef.current && callState !== 'idle') {
        console.log("🚫 Ignoring offer - active session exists:", callSessionRef.current);
        return;
      }
      
      // Set the new session
      callSessionRef.current = sessionId;
      remoteUserIdRef.current = payload.from || null;
      setCallState('incoming');
      setIncomingOffer(payload);
    };

    // Incoming answer: payload shape { answer, from }
    const handleAnswer = async (payload) => {
      console.log("📥 Incoming Answer:", payload);
      console.log("📥 Answer details:", {
        hasAnswer: !!payload?.answer,
        from: payload?.from,
        answerType: payload?.answer?.type,
        socketConnected: socketRef.current?.connected,
        currentCallState: callState,
        pcState: pcRef.current?.signalingState
      });
      try {
        if (pcRef.current && payload?.answer) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(payload.answer)
          );
          console.log("✅ Remote answer applied successfully");
          setCallState('active'); // Call is now active
        }
      } catch (err) {
        console.error("❌ Error applying remote answer:", err);
      }
    };

    // Incoming ICE: payload shape { candidate, from }
    const handleIce = async (payload) => {
      console.log("📥 Incoming ICE Candidate:", payload);
      
      if (!payload?.candidate) {
        console.log("❌ Invalid ICE candidate - missing candidate data");
        return;
      }

      // Create a unique identifier for the candidate to prevent duplicates
      const candidateId = `${payload.from}-${payload.candidate.candidate}`;
      
      if (processedCandidates.current.has(candidateId)) {
        console.log("� Skipping duplicate ICE candidate:", candidateId.substring(0, 50) + "...");
        return;
      }
      
      processedCandidates.current.add(candidateId);
      
      console.log("�📥 ICE details:", {
        hasCandidate: !!payload?.candidate,
        from: payload?.from,
        candidateType: payload?.candidate?.candidate?.substring(0, 50) + "...",
        socketConnected: socketRef.current?.connected,
        totalProcessed: processedCandidates.current.size
      });
      
      try {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(payload.candidate)
          );
          console.log("✅ ICE candidate added successfully");
        } else {
          console.log("📦 Remote description not set yet - candidate will be queued by browser");
        }
      } catch (err) {
        console.error("❌ Error adding ICE candidate:", err);
        // Remove from processed set if it failed to add
        processedCandidates.current.delete(candidateId);
      }
    };

    socketRef.current.on("webrtc:offer", handleOffer);
    socketRef.current.on("webrtc:answer", handleAnswer);
    socketRef.current.on("webrtc:ice-candidate", handleIce);

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.off("webrtc:offer", handleOffer);
        socketRef.current.off("webrtc:answer", handleAnswer);
        socketRef.current.off("webrtc:ice-candidate", handleIce);
      }
      // Reset state on cleanup
      setCallState('idle');
      setIncomingOffer(null);
      answeredOfferRef.current = null;
      callSessionRef.current = null;
      processedCandidates.current.clear();
    };
  }, [user]);

  // Re-register user when user state changes (e.g., after auth check)
  useEffect(() => {
    if (user?._id && socketRef.current?.connected) {
      console.log("🔄 Re-registering user with socket:", user._id);
      socketRef.current.emit("register", user._id);
    }
  }, [user?._id]);

  // Helper: request media with fallbacks
  const getLocalMedia = async () => {
    const constraintsList = [
      { 
        video: { width: { ideal: 640 }, height: { ideal: 480 } }, 
        audio: { echoCancellation: true, noiseSuppression: true } 
      },
      { video: true, audio: true },
      { video: false, audio: true },
    ];

    const tryModern = async (constraints) => {
      if (typeof navigator === 'undefined') return null;
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        return navigator.mediaDevices.getUserMedia(constraints);
      }
      return null;
    };

    const tryLegacy = (constraints) => {
      const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
      if (!getUserMedia) return null;
      return new Promise((resolve, reject) => getUserMedia.call(navigator, constraints, resolve, reject));
    };

    for (const c of constraintsList) {
      try {
        const s = await tryModern(c);
        if (s) return s;
      } catch (e) {
        if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) throw e;
      }
      try {
        const s = await tryLegacy(c);
        if (s) return s;
      } catch (e) {
        if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) throw e;
      }
    }
    return null;
  };

  const startCall = async (targetUserId) => {
    if (!pcRef.current || !targetUserId) return;
    
    if (callState !== 'idle') {
      console.log("❌ Cannot start call - already in state:", callState);
      return;
    }
    
    remoteUserIdRef.current = targetUserId;
    try {
      setCallState('answering'); // Doctor is initiating, so set to answering state
      
      // Ensure we have local media and attach tracks
      if (!localStreamRef.current) {
        try {
          const stream = await getLocalMedia();
          if (stream) {
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));
          }
        } catch (err) {
          console.error('Permission denied while getting local media for startCall:', err);
          setCallState('idle');
          return; // user denied — stop starting the call
        }
      }

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      socketRef.current.emit("webrtc:offer", {
        offer,
        to: targetUserId,
      });

      console.log("📤 Sent Offer:", offer);
    } catch (err) {
      console.error("Error starting call:", err);
      setCallState('idle');
    }
  };

  const answerCall = async () => {
    if (!incomingOffer || !pcRef.current) {
      console.log("❌ Cannot answer call - missing offer or peer connection");
      return;
    }

    // Prevent multiple answer attempts
    if (callState === 'answering' || callState === 'active') {
      console.log("❌ Cannot answer call - already in state:", callState);
      return;
    }

    // Check if we've already answered this offer
    if (answeredOfferRef.current === incomingOffer.from) {
      console.log("❌ Already answered call from:", incomingOffer.from);
      return;
    }

    try {
      setCallState('answering');
      console.log("📞 Starting answer process - PC state:", pcRef.current.signalingState);
      
      // Only set remote description if we haven't already
      if (pcRef.current.signalingState === 'stable') {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(incomingOffer.offer)
        );
        console.log("✅ Remote description set, PC state now:", pcRef.current.signalingState);
      }

      // Ensure we have local media and attach tracks before creating answer
      if (!localStreamRef.current) {
        try {
          const stream = await getLocalMedia();
          if (stream) {
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));
          }
        } catch (err) {
          console.error('Permission denied while getting local media for answerCall:', err);
          setCallState('idle');
          return; // user denied — do not proceed with answering
        }
      }

      // Only create answer if in the correct state
      if (pcRef.current.signalingState === 'have-remote-offer') {
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        const toUserId = incomingOffer.from;
        remoteUserIdRef.current = toUserId || remoteUserIdRef.current;
        answeredOfferRef.current = toUserId; // Mark this offer as answered

        socketRef.current.emit("webrtc:answer", {
          answer,
          to: toUserId,
        });

        console.log("📤 Sent Answer:", answer);
        console.log("✅ Call answered successfully for session:", callSessionRef.current);
        setCallState('active');
        setIncomingOffer(null); // Clear the offer after answering
      } else {
        console.error("❌ Cannot create answer - PC state:", pcRef.current.signalingState);
        setCallState('idle');
      }
    } catch (err) {
      console.error("Error answering call:", err);
      setCallState('idle');
    }
  };

  const endCall = () => {
    console.log("📞 Ending call - cleaning up session:", callSessionRef.current);
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      // Create new peer connection for future calls using our enhanced setup
      pcRef.current = createPeerConnection();
      
      // Re-setup event handlers
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
    
    // Reset all state and tracking
    setCallState('idle');
    setIncomingOffer(null);
    answeredOfferRef.current = null;
    remoteUserIdRef.current = null;
    callSessionRef.current = null; // Reset session tracking
    processedCandidates.current.clear(); // Clear processed candidates cache
    
    // Clear video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    
    console.log("✅ Call cleanup completed");
  };

  return { localVideoRef, remoteVideoRef, startCall, answerCall, incomingOffer, callState, endCall, connectionQuality };
}
