// frontend/src/pages/CallPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import useWebRTC from "../hooks/useWebRTC";
import { useSelector } from "react-redux";
import api from "../utils/api";
import { getSocket } from "../utils/socket";

export default function CallPage() {
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const [resolvedPatientId, setResolvedPatientId] = useState(searchParams.get("patientId"));
  const user = useSelector((state) => state.auth.user);
  const { localVideoRef, remoteVideoRef, startCall, answerCall, incomingOffer } =
    useWebRTC(user);

  // Patient auto-answers when an offer arrives
  useEffect(() => {
    if (user?.role === "patient") {
      console.log("🏥 Patient on call page - attempting to answer:", {
        hasIncomingOffer: !!incomingOffer,
        incomingOffer: incomingOffer,
        userRole: user?.role,
        appointmentId
      });
      answerCall();
    }
  }, [user, answerCall, incomingOffer, appointmentId]);

  // Doctor: if patientId not provided, resolve from appointment API
  useEffect(() => {
    const needsResolve = user?.role === "doctor" && !resolvedPatientId && appointmentId;
    if (!needsResolve) return;

    (async () => {
      const res = await api.apiFetch(`/api/appointments/${appointmentId}`);
      if (res.ok && res.data?.patient?._id) {
        setResolvedPatientId(res.data.patient._id);
      } else {
        console.warn("Failed to resolve patientId from appointment", res);
      }
    })();
  }, [user, resolvedPatientId, appointmentId]);

  const handleDoctorStart = () => {
    if (user?.role === "doctor") {
      const targetUserId = resolvedPatientId || null;
      console.log("Doctor starting call", { appointmentId, targetUserId });
      if (targetUserId) {
        // Send call notification to patient
        const socket = getSocket();
        socket.emit("webrtc:start-call", {
          patientId: targetUserId,
          appointmentId: appointmentId,
          fromUserName: user?.name || 'Doctor'
        });
        
        // Start the actual WebRTC call
        startCall(targetUserId);
      } else {
        console.warn("No patientId available. Cannot start call.");
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="flex-1 flex">
        {/* Local Video */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-1/3 border-2 border-blue-400 rounded-lg m-4"
        />

        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="flex-1 border-2 border-green-400 rounded-lg m-4"
        />
      </div>

      {/* Footer Controls */}
      <div className="p-4 flex justify-center bg-gray-800">
        {user?.role === "doctor" && (
          <button
            onClick={handleDoctorStart}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            disabled={!resolvedPatientId}
            title={!resolvedPatientId ? "Resolving patient..." : "Start Call"}
          >
            Start Call
          </button>
        )}
      </div>
    </div>
  );
}
