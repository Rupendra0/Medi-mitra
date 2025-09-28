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
      console.log('Initializing call with patient:', resolvedPatientId);
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
        <div className="remote-wrapper" ref={remoteWrapperRef} style={{position:'absolute', inset:0}}>
          {callState === 'active' ? (
            <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          ) : (
            <div className="remote-placeholder" style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#bbb',fontSize:'1.2rem'}}>
              {computedCallState() === 'calling' && 'Calling…'}
              {computedCallState() === 'ringing' && 'Incoming Call'}
              {computedCallState() === 'idle' && user?.role === 'doctor' && 'Start a Call'}
              {computedCallState() === 'idle' && user?.role === 'patient' && 'Waiting'}
            </div>
          )}

          <div
            ref={dragRef}
            className={`local-preview ${dragging ? 'dragging' : ''}`}
            style={{ position:'absolute', top:20, right:20, width:220, background:'#000', borderRadius:12, overflow:'hidden', transform: `translate(${dragPos.x}px, ${dragPos.y}px)`, boxShadow:'0 4px 18px rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.12)'}}
          >
            <video ref={localVideoRef} style={{width:'100%',height:'150px',objectFit:'cover',background:'#111'}} muted playsInline autoPlay />
            <div style={{position:'absolute',bottom:6,left:8,fontSize:12,color:'#fff',textShadow:'0 1px 2px rgba(0,0,0,.6)'}}>You: {user?.name || 'User'}</div>
            {!audioEnabled && (
              <div style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,.55)',padding:'4px 8px',borderRadius:8,fontSize:12,color:'#fff'}}>Mic Off</div>
            )}
            {!videoEnabled && (
              <div style={{position:'absolute',bottom:30,left:8,background:'rgba(0,0,0,.55)',padding:'4px 8px',borderRadius:8,fontSize:12,color:'#fff'}}>Video Off</div>
            )}
          </div>

          <div style={{position:'absolute',top:16,left:20,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{color:'#fff',fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}>
              <span className={`indicator-badge ${callState === 'active' ? 'active' : ''}`} style={{background: callState==='active'? '#16a34a':'#444',padding:'4px 10px',borderRadius:20,fontSize:12,letterSpacing:.5}}>{humanState(callState)}</span>
              {callState === 'active' && <span style={{color:'#fff',fontSize:12,opacity:.8}}>{mmss(elapsed)}</span>}
            </div>
            {peerLabel(resolvedPatientId, user) && (
              <div className="participant-chip" style={{background:'rgba(255,255,255,0.08)',color:'#eee',padding:'4px 10px',borderRadius:20,fontSize:12}}>Peer: {peerLabel(resolvedPatientId, user)}</div>
            )}
          </div>

          {['busy','error'].includes(callState) && reason && (
            <div style={{position:'absolute',top:80,left:20,background:'#b91c1c',color:'#fff',padding:'8px 14px',borderRadius:8,fontSize:13}}>{reason}</div>
          )}
        </div>
      </div>

      {/* Persistent Zoom-style control bar */}
      <div className="controls" style={{backdropFilter:'blur(6px)'}}>
        {/* Start / Accept section */}
        {user?.role === 'doctor' && callState === 'idle' && (
          isValidMongoId(resolvedPatientId) ? (
            <button className="control-btn" onClick={handleDoctorStart} title="Start Call">📞</button>
          ) : (
            <div style={{color:'#ffbf47', fontSize:12, maxWidth:160, textAlign:'center'}}>Invalid or missing patientId param</div>
          )
        )}
        {incomingOffer && callState === 'incoming' && user?.role === 'patient' && (
          <>
            <button className="control-btn" onClick={handleAcceptIncoming} title="Accept">✅</button>
            <button className="control-btn end-call" onClick={endCall} title="Reject">✖</button>
          </>
        )}

        {/* Active call controls */}
        {callState === 'active' && (
          <>
            <button className="control-btn" onClick={toggleAudio} title={audioEnabled ? 'Mute' : 'Unmute'}>{audioEnabled ? '🎤' : '🔇'}</button>
            <button className="control-btn" onClick={toggleVideo} title={videoEnabled ? 'Stop Video' : 'Start Video'}>{videoEnabled ? '📷' : '🚫'}</button>
            <button className="control-btn end-call" onClick={endCall} title="End Call">⏹</button>
          </>
        )}
        {callState === 'calling' && (
          <button className="control-btn end-call" onClick={endCall} title="Cancel Call">✖</button>
        )}
      </div>
    </div>
  );
}
