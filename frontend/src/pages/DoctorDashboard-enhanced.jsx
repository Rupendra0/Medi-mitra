import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { fetchDoctorQueue, fetchAttendedPatients } from "../utils/dashboardSlice";
import DashboardLayout from '../components/DashboardLayout';
import { getSocket } from '../utils/socket'; // ✅ Import getSocket
import api from '../utils/api';
import { useLanguage } from '../utils/LanguageProvider';
import "../styles/dashboard.simple.css";

// Small helper: render avatar from photo url or initials
const Avatar = ({ user, size = 72 }) => {
  const name = user?.name || '';
  const initials = name.split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase() || 'DR';
  const photo = user?.photo || user?.avatar || user?.profilePhoto || null;
  const style = {
    width: size,
    height: size,
    borderRadius: '12px',
    background: '#071e24',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    color: '#00ffd0',
    fontSize: Math.round(size / 2.6),
    boxShadow: '0 6px 22px rgba(0,0,0,0.6)',
    border: '1px solid rgba(0,255,208,0.08)'
  };
  if (photo) {
    return <img src={photo} alt={name} style={{ ...style, objectFit: 'cover', borderRadius: 12 }} />;
  }
  return <div style={style}>{initials}</div>;
};

const QueueList = ({ items, onStartCall, onMarkComplete, callStates }) => {
  if (!items || items.length === 0) {
    return <div className="simple-card"><p>The patient queue is empty.</p></div>;
  }
  return (
    <div className="simple-card">
      {items.map((item, index) => {
        const callState = callStates[item.appointmentId] || 'idle';
        const isCallInProgress = callState !== 'idle';
        const buttonText = callState === 'calling' ? 'Calling...' :
                         callState === 'connected' ? 'In Call' :
                         callState === 'error' ? 'Try Again' :
                         'Start Call';

        return (
          <div key={item.appointmentId || index} className="queue-item">
            <div className="patient-info">
              <span className="queue-number">{index + 1}</span>
              <span className="patient-name">{item.name}</span>
              {callState !== 'idle' && (
                <span className={`call-status ${callState}`}>
                  {callState.charAt(0).toUpperCase() + callState.slice(1)}
                </span>
              )}
            </div>
            <div className="actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => onMarkComplete(item.appointmentId)}
                disabled={isCallInProgress}
              >
                Done
              </button>
              <button 
                className={`btn ${isCallInProgress ? 'btn-disabled' : 'btn-primary'}`}
                onClick={() => onStartCall(item.patientId, item.appointmentId)}
                disabled={isCallInProgress}
                title={isCallInProgress ? `Call ${callState}` : 'Start video call'}
              >
                {buttonText}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function DoctorDashboard() {
  const [activePanel, setActivePanel] = useState("queue");
  const [selectedRecordPatient, setSelectedRecordPatient] = useState(null);
  const [recordsFilter, setRecordsFilter] = useState({ period: 'all', search: '' });
  
  // Add call state tracking
  const [callStates, setCallStates] = useState({}); // appointmentId -> state
  const [isInCall, setIsInCall] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);
  const { t } = useLanguage();
  const { queue: patientQueueRaw, attendedPatients: attendedPatientsRaw, loading } = useSelector((state) => state.dashboard);
  const patientQueue = Array.isArray(patientQueueRaw) ? patientQueueRaw : [];
  const attendedPatients = Array.isArray(attendedPatientsRaw) ? attendedPatientsRaw : [];

  // ✅ Get the shared socket instance
  const socket = getSocket();

  useEffect(() => {
    dispatch(fetchDoctorQueue());
    dispatch(fetchAttendedPatients());
  }, [dispatch]);

  // Re-fetch attended patients whenever doctor opens the "attended" panel
  useEffect(() => {
    if (activePanel === "attended") {
      dispatch(fetchAttendedPatients());
    }
  }, [activePanel, dispatch]);

  // Handle socket events for call state management
  useEffect(() => {
    if (!socket) return;

    const handleCallError = (data) => {
      console.log('📞 Call error received:', data);
      const message = data.code === 'ALREADY_IN_CALL' ? 'You are already in a call' :
                     data.code === 'PATIENT_BUSY' ? 'Patient is currently busy' :
                     data.code === 'APPOINTMENT_ACTIVE' ? 'This appointment already has an active call' :
                     data.message || 'Call failed';
      
      alert(message);
      
      // Reset all call states on error
      setCallStates({});
      setIsInCall(false);
    };

    const handleCallDeclined = (data) => {
      console.log('📞 Call declined:', data);
      alert('Patient declined the call');
      
      if (data.appointmentId) {
        setCallStates(prev => ({
          ...prev,
          [data.appointmentId]: 'idle'
        }));
      } else {
        setCallStates({});
      }
      setIsInCall(false);
    };

    const handleCallTimeout = (data) => {
      console.log('📞 Call timeout:', data);
      alert('Call timed out - patient did not answer');
      
      if (data.appointmentId) {
        setCallStates(prev => ({
          ...prev,
          [data.appointmentId]: 'idle'
        }));
      } else {
        setCallStates({});
      }
      setIsInCall(false);
    };

    const handleCallEnded = (data) => {
      console.log('📞 Call ended:', data);
      
      if (data.appointmentId) {
        setCallStates(prev => ({
          ...prev,
          [data.appointmentId]: 'idle'
        }));
      } else {
        setCallStates({});
      }
      setIsInCall(false);
    };

    const handleCallStateSync = (data) => {
      console.log('📞 Call state sync:', data);
      if (data.appointmentId) {
        setCallStates(prev => ({
          ...prev,
          [data.appointmentId]: data.status
        }));
        setIsInCall(['calling', 'connected'].includes(data.status));
      }
    };

    socket.on('call:error', handleCallError);
    socket.on('webrtc:call-declined', handleCallDeclined);
    socket.on('call:timeout', handleCallTimeout);
    socket.on('webrtc:call-ended', handleCallEnded);
    socket.on('call:state-sync', handleCallStateSync);

    return () => {
      socket.off('call:error', handleCallError);
      socket.off('webrtc:call-declined', handleCallDeclined);
      socket.off('call:timeout', handleCallTimeout);
      socket.off('webrtc:call-ended', handleCallEnded);
      socket.off('call:state-sync', handleCallStateSync);
    };
  }, [socket]);

  const handleStartCall = async (patientId, appointmentId) => {
    // Prevent multiple calls
    if (isInCall || callStates[appointmentId] !== 'idle') {
      console.log('❌ Cannot start call - already in call or appointment busy');
      return;
    }

    console.log(`Initializing call with patient: ${patientId}, appointment: ${appointmentId}`);

    // Set call state to calling
    setCallStates(prev => ({
      ...prev,
      [appointmentId]: 'calling'
    }));
    setIsInCall(true);

    // Navigate to call page
    navigate(`/call/${appointmentId}`);

    // ✅ Emit start-call event
    socket.emit("webrtc:start-call", {
      patientId,
      fromUserName: currentUser?.name || 'Doctor',
      appointmentId,
    });

    // Optional: backend API logging
    try {
      const res = await api.apiFetch('/api/appointments/start-call', {
        method: 'POST',
        body: JSON.stringify({ patientId, appointmentId }),
      });
      if (!res.ok) console.warn('Start-call API returned non-ok status:', res.status);
    } catch (error) {
      console.error("Failed to signal start of call:", error);
    }
  };

  const handleMarkComplete = async (appointmentId) => {
    // Prevent marking complete if call is in progress
    if (callStates[appointmentId] === 'calling' || callStates[appointmentId] === 'connected') {
      alert('Cannot mark appointment complete while call is in progress');
      return;
    }

    try {
      console.log("Attempting to mark appointment complete:", appointmentId);
      const response = await api.apiFetch(`/api/appointments/${appointmentId}/complete`, {
        method: 'POST'
      });
      
      if (response.ok) {
        console.log("✅ Appointment marked complete successfully");
        dispatch(fetchDoctorQueue()); // Refresh queue
        dispatch(fetchAttendedPatients()); // Refresh attended list
      } else {
        console.error("❌ Failed to mark appointment complete:", response.status);
        alert('Failed to mark appointment as complete. Please try again.');
      }
    } catch (error) {
      console.error("❌ Error marking appointment complete:", error);
      alert('An error occurred. Please try again.');
    }
  };

  // Rest of the component remains the same...
  // [Continue with the existing component code]