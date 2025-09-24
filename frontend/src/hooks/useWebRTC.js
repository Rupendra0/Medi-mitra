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

  useEffect(() => {
    socketRef.current = getSocket();

    if (user?._id) {
      // 🔑 Register user with signaling server
      socketRef.current.emit("register", user._id);
    }

    // Create RTCPeerConnection
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
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
      if (event.candidate) {
        socketRef.current.emit("webrtc:ice-candidate", {
          candidate: event.candidate,
          to: user?.role === "doctor" ? "patient" : "doctor",
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

    // Incoming offer
    socketRef.current.on("webrtc:offer", async (offer) => {
      console.log("📥 Incoming Offer:", offer);
      setIncomingOffer(offer); // keep for patient to answer
    });

    // Incoming answer
    socketRef.current.on("webrtc:answer", async (answer) => {
      console.log("📥 Incoming Answer:", answer);
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Incoming ICE
    socketRef.current.on("webrtc:ice-candidate", async (candidate) => {
      console.log("📥 Incoming ICE Candidate:", candidate);
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.off("webrtc:offer");
        socketRef.current.off("webrtc:answer");
        socketRef.current.off("webrtc:ice-candidate");
      }
    };
  }, [user]);

  const startCall = async (patientId) => {
    if (!pcRef.current) return;
    try {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      socketRef.current.emit("webrtc:offer", {
        offer,
        to: patientId,
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
        new RTCSessionDescription(incomingOffer)
      );

      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);

      socketRef.current.emit("webrtc:answer", {
        answer,
        to: incomingOffer.from,
      });

      console.log("📤 Sent Answer:", answer);
    } catch (err) {
      console.error("Error answering call:", err);
    }
  };

  return { localVideoRef, remoteVideoRef, startCall, answerCall, incomingOffer };
}
