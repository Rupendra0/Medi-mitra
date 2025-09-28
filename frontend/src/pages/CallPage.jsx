// frontend/src/pages/CallPage.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import useWebRTC from '../hooks/useWebRTC';
import '../styles/callpage.css';

// Helper to derive a peer label (placeholder for now)
function peerLabel(patientId, user){
  if (!patientId) return null;
  if (user?.role === 'doctor') return `Patient ${patientId.slice(-4)}`;
  return 'Doctor';
}

export default function CallPage() {
  const { id: appointmentId } = useParams(); // appointmentId reserved for future use
  const [searchParams] = useSearchParams();
  const [resolvedPatientId] = useState(searchParams.get("patientId"));
  const user = useSelector((state) => state.auth.user);

  // Use unified WebRTC hook (original project hook)
  const {
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    endCall,
    incomingOffer,
    callState
  } = useWebRTC(user);

  // Local UI state for media toggles
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [reason, setReason] = useState('');

  // Manual refs for draggable local preview wrapper
  const remoteWrapperRef = useRef(null);
  const dragRef = useRef(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const isValidMongoId = (id) => /^[a-f0-9]{24}$/i.test(id);

  const handleDoctorStart = () => {
    if (user?.role === 'doctor' && resolvedPatientId && isValidMongoId(resolvedPatientId)) {
      startCall(resolvedPatientId);
    }
  };

  // Lock scroll during call page view
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  // Draggable local preview (wrapper around localVideoRef video)
  useEffect(() => {
    const el = dragRef.current;
    const container = remoteWrapperRef.current;
    if (!el || !container) return;
    let startX = 0, startY = 0, originX = 0, originY = 0;
    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
    const onPointerDown = (e) => {
      setDragging(true);
      startX = e.clientX; startY = e.clientY; originX = dragPos.x; originY = dragPos.y;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };
    const onPointerMove = (e) => {
      const dx = e.clientX - startX; const dy = e.clientY - startY;
      const rect = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      const controlBarReserved = 120; // px reserved at bottom for control bar hit area
      const padding = 8; // inner padding from each edge
      const maxX = contRect.width - rect.width - padding;
      const maxY = contRect.height - rect.height - controlBarReserved;
      const newX = clamp(originX + dx, -maxX*0.02, maxX); // allow tiny negative for shadow
      const newY = clamp(originY + dy, padding, maxY);
      setDragPos({ x: newX, y: newY });
    };
    const onPointerUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
    };
    el.addEventListener('pointerdown', onPointerDown);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    // Intentionally not depending on dragPos to avoid re-binding listeners frequently
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPatientId]);

  // Derived user-friendly label for call state
  const humanState = useCallback((s) => ({
    idle: 'Idle',
    incoming: 'Incoming',
    calling: 'Calling…',
    active: 'Live'
  }[s] || s), []);

  // Timer for active call
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let id;
    if (callState === 'active') {
      const start = Date.now();
      id = setInterval(() => setElapsed(Math.floor((Date.now() - start)/1000)), 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(id);
  }, [callState]);

  const mmss = (t) => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;

  // Toggle audio/video by disabling tracks on local stream element when available
  const toggleAudio = () => {
    setAudioEnabled(a => {
      const next = !a;
      const stream = localVideoRef.current?.srcObject;
      stream?.getAudioTracks().forEach(t => t.enabled = next);
      return next;
    });
  };
  const toggleVideo = () => {
    setVideoEnabled(v => {
      const next = !v;
      const stream = localVideoRef.current?.srcObject;
      stream?.getVideoTracks().forEach(t => t.enabled = next);
      return next;
    });
  };

  // Accept incoming offer (patient role)
  const handleAcceptIncoming = () => {
    if (incomingOffer && user?.role === 'patient') {
      answerCall();
    }
  };

  const computedCallState = () => {
    if (incomingOffer && callState === 'incoming') return 'ringing';
    return callState;
  };

  return (
    <div className="call-container">
      <div className="call-stage">
        <div className="remote-wrapper" ref={remoteWrapperRef}>
          {callState === 'active' ? (
            <video ref={remoteVideoRef} className="remote-video-element" autoPlay playsInline />
          ) : (
            <div className="remote-placeholder">
              {computedCallState() === 'calling' && 'Calling…'}
              {computedCallState() === 'ringing' && 'Incoming Call'}
              {computedCallState() === 'idle' && user?.role === 'doctor' && 'Start a Call'}
              {computedCallState() === 'idle' && user?.role === 'patient' && 'Waiting'}
            </div>
          )}

          {/* Local preview (draggable) */}
          <div
            ref={dragRef}
            className={`local-preview ${dragging ? 'dragging' : ''}`}
            style={{ transform: `translate(${dragPos.x}px, ${dragPos.y}px)` }}
          >
            <video ref={localVideoRef} className="local-video-tag" muted playsInline autoPlay />
            {!audioEnabled && (
              <div style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,.55)',padding:'4px 8px',borderRadius:8,fontSize:12,color:'#fff'}}>Mic Off</div>
            )}
            {!videoEnabled && (
              <div style={{position:'absolute',bottom:6,left:6,background:'rgba(0,0,0,.55)',padding:'4px 8px',borderRadius:8,fontSize:12,color:'#fff'}}>Video Off</div>
            )}
          </div>

          {/* Status badge */}
            <div className={`indicator-badge ${callState === 'active' ? 'active' : ''}`}>
              <span>{humanState(callState)}</span>
              {callState === 'active' && <span className="call-timer">{mmss(elapsed)}</span>}
            </div>

          {/* Participant meta */}
          <div className="top-right-meta">
            <div className="participant-chip">You: {user?.name || 'User'}</div>
            {peerLabel(resolvedPatientId, user) && (
              <div className="participant-chip">Peer: {peerLabel(resolvedPatientId, user)}</div>
            )}
          </div>

          {/* Reason toast */}
          {['busy','error'].includes(callState) && reason && (
            <div className="status-toast">{reason}</div>
          )}
        </div>
      </div>

      {/* Control bar */}
      <div className="call-control-bar">
        {user?.role === 'doctor' && callState === 'idle' && (
          isValidMongoId(resolvedPatientId) ? (
            <button className="control-btn-neo" onClick={handleDoctorStart} title="Start Call">📞</button>
          ) : (
            <div style={{color:'#ffbf47', fontSize:12, maxWidth:160, textAlign:'center'}}>Invalid or missing patientId param</div>
          )
        )}
        {incomingOffer && callState === 'incoming' && user?.role === 'patient' && (
          <>
            <button className="control-btn-neo" onClick={handleAcceptIncoming} title="Accept">✅</button>
            <button className="control-btn-neo control-btn-danger" onClick={endCall} title="Reject">✖</button>
          </>
        )}
        {callState === 'calling' && (
          <button className="control-btn-neo control-btn-danger" onClick={endCall} title="Cancel">✖</button>
        )}
        {callState === 'active' && (
          <>
            <button className="control-btn-neo" onClick={toggleAudio} title={audioEnabled ? 'Mute' : 'Unmute'}>{audioEnabled ? '🎤' : '🔇'}</button>
            <button className="control-btn-neo" onClick={toggleVideo} title={videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}>{videoEnabled ? '📷' : '🚫'}</button>
            <button className="control-btn-neo control-btn-danger" onClick={endCall} title="End Call">⏹</button>
          </>
        )}
      </div>
    </div>
  );
}
