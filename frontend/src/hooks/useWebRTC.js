// frontend/src/hooks/useWebRTC.js
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../utils/socket";

export default function useWebRTC(user) {
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, incoming, active, ended
  const [connectionQuality, setConnectionQuality] = useState('unknown'); // unknown, poor, good, excellent

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const answeredOfferRef = useRef(null); // Track which offer we've answered
  const hasRemoteAnswerRef = useRef(false); // Track if caller already applied remote answer
  const processedCandidates = useRef(new Set()); // Track processed ICE candidates
  const callSessionRef = useRef(null); // Track active call sessions
  const retryCountRef = useRef(0); // Track connection retry attempts
  const isRetryingRef = useRef(false); // Prevent multiple simultaneous retries
  const iceStageRef = useRef(0); // ICE staging: 0=minimal,1=expanded,2=full,3=turn-only
  const statsIntervalRef = useRef(null);
  const iceEscalationTimeoutRef = useRef(null);

  const ICE_STAGES = [
    [ // Stage 0 minimal
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: ["turn:relay1.expressturn.com:3478?transport=udp","turn:relay1.expressturn.com:3478?transport=tcp"], username: "efCZWX3MTI071W2V6N", credential: "mGWa8dVKpR4FgpE" }
    ],
    [ // Stage 1 add metered
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: ["turn:relay1.expressturn.com:3478?transport=udp","turn:relay1.expressturn.com:3478?transport=tcp"], username: "efCZWX3MTI071W2V6N", credential: "mGWa8dVKpR4FgpE" },
      { urls: ["turn:a.relay.metered.ca:80","turn:a.relay.metered.ca:443"], username: "a71c31d416502d8c9b8dec95", credential: "2lrtyK5RqnEIg5hx" }
    ],
    [ // Stage 2 full
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: ["turn:relay1.expressturn.com:3478?transport=udp","turn:relay1.expressturn.com:3478?transport=tcp"], username: "efCZWX3MTI071W2V6N", credential: "mGWa8dVKpR4FgpE" },
      { urls: ["turn:a.relay.metered.ca:80","turn:a.relay.metered.ca:443"], username: "a71c31d416502d8c9b8dec95", credential: "2lrtyK5RqnEIg5hx" },
      { urls: ["turn:openrelay.metered.ca:80","turn:openrelay.metered.ca:443"], username: "openrelayproject", credential: "openrelayproject" }
    ],
    [ // Stage 3 TURN-only forced relay
      { urls: ["turn:relay1.expressturn.com:3478?transport=udp","turn:relay1.expressturn.com:3478?transport=tcp"], username: "efCZWX3MTI071W2V6N", credential: "mGWa8dVKpR4FgpE" },
      { urls: ["turn:a.relay.metered.ca:80","turn:a.relay.metered.ca:443"], username: "a71c31d416502d8c9b8dec95", credential: "2lrtyK5RqnEIg5hx" },
      { urls: ["turn:openrelay.metered.ca:80","turn:openrelay.metered.ca:443"], username: "openrelayproject", credential: "openrelayproject" }
    ]
  ];

  // Helper function to reset peer connection completely
  const resetPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    
    // Create a fresh peer connection with progressive simplification
    if (retryCountRef.current >= 3) {
      pcRef.current = createUltraSimplePeerConnection();
    } else if (retryCountRef.current >= 2) {
      pcRef.current = createSimplePeerConnection();
    } else {
      pcRef.current = createPeerConnection();
    }
    
    // Setup handlers
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
    
    const connectionType = retryCountRef.current >= 3 ? "(ultra-simple)" : 
                          retryCountRef.current >= 2 ? "(simplified)" : "(enhanced)";
    console.log("🔄 Peer connection reset for retry", connectionType);
  };

  // Helper function to create ultra-simple peer connection for restrictive networks
  const createUltraSimplePeerConnection = () => {
    console.log("🔄 Creating ultra-simple peer connection (direct only)");
    return new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-compat',
      rtcpMuxPolicy: 'negotiate'
    });
  };

  // Helper function to create peer connection with enhanced configuration
  const createSimplePeerConnection = () => {
    console.log("🔄 Creating simplified peer connection (STUN only)");
    return new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all'
    });
  };

  // Helper function to create peer connection with enhanced configuration
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        // Primary STUN servers (most reliable, unlimited free)
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        
        // High-quality TURN servers (more reliable free options)
        {
          urls: ["turn:relay1.expressturn.com:3478"],
          username: "efCZWX3MTI071W2V6N",
          credential: "mGWa8dVKpR4FgpE"
        },
        {
          urls: ["turn:a.relay.metered.ca:80", "turn:a.relay.metered.ca:80?transport=tcp"],
          username: "a71c31d416502d8c9b8dec95",
          credential: "2lrtyK5RqnEIg5hx"
        },
        {
          urls: ["turn:a.relay.metered.ca:443", "turn:a.relay.metered.ca:443?transport=tcp"],
          username: "a71c31d416502d8c9b8dec95",
          credential: "2lrtyK5RqnEIg5hx"
        },
        
        // Fallback TURN servers (original working ones as backup)
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
        
        // Additional free TURN servers for redundancy
        {
          urls: ["turn:turn.bistri.com:80"],
          username: "homeo",
          credential: "homeo"
        },
        {
          urls: ["turn:turn.anyfirewall.com:443?transport=tcp"],
          username: "webrtc",
          credential: "webrtc"
        }
      ],
      iceCandidatePoolSize: 10, // Pre-gather more candidates for better connectivity
      iceTransportPolicy: 'all', // Allow both relay and direct connections
      bundlePolicy: 'balanced', // More compatible than max-bundle
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
        console.log("🔗 Connection state: connecting - peer connection establishing...");
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
        retryCountRef.current = 0; // Reset retry counter on success
        isRetryingRef.current = false; // Reset retry flag on success
        if (connectionTimeout) clearTimeout(connectionTimeout);
      } else if (iceState === 'checking') {
        console.log("🔍 Checking connectivity (TURN servers will help if needed)...");
        setConnectionQuality('fair');
        // Set reasonable timeout for ICE checking phase
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionTimeout = setTimeout(() => {
          if (pc.iceConnectionState === 'checking') {
            console.log("⏰ ICE checking timeout - forcing reconnection with different servers");
            retryCountRef.current += 1;
            if (retryCountRef.current <= 5) {
              resetPeerConnection();
              if (user?.role === 'doctor') {
                setTimeout(() => startCall(remoteUserIdRef.current), 1000);
              }
            }
          }
        }, 15000); // 15 second timeout for checking phase
      } else if (iceState === 'failed') {
        console.log("❌ Connection failed");
        if (connectionTimeout) clearTimeout(connectionTimeout);
        
        retryCountRef.current += 1;
        console.log(`🔄 Attempting reconnection (attempt ${retryCountRef.current}/5)...`);
        
        if (retryCountRef.current <= 5 && !isRetryingRef.current) {
          setTimeout(() => {
            if (user?.role === 'doctor' && callState !== 'active' && !isRetryingRef.current) {
              isRetryingRef.current = true;
              setCallState('idle');
              resetPeerConnection();
              setTimeout(() => {
                startCall(remoteUserIdRef.current);
                isRetryingRef.current = false;
              }, 500);
            }
          }, 2000); // Fixed 2-second delay for failed connections
        } else {
          console.log("❌ Max retries reached (5 attempts) - connection may not be possible");
          setConnectionQuality('poor');
        }
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

  const clearDiagnostics = () => {
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
    if (iceEscalationTimeoutRef.current) { clearTimeout(iceEscalationTimeoutRef.current); iceEscalationTimeoutRef.current = null; }
  };

  const startIceDiagnostics = (pc) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let selected = null; let pairs = 0;
        stats.forEach(r => { if (r.type === 'candidate-pair') { pairs++; if (r.state === 'succeeded' && r.nominated) selected = r; } });
        if (selected) {
          console.log(`✅ Selected pair stage ${iceStageRef.current} RTT:${(selected.currentRoundTripTime||0).toFixed(3)} local:${selected.localCandidateId} remote:${selected.remoteCandidateId}`);
        } else {
          console.log(`⏳ ICE checking stage ${iceStageRef.current} pairs:${pairs}`);
        }
      } catch {}
    }, 3000);
  };

  const scheduleIceEscalation = (pc, stage) => {
    if (iceEscalationTimeoutRef.current) clearTimeout(iceEscalationTimeoutRef.current);
    iceEscalationTimeoutRef.current = setTimeout(() => {
      if (!pc) return;
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') return;
      // Do not escalate once remote answer applied and we are in post-answer stabilization window
      if (hasRemoteAnswerRef.current) {
        console.log('⏳ Skipping escalation – remote answer already applied; waiting for connectivity');
        return;
      }
      if (stage < ICE_STAGES.length - 1) {
        iceStageRef.current = stage + 1;
        console.log(`⚠️ Escalating ICE to stage ${iceStageRef.current}`);
        rebuildPeerConnectionPreserveTracks();
      } else {
        console.log('❌ All ICE stages exhausted without connection.');
        clearDiagnostics();
      }
    }, stage === 0 ? 12000 : stage === 1 ? 12000 : 15000);
  };

  const attachCoreHandlers = (pc) => {
    pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    pc.onicecandidate = (ev) => { if (ev.candidate && remoteUserIdRef.current) socketRef.current.emit('webrtc:ice-candidate', { candidate: ev.candidate, to: remoteUserIdRef.current }); };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log('🧊 ICE state (stage', iceStageRef.current, '):', s);
      if (s === 'connected' || s === 'completed') { clearDiagnostics(); setConnectionQuality(s==='completed'?'excellent':'good'); setCallState('active'); }
    };
  };

  const buildPeerConnectionForStage = (stage) => {
    const servers = ICE_STAGES[stage] || ICE_STAGES[ICE_STAGES.length-1];
    console.log('🧊 Building PC for stage', stage, servers.map(s=>s.urls));
    const pc = new RTCPeerConnection({
      iceServers: servers,
      iceCandidatePoolSize: stage === 0 ? 0 : 5,
      bundlePolicy: 'balanced',
      iceTransportPolicy: 'all',
      rtcpMuxPolicy: 'require'
    });
    attachCoreHandlers(pc);
    startIceDiagnostics(pc);
    scheduleIceEscalation(pc, stage);
    return pc;
  };

  const rebuildPeerConnectionPreserveTracks = () => {
    const old = pcRef.current;
    const localTracks = localStreamRef.current ? [...localStreamRef.current.getTracks()] : [];
    if (old) { try { old.close(); } catch {} }
    pcRef.current = buildPeerConnectionForStage(iceStageRef.current);
    localTracks.forEach(t => pcRef.current.addTrack(t, localStreamRef.current));
    // If we are the caller and already attempted, re-create and send a new offer
    if (!hasRemoteAnswerRef.current) { // Only resend offer prior to having remote answer
      if (callState === 'answering' || callState === 'idle') {
        if (user?.role === 'doctor' && remoteUserIdRef.current) {
          console.log('🔁 Re-sending offer after escalation stage', iceStageRef.current);
          startCall(remoteUserIdRef.current);
        }
      }
    } else {
      console.log('🔁 Skipping re-offer on rebuild; remote answer already applied.');
    }
  };

  useEffect(() => {
    socketRef.current = getSocket();
    console.log("🔌 WebRTC Hook initialized:", {
      socketConnected: socketRef.current?.connected,
      userId: user?._id,
      userRole: user?.role,
      socketId: socketRef.current?.id
    });

    // Add socket health monitoring
    socketRef.current.on('connect', () => {
      console.log("✅ Socket reconnected successfully");
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log("❌ Socket disconnected:", reason);
      if (reason === 'io server disconnect') {
        // Server-side disconnect, manual reconnection needed
        console.log("🔄 Attempting manual socket reconnection...");
        socketRef.current.connect();
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.log("❌ Socket connection error:", error.message);
    });

    if (user?._id) {
      // 🔑 Register user with signaling server
      socketRef.current.emit("register", user._id);
      console.log("📝 Registered user with socket:", user._id);
    }

    // Create RTCPeerConnection
    /* Replaced original createPeerConnection with staged builder */
    iceStageRef.current = 0;
    pcRef.current = buildPeerConnectionForStage(iceStageRef.current);

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
          hasRemoteAnswerRef.current = true; // Mark that we have the remote answer
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

      let offer = await pcRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      try {
        await pcRef.current.setLocalDescription(offer);
      } catch (bundleError) {
        if (bundleError.message.includes('BUNDLE')) {
          console.log("🔄 Bundle error detected, creating simplified connection...");
          // Reset with simplified connection and retry
          pcRef.current = createSimplePeerConnection();
          
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
          
          // Re-add tracks
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => pcRef.current.addTrack(track, localStreamRef.current));
          }
          
          // Create and set offer again with simple connection
          const simpleOffer = await pcRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await pcRef.current.setLocalDescription(simpleOffer);
          offer = simpleOffer; // Use the simple offer
        } else {
          throw bundleError; // Re-throw if not a bundle error
        }
      }

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
      
      // Set remote description only if still stable (no offer applied yet)
      if (pcRef.current.signalingState === 'stable') {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingOffer.offer));
          console.log("✅ Remote description set, PC state now:", pcRef.current.signalingState);
        } catch (e) {
          console.error('❌ Failed setting remote description while answering:', e);
          setCallState('idle');
          return;
        }
      } else if (pcRef.current.signalingState === 'have-remote-offer') {
        // Already fine
      } else if (pcRef.current.signalingState === 'have-local-offer') {
        // We somehow created an offer (perhaps due to escalation) — rollback then apply
        try {
          await pcRef.current.setLocalDescription({ type: 'rollback' });
          console.log('↩️ Rolled back local offer to apply remote offer');
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingOffer.offer));
        } catch (e) {
          console.error('❌ Rollback/apply failed:', e);
          setCallState('idle');
          return;
        }
      } else {
        console.warn('⚠️ Unexpected signaling state during answer:', pcRef.current.signalingState);
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

      // Only create answer if in the correct state (have-remote-offer)
      if (pcRef.current.signalingState === 'have-remote-offer') {
        const answer = await pcRef.current.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
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
        console.error("❌ Cannot create answer - invalid PC state:", pcRef.current.signalingState);
        // If we somehow lost the remote offer but have local offer, attempt restart negotiation path (optional)
        if (pcRef.current.signalingState === 'stable') {
          console.log('🔄 Stable without remote offer; ignoring answer attempt.');
        }
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
