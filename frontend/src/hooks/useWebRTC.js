// frontend/src/hooks/useWebRTC.js
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../utils/socket";

export default function useWebRTC(user) {
  const [incomingOffer, setIncomingOffer] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);

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

    // Get local media
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach((track) =>
          pcRef.current.addTrack(track, stream)
        );
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    })();

    // Incoming offer: payload shape { offer, from }
    const handleOffer = async (payload) => {
      console.log("📥 Incoming Offer:", payload);
      console.log("📥 Offer details:", {
        hasOffer: !!payload?.offer,
        from: payload?.from,
        offerType: payload?.offer?.type,
        socketConnected: socketRef.current?.connected
      });
      if (!payload?.offer) return;
      remoteUserIdRef.current = payload.from || null;
      setIncomingOffer(payload);
    };

    // Incoming answer: payload shape { answer, from }
    const handleAnswer = async (payload) => {
      console.log("📥 Incoming Answer:", payload);
      console.log("📥 Answer details:", {
        hasAnswer: !!payload?.answer,
        from: payload?.from,
        answerType: payload?.answer?.type,
        socketConnected: socketRef.current?.connected
      });
      try {
        if (pcRef.current && payload?.answer) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(payload.answer)
          );
          console.log("✅ Remote answer applied successfully");
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
    };
  }, [user]);

  const startCall = async (targetUserId) => {
    if (!pcRef.current || !targetUserId) return;
    remoteUserIdRef.current = targetUserId;
    try {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      socketRef.current.emit("webrtc:offer", {
        offer,
        to: targetUserId,
      });

      console.log("📤 Sent Offer:", offer);
    } catch (err) {
      console.error("Error starting call:", err);
    }
  };

  const answerCall = async () => {
    if (!incomingOffer || !pcRef.current) return;

    try {
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(incomingOffer.offer)
      );

      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);

      const toUserId = incomingOffer.from;
      remoteUserIdRef.current = toUserId || remoteUserIdRef.current;

      socketRef.current.emit("webrtc:answer", {
        answer,
        to: toUserId,
      });

      console.log("📤 Sent Answer:", answer);
    } catch (err) {
      console.error("Error answering call:", err);
    }
  };

  return { localVideoRef, remoteVideoRef, startCall, answerCall, incomingOffer };
}
