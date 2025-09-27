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
  const { localVideoRef, remoteVideoRef, startCall, answerCall, incomingOffer, callState, endCall, connectionQuality } =
    useWebRTC(user);

  // Debug logging
  console.log("🔍 CallPage Debug:", {
    userRole: user?.role,
    callState,
    resolvedPatientId,
    appointmentId,
    userObject: user
  });

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
    <div className="call-page-container fixed inset-0 w-full h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 overflow-hidden flex flex-col" style={{
      height: '100vh', 
      maxHeight: '100vh',
      zIndex: 9999,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }}>
      {/* Header Bar - Fixed height */}
      <div className="flex-none w-full bg-black/20 backdrop-blur-sm border-b border-white/10 z-30">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
          {/* Left: Call Info */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-white font-medium text-sm sm:text-base hidden sm:inline">
                {user?.role === 'doctor' ? 'Patient Consultation' : 'Doctor Consultation'}
              </span>
              <span className="text-white font-medium text-xs sm:hidden">
                {user?.role === 'doctor' ? 'Patient' : 'Doctor'}
              </span>
            </div>
            <div className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
              callState === 'idle' ? 'bg-gray-600/80 text-gray-200' :
              callState === 'incoming' ? 'bg-amber-500/80 text-amber-100' :
              callState === 'answering' ? 'bg-blue-500/80 text-blue-100' :
              callState === 'active' ? 'bg-green-500/80 text-green-100' : 'bg-red-500/80 text-red-100'
            }`}>
              {callState === 'idle' && 'Waiting...'}
              {callState === 'incoming' && 'Incoming'}
              {callState === 'answering' && 'Connecting...'}
              {callState === 'active' && 'Connected'}
              {callState === 'ended' && 'Ended'}
            </div>
          </div>

          {/* Right: App ID */}
          <div className="text-white/70 text-xs sm:text-sm">
            #{appointmentId?.slice(-6)}
          </div>
        </div>
      </div>

      {/* Main Video Container - Account for fixed bottom bar */}
      <div className="flex-1 relative w-full overflow-hidden" style={{paddingBottom: '100px'}}>
        {/* Remote Video (Main/Large) */}
        <div className="relative w-full h-full">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-gray-800"
            style={{
              transform: 'scaleX(-1)' // Mirror effect like Zoom
            }}
          />
          
          {/* Remote Video Overlay Info */}
          {callState === 'active' && (
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-2 sm:px-3 py-1 sm:py-2">
              <div className="text-white text-xs sm:text-sm font-medium">
                {user?.role === 'doctor' ? 'Patient' : 'Dr. ' + (user?.name || 'Doctor')}
              </div>
            </div>
          )}

          {/* Connection Status Overlay */}
          {callState !== 'active' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
              <div className="text-center px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-600 flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-white text-base sm:text-lg font-medium mb-2">
                  {callState === 'idle' && 'Waiting for connection...'}
                  {callState === 'incoming' && 'Incoming call'}
                  {callState === 'answering' && 'Connecting to call...'}
                  {callState === 'ended' && 'Call has ended'}
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm max-w-sm mx-auto">
                  {callState === 'idle' && 'Please wait while we establish the connection'}
                  {callState === 'incoming' && 'Auto-answering incoming call...'}
                  {callState === 'answering' && 'Setting up video and audio...'}
                  {callState === 'ended' && 'Thank you for using Medi-Mitra'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video (Picture-in-Picture) - Responsive */}
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 w-32 h-24 sm:w-48 sm:h-36 md:w-64 md:h-48 z-20">
          <div className="relative w-full h-full rounded-lg sm:rounded-xl overflow-hidden shadow-2xl border border-white/20 sm:border-2">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover bg-gray-800"
              style={{
                transform: 'scaleX(-1)' // Mirror effect
              }}
            />
            
            {/* Local Video Overlay */}
            <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 bg-black/60 backdrop-blur-sm rounded px-1 sm:px-2 py-0.5 sm:py-1">
              <span className="text-white text-xs font-medium">You</span>
            </div>

            {/* Muted Indicator */}
            <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-black/60 backdrop-blur-sm rounded-full p-1">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.82L4.29 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.29l4.093-3.82a1 1 0 011.617.82zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar - Fixed height, responsive, always visible */}
      <div className="flex-none w-full bg-black/40 backdrop-blur-xl border-t border-white/10 z-40 min-h-[80px] flex items-center" style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000
      }}>
        <div className="flex items-center justify-center px-3 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 w-full">
          <div className="flex items-center justify-center space-x-3 sm:space-x-4 md:space-x-6 max-w-full overflow-x-auto">
            
            {/* Debug Info */}
            <div className="bg-red-600 text-white p-2 rounded text-xs">
              Role: {user?.role || 'none'} | State: {callState} | PatientId: {resolvedPatientId ? 'yes' : 'no'}
            </div>

            {/* Doctor Start Call Button - ALWAYS VISIBLE FOR DOCTORS */}
            {user?.role === "doctor" && (
              <button
                onClick={handleDoctorStart}
                disabled={!resolvedPatientId}
                className="flex items-center space-x-2 px-4 sm:px-6 py-3 sm:py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full transition-all duration-200 shadow-2xl text-sm sm:text-base whitespace-nowrap border-2 border-green-400"
                title={!resolvedPatientId ? "Loading patient info..." : "Start video call"}
                style={{minHeight: '48px', minWidth: '120px'}}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <span className="text-white font-medium hidden sm:inline">
                  {!resolvedPatientId ? 'Loading...' : 'Start Call'}
                </span>
                <span className="text-white font-medium sm:hidden">
                  {!resolvedPatientId ? 'Loading...' : 'Start'}
                </span>
              </button>
            )}

            {/* Patient Info */}
            {user?.role === "patient" && (
              <div className="bg-blue-600 text-white px-4 py-2 rounded">
                Patient - Waiting for doctor to start call
              </div>
            )}

            {/* Patient Auto-Answer Indicator */}
            {user?.role === "patient" && callState === "incoming" && (
              <div className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-full">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                <span className="text-amber-200 text-xs sm:text-sm font-medium">Connecting...</span>
              </div>
            )}

            {/* Test Button - Always visible for debugging */}
            <button className="flex items-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-full shadow-2xl border-2 border-blue-400" style={{minHeight: '48px'}}>
              <span className="text-white font-medium">Test Button</span>
            </button>

            {/* Active Call Controls */}
            {callState === 'active' && (
              <>
                {/* Mute Button */}
                <button className="p-3 sm:p-4 bg-gray-700/50 hover:bg-gray-600/50 rounded-full transition-all duration-200 border border-gray-600 shadow-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Video Button */}
                <button className="p-3 sm:p-4 bg-gray-700/50 hover:bg-gray-600/50 rounded-full transition-all duration-200 border border-gray-600 shadow-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                </button>

                {/* End Call Button */}
                <button
                  onClick={endCall}
                  className="flex items-center space-x-1 sm:space-x-2 px-4 sm:px-6 py-3 sm:py-4 bg-red-600 hover:bg-red-700 rounded-full transition-all duration-200 shadow-2xl border-2 border-red-400"
                  style={{minHeight: '48px'}}
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                  <span className="text-white font-medium text-sm sm:text-base">End Call</span>
                </button>

                {/* Settings Button - Hidden on mobile to save space */}
                <button className="hidden sm:flex p-3 sm:p-4 bg-gray-700/50 hover:bg-gray-600/50 rounded-full transition-all duration-200 border border-gray-600 shadow-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Connection Quality Indicator - Responsive positioning */}
      {callState === 'active' && (
        <div className="absolute top-16 sm:top-20 left-2 sm:left-4 z-20 flex items-center space-x-1 sm:space-x-2 bg-black/50 backdrop-blur-sm rounded-lg px-2 sm:px-3 py-1 sm:py-2">
          <div className="flex space-x-0.5 sm:space-x-1">
            {[1, 2, 3, 4].map((bar) => (
              <div 
                key={bar}
                className={`w-0.5 sm:w-1 h-2 sm:h-3 rounded-full ${
                  connectionQuality === 'excellent' ? 'bg-green-500' :
                  connectionQuality === 'good' && bar <= 3 ? 'bg-green-500' :
                  connectionQuality === 'fair' && bar <= 2 ? 'bg-yellow-500' :
                  connectionQuality === 'poor' && bar <= 1 ? 'bg-red-500' :
                  'bg-gray-400'
                }`}
              ></div>
            ))}
          </div>
          <span className="text-white text-xs font-medium hidden sm:inline">
            {connectionQuality === 'excellent' ? 'Excellent' :
             connectionQuality === 'good' ? 'Good' :
             connectionQuality === 'fair' ? 'Fair' :
             connectionQuality === 'poor' ? 'Poor' :
             'Connecting...'}
          </span>
        </div>
      )}
    </div>
  );
}
