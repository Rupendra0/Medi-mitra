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
  const { localVideoRef, remoteVideoRef, startCall, answerCall, incomingOffer, callState, endCall } =
    useWebRTC(user);

  // Patient auto-answers when an offer arrives (only once per offer)
  useEffect(() => {
    if (user?.role === "patient" && incomingOffer && callState === "incoming") {
      console.log("🏥 Patient on call page - attempting to answer:", {
        hasIncomingOffer: !!incomingOffer,
        incomingOffer: incomingOffer,
        userRole: user?.role,
        appointmentId,
        callState
      });
      answerCall();
    }
  }, [user, answerCall, incomingOffer, appointmentId, callState]);

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
        
          // Start the actual WebRTC call after a short delay so the patient has time
          // to receive the notification, navigate to the call page and register their socket room.
          setTimeout(() => {
            startCall(targetUserId);
          }, 700);
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
      <div className="p-4 flex justify-center items-center space-x-4 bg-gray-800">
        {/* Call State Indicator */}
        <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
          callState === 'idle' ? 'bg-gray-600' :
          callState === 'incoming' ? 'bg-yellow-600' :
          callState === 'answering' ? 'bg-blue-600' :
          callState === 'active' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {callState === 'idle' && 'Waiting...'}
          {callState === 'incoming' && 'Incoming Call'}
          {callState === 'answering' && 'Connecting...'}
          {callState === 'active' && 'Connected'}
          {callState === 'ended' && 'Call Ended'}
        </div>

        {user?.role === "doctor" && (
          <button
            onClick={handleDoctorStart}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            disabled={!resolvedPatientId || callState === 'active'}
            title={!resolvedPatientId ? "Resolving patient..." : callState === 'active' ? "Call in progress" : "Start Call"}
          >
            {callState === 'active' ? 'Call Active' : 'Start Call'}
          </button>
        )}

        {user?.role === "patient" && callState === "incoming" && (
          <div className="text-yellow-400 text-sm">
            Auto-answering incoming call...
          </div>
        )}

        {callState === 'active' && (
          <button
            onClick={endCall}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
            title="End Call"
          >
            End Call
          </button>
        )}
      </div>
    </div>
  );
}
