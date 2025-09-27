// frontend/src/hooks/useWebRTC.js
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../utils/socket";

export default function useWebRTC(user) {
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, incoming, answering, active, ended

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const answeredOfferRef = useRef(null); // Track which offer we've answered

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

    // Create RTCPeerConnection
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        // STUN
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // TURN fallback (public/demo). Replace with your managed TURN for production.
        // Example: OpenRelayProject (usage limits apply)
        // Username and credential are public demo creds; for hackathon reliability only.
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turns:openrelay.metered.ca:443?transport=tcp"
          ],
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ],
    });

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
      console.log("📥 Offer details:", {
        hasOffer: !!payload?.offer,
        from: payload?.from,
        offerType: payload?.offer?.type,
        socketConnected: socketRef.current?.connected,
        currentCallState: callState,
        pcState: pcRef.current?.signalingState
      });
      
      if (!payload?.offer) return;
      
      // Check if we've already processed this offer or are in an active call
      if (answeredOfferRef.current === payload.from || callState === 'answering' || callState === 'active') {
        console.log("🚫 Ignoring duplicate or invalid offer - already in call state:", callState);
        return;
      }
      
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
      console.log("📥 ICE details:", {
        hasCandidate: !!payload?.candidate,
        from: payload?.from,
        candidateType: payload?.candidate?.candidate,
        socketConnected: socketRef.current?.connected
      });
      try {
        if (pcRef.current && payload?.candidate) {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(payload.candidate)
          );
          console.log("✅ ICE candidate added successfully");
        }
      } catch (err) {
        console.error("❌ Error adding ICE candidate:", err);
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
    console.log("📞 Ending call");
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      // Create new peer connection for future calls
      pcRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          {
            urls: [
              "turn:openrelay.metered.ca:80",
              "turn:openrelay.metered.ca:443",
              "turns:openrelay.metered.ca:443?transport=tcp"
            ],
            username: "openrelayproject",
            credential: "openrelayproject"
          }
        ],
      });
      
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
    
    // Reset state
    setCallState('idle');
    setIncomingOffer(null);
    answeredOfferRef.current = null;
    remoteUserIdRef.current = null;
    
    // Clear video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  return { localVideoRef, remoteVideoRef, startCall, answerCall, incomingOffer, callState, endCall };
}
