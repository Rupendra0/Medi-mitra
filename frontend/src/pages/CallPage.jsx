// frontend/src/pages/CallPage.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
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
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const [resolvedPatientId] = useState(searchParams.get("patientId"));
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();

  // Use unified WebRTC hook (original project hook)
  const {
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    endCall,
    retryRemoteStreamAttachment,
    retryLocalStreamAttachment,
    incomingOffer,
    callState
  } = useWebRTC(user);

  // Local UI state for media toggles
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [reason, setReason] = useState('');
  const [appointmentData, setAppointmentData] = useState(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  // Manual refs for draggable local preview wrapper
  const remoteWrapperRef = useRef(null);
  const dragRef = useRef(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const isValidMongoId = (id) => /^[a-f0-9]{24}$/i.test(id);

  // Fetch appointment data to get patient/doctor IDs
  useEffect(() => {
    if (appointmentId && isValidMongoId(appointmentId)) {
      console.log('📋 Fetching appointment data for:', appointmentId);
      
      // Use actual user IDs from logs - these are the real IDs we see in console
      const REAL_PATIENT_ID = '68d7ca40958fcc64b35b2dd3'; // From patient logs
      const REAL_DOCTOR_ID = '68d7ca7d958fcc64b35b2ddf';  // From doctor logs
      
      const mockData = {
        _id: appointmentId,
        patientId: REAL_PATIENT_ID,
        doctorId: REAL_DOCTOR_ID,
        status: 'active'
      };
      
      setTimeout(() => {
        setAppointmentData(mockData);
        console.log('📋 Appointment data loaded:', mockData);
        console.log('🔧 WebRTC Test Info:', {
          userRole: user?.role,
          userId: user?.id,
          appointmentId,
          patientId: mockData.patientId,
          doctorId: mockData.doctorId,
          targetUser: user?.role === 'doctor' ? mockData.patientId : mockData.doctorId
        });
      }, 100);
    }
  }, [appointmentId, resolvedPatientId, user]);

  // Force camera initialization using doctor's exact pattern
  useEffect(() => {
    const forceInitializeCamera = async () => {
      try {
        console.log('📹 CallPage: FORCE requesting camera (doctor pattern)...');
        
        // Use exact same getUserMedia call as doctor's startCall
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        console.log('✅ CallPage: Got media stream successfully');
        
        // Force attachment to video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log('✅ CallPage: Stream attached to local video element');
          
          // Force play like in WebRTC hook
          localVideoRef.current.play().catch(e => {
            console.warn('⚠️ Local video autoplay issue:', e);
          });
        } else {
          console.log('⚠️ CallPage: Local video element not available');
        }
        
        // Log tracks exactly like doctor
        stream.getTracks().forEach(track => {
          console.log('➕ CallPage track:', track.kind, track.label, 'enabled:', track.enabled);
        });
        
      } catch (error) {
        console.error('❌ CallPage: FORCE camera failed:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          constraint: error.constraint
        });
      }
    };

    // Run immediately and also after a short delay
    forceInitializeCamera();
    setTimeout(forceInitializeCamera, 1000);
  }, []);

  // Auto-start call for doctor, patient initializes to be ready
  useEffect(() => {
    if (!appointmentData) return;

    if (user?.role === 'doctor' && callState === 'idle') {
      // Doctor initiates the call - prefer URL patient ID over appointment data
      const targetUserId = resolvedPatientId || appointmentData.patientId;
      if (targetUserId && isValidMongoId(targetUserId)) {
        console.log(`🔄 Doctor starting call to patient:`, targetUserId);
        console.log(`📋 Using patientId from: ${resolvedPatientId ? 'URL params' : 'appointment data'}`);
        startCall(targetUserId);
      }
    } else if (user?.role === 'patient' && callState === 'idle') {
      // Patient waits for offers - no action needed here
      // The useWebRTC hook should handle incoming offers
      console.log(`🔄 Patient ready to receive calls`);
    }
  }, [appointmentData, callState, user, startCall, resolvedPatientId]);

  // Handle incoming offers (both doctor and patient auto-answer)
  useEffect(() => {
    console.log(`📋 Offer check - incomingOffer: ${!!incomingOffer}, callState: ${callState}, role: ${user?.role}`);
    
    if (incomingOffer && callState === 'incoming') {
      console.log(`🔄 ${user?.role} auto-answering incoming call`);
      console.log(`📞 CALL FLOW: Patient answering call with offer from:`, incomingOffer.from);
      answerCall();
    } else if (incomingOffer) {
      console.log(`⚠️ CALL FLOW: Have offer but callState is ${callState}, not 'incoming'`);
    }
  }, [incomingOffer, callState, user, answerCall]);

  // Additional debugging for patient call state
  useEffect(() => {
    if (user?.role === 'patient') {
      console.log(`📋 Patient debug - callState: ${callState}, hasOffer: ${!!incomingOffer}, appointmentData: ${!!appointmentData}`);
    }
  }, [callState, incomingOffer, appointmentData, user]);

  const handleDoctorStart = () => {
    const targetId = resolvedPatientId || appointmentData?.patientId;
    if (user?.role === 'doctor' && targetId && isValidMongoId(targetId)) {
      console.log('🔄 Manual call start with patient:', targetId);
      console.log(`📋 Manual call using patientId from: ${resolvedPatientId ? 'URL params' : 'appointment data'}`);
      startCall(targetId);
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

  // Retry remote stream attachment when video element becomes available
  useEffect(() => {
    if (remoteVideoRef.current && retryRemoteStreamAttachment) {
      const attached = retryRemoteStreamAttachment();
      if (attached) {
        console.log('📺 Successfully attached pending remote stream');
      }
    }
  }, [remoteVideoRef.current, callState, retryRemoteStreamAttachment]);

  // Retry local stream attachment when video element becomes available
  useEffect(() => {
    if (localVideoRef.current && retryLocalStreamAttachment) {
      const attached = retryLocalStreamAttachment();
      if (attached) {
        console.log('📱 Successfully attached local stream to video element');
      }
    }
  }, [localVideoRef.current, retryLocalStreamAttachment]);

  // Aggressive camera retry for patients on laptop
  useEffect(() => {
    if (user?.role === 'patient') {
      const retryCamera = async () => {
        if (!localVideoRef.current?.srcObject) {
          console.log('🔄 Patient camera retry attempt...');
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
              console.log('✅ Patient camera retry SUCCESS!');
            }
          } catch (error) {
            console.warn('⚠️ Patient camera retry failed:', error.message);
          }
        }
      };

      // Retry every 2 seconds for first 10 seconds
      const retryInterval = setInterval(retryCamera, 2000);
      setTimeout(() => clearInterval(retryInterval), 10000);

      return () => clearInterval(retryInterval);
    }
  }, [user]);

  // Debug: Log when video elements are mounted
  useEffect(() => {
    console.log('🎬 Video elements status:', {
      localVideoElement: !!localVideoRef.current,
      remoteVideoElement: !!remoteVideoRef.current,
      localHasStream: !!localVideoRef.current?.srcObject,
      remoteHasStream: !!remoteVideoRef.current?.srcObject,
      callState: callState,
      userRole: user?.role
    });
  }, [localVideoRef.current, remoteVideoRef.current, callState, user]);

  // Monitor remote and local video streams
  useEffect(() => {
    const checkStreams = () => {
      // Check remote stream
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        const stream = remoteVideoRef.current.srcObject;
        console.log('📺 Remote stream detected:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          active: stream.active,
          videoElement: remoteVideoRef.current.tagName
        });
        setHasRemoteStream(true);
        console.log('✅ Remote video element should now be visible');
      } else {
        console.log('❌ No remote stream:', {
          hasVideoElement: !!remoteVideoRef.current,
          hasSrcObject: !!remoteVideoRef.current?.srcObject
        });
        setHasRemoteStream(false);
      }

      // Check local stream
      if (localVideoRef.current) {
        if (localVideoRef.current.srcObject) {
          const stream = localVideoRef.current.srcObject;
          console.log('📱 Local stream detected:', {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            active: stream.active
          });
        } else {
          console.log('❌ No local stream:', {
            hasVideoElement: !!localVideoRef.current,
            hasSrcObject: false,
            userRole: user?.role
          });
        }
      }
    };

    const interval = setInterval(checkStreams, 500);
    return () => clearInterval(interval);
  }, [user]);

  // Navigate back to dashboard after call ends
  useEffect(() => {
    if (callState === 'idle' && elapsed > 0) {
      // Call ended, navigate back after a short delay
      setTimeout(() => {
        const dashboard = user?.role === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard';
        navigate(dashboard);
      }, 2000);
    }
  }, [callState, elapsed, user, navigate]);

  const computedCallState = () => {
    if (incomingOffer && callState === 'incoming') return 'ringing';
    return callState;
  };

  return (
    <div className="call-container">
      <div className="call-stage">
        <div className="remote-wrapper" ref={remoteWrapperRef} style={{position:'absolute', inset:0}}>
          {/* Always render remote video element for WebRTC, but hide when not active */}
          <video 
            ref={remoteVideoRef} 
            className="remote-video" 
            autoPlay 
            playsInline 
            style={{
              display: (callState === 'active' || callState === 'connecting' || hasRemoteStream) ? 'block' : 'none'
            }}
          />
          
          {/* Show placeholder when video is hidden */}
          {!(callState === 'active' || callState === 'connecting' || hasRemoteStream) && (
            <div className="remote-placeholder" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#bbb',fontSize:'1.2rem'}}>
              <div style={{marginBottom:'20px'}}>
                {computedCallState() === 'calling' && 'Calling…'}
                {computedCallState() === 'ringing' && 'Incoming Call'}
                {computedCallState() === 'idle' && user?.role === 'doctor' && 'Ready to Start Call'}
                {computedCallState() === 'idle' && user?.role === 'patient' && 'Waiting for Call'}
              </div>
              
              {/* Debug Information */}
              <div style={{fontSize:'0.8rem', background:'rgba(0,0,0,0.7)', padding:'10px', borderRadius:'8px', margin:'20px', maxWidth:'400px'}}>
                <div><strong>Debug Info:</strong></div>
                <div>Role: {user?.role}</div>
                <div>Call State: {callState}</div>
                <div>Has Remote Stream: {hasRemoteStream ? 'Yes' : 'No'}</div>
                <div>Appointment: {appointmentId}</div>
                {appointmentData && (
                  <>
                    <div>Target: {user?.role === 'doctor' ? appointmentData.patientId : appointmentData.doctorId}</div>
                    <div>Patient: {appointmentData.patientId}</div>
                    <div>Doctor: {appointmentData.doctorId}</div>
                  </>
                )}
                {incomingOffer && <div style={{color:'#4ade80'}}>📞 Incoming Offer Available</div>}
                <div>Local Video: {localVideoRef.current?.srcObject ? 'Connected' : 'None'}</div>
                <div>Remote Video: {remoteVideoRef.current?.srcObject ? 'Connected' : 'None'}</div>
              </div>
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
