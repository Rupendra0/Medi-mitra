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
                <span className={`call-status ${callState}`} style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.8em',
                  backgroundColor: callState === 'calling' ? '#ff6b35' :
                                 callState === 'connected' ? '#00d4aa' :
                                 callState === 'error' ? '#ff4757' : '#666',
                  color: 'white'
                }}>
                  {callState.charAt(0).toUpperCase() + callState.slice(1)}
                </span>
              )}
            </div>
            <div className="actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => onMarkComplete(item.appointmentId)}
                disabled={isCallInProgress}
                style={{ opacity: isCallInProgress ? 0.5 : 1 }}
              >
                Done
              </button>
              <button 
                className={`btn ${isCallInProgress ? 'btn-disabled' : 'btn-primary'}`}
                onClick={() => onStartCall(item.patientId, item.appointmentId)}
                disabled={isCallInProgress}
                title={isCallInProgress ? `Call ${callState}` : 'Start video call'}
                style={{ 
                  opacity: isCallInProgress ? 0.6 : 1,
                  cursor: isCallInProgress ? 'not-allowed' : 'pointer'
                }}
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

    // Navigate to call page with patient ID parameter
    navigate(`/call/${appointmentId}?patientId=${patientId}`);

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

  const handleDownloadPrescription = async (patient) => {
    try {
      const patientId = patient._id || patient.id || patient.patient?._id || patient.patient?.id;
      const patientName = patient.name || patient.patient?.name || 'Patient';
      
      if (!patientId) {
        alert('Patient ID not found');
        return;
      }

      const response = await api.apiFetch(`/api/patients/${patientId}/prescriptions/download`, {
        method: 'GET',
        headers: { 'Accept': 'application/pdf' }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${patientName}_prescription_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to download prescription');
      }
    } catch (error) {
      console.error('Error downloading prescription:', error);
      alert('Error downloading prescription');
    }
  };

  // Enhanced function to handle possible date objects or ISO strings
  const parsePossibleDate = (item) => {
    const candidates = [
      item.date, item.createdAt, item.updatedAt, item.visitDate,
      item.patient?.date, item.patient?.createdAt, item.patient?.updatedAt
    ];
    for (const c of candidates) {
      if (c) {
        const d = new Date(c);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }
    return null;
  };

  // Main content panel switcher
  const renderMainPanel = () => {
    switch (activePanel) {
      case "profile":
        return (
          <div className="simple-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <Avatar user={currentUser} size={120} />
              <div style={{ flex: 1 }}>
                <h2 style={{ marginTop: 0 }}>{currentUser?.name || 'Doctor'}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div><strong>Email:</strong> {currentUser?.email || '—'}</div>
                  <div><strong>Role:</strong> {currentUser?.role || '—'}</div>
                  <div><strong>Specialization:</strong> {currentUser?.specialization || '—'}</div>
                  <div><strong>Experience:</strong> {currentUser?.experience || '—'}</div>
                  <div><strong>Total Patients:</strong> {attendedPatients?.length || 0}</div>
                  <div><strong>Queue Length:</strong> {patientQueue?.length || 0}</div>
                </div>

                {attendedPatients && attendedPatients.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h4>Recent Patients</h4>
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid rgba(0,255,208,0.2)', borderRadius: 8, padding: 12 }}>
                      {attendedPatients.slice(0, 5).map((p, idx) => (
                        <div key={p._id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < 4 ? '1px dashed rgba(255,255,255,0.1)' : 'none' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.patient?.name || p.name || 'Unknown'}</div>
                            <div style={{ fontSize: 12, color: '#cfeee6' }}>{parsePossibleDate(p) ? new Date(parsePossibleDate(p)).toLocaleDateString() : '—'}</div>
                          </div>
                          {Array.isArray(p.prescriptions) && p.prescriptions.length > 0 && (
                            <div style={{ marginTop: 6 }}>
                              <small style={{ color: '#00ffd0' }}>{p.prescriptions.length} prescription(s)</small>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case "queue":
        return (
          <div>
            <h3>Patient Queue {isInCall && <span style={{color: '#ff6b35', marginLeft: '10px'}}>(Call in Progress)</span>}</h3>
            {loading ? <p>Loading queue...</p> : 
              <QueueList 
                items={patientQueue.map(a => ({
                  name: a.patient?.name || 'Unknown',
                  appointmentId: a._id,
                  patientId: a.patient?._id,
                }))} 
                onStartCall={handleStartCall} 
                onMarkComplete={handleMarkComplete}
                callStates={callStates}
              />
            }
          </div>
        );
      case "attended":
        {
          const list = Array.isArray(attendedPatients) ? attendedPatients : [];
          return (
            <div className="simple-card">
              <h3>Attended Patients</h3>
              {list.length === 0 ? (
                <p>No patients attended yet.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                  <thead>
                    <tr style={{ background: '#0a233a', color: '#00ffd0' }}>
                      <th style={{ border: '1px solid #00ffd0', padding: '8px' }}>Patient ID</th>
                      <th style={{ border: '1px solid #00ffd0', padding: '8px' }}>Name</th>
                      <th style={{ border: '1px solid #00ffd0', padding: '8px' }}>Prescriptions</th>
                      <th style={{ border: '1px solid #00ffd0', padding: '8px' }}>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p, idx) => {
                      const key = p._id || p.id || (p.patient && (p.patient._id || p.patient.id)) || idx;
                      const prescriptionsSafe = Array.isArray(p.prescriptions) ? p.prescriptions : (Array.isArray(p.patient?.prescriptions) ? p.patient.prescriptions : []);
                      const patientIdDisplay = p.id || p.patient?.id || p.patient?._id || '—';
                      const patientName = p.name || p.patient?.name || 'Unknown';
                      return (
                        <tr key={key} style={{ background: idx % 2 === 0 ? '#18232e' : 'transparent' }}>
                          <td style={{ border: '1px solid #00ffd0', padding: '8px', color: '#fff' }}>{patientIdDisplay}</td>
                          <td style={{ border: '1px solid #00ffd0', padding: '8px', color: '#fff' }}>{patientName}</td>
                          <td style={{ border: '1px solid #00ffd0', padding: '8px', color: '#fff' }}>
                            {prescriptionsSafe.length === 0 ? (
                              <em style={{ color: '#cfeee6' }}>No prescriptions</em>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: 16 }}>
                                {prescriptionsSafe.map((presc, i) => (
                                  <li key={i}>
                                    <strong>{presc.medicine || presc.medication || '—'}</strong> - {presc.dosage || presc.frequency || '—'} ({presc.date || presc.createdAt || '—'})<br />
                                    <span style={{ fontSize: '0.95em', color: '#00ffd0' }}>{presc.notes || '—'}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td style={{ border: '1px solid #00ffd0', padding: '8px', color: '#fff', textAlign: 'center' }}>
                            <button className="btn btn-primary" onClick={() => handleDownloadPrescription(p)}>
                              Download Prescription
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        }
      default:
        return <div className="simple-card"><h3>{activePanel}</h3></div>;
    }
  };

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
          <div>
            <h1 style={{ margin: 0, color: '#00ffd0', fontWeight: 700 }}>{t('doctorDashboard')}</h1>
            <p style={{ margin: '6px 0 0', color: '#cfeee6' }}>{t('managePatientsAndAppointments')}</p>
          </div>
          <Avatar user={currentUser} size={64} />
        </div>

        {/* Navigation Pills */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 30, background: '#071e24', padding: 6, borderRadius: 12, border: '1px solid rgba(0,255,208,0.1)' }}>
          {['profile', 'queue', 'attended'].map((panel) => (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              style={{
                background: activePanel === panel ? '#00ffd0' : 'transparent',
                color: activePanel === panel ? '#071e24' : '#00ffd0',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease'
              }}
            >
              {t(panel)}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          {renderMainPanel()}

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            <div className="simple-card" style={{ marginBottom: 18 }}>
              <h4>{t('todaysSchedule')}</h4>
              {patientQueue.length === 0 ? (
                <p>{t('noAppointmentsToday')}</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {patientQueue.map((a, i) => (
                    <li key={a._id || i} style={{ marginBottom: 10 }}>
                      <strong>{a.patient?.name || a.name || 'Unknown'}</strong>
                      <div style={{ color: '#cfeee6', fontSize: 13 }}>{a.slot || a.time || a.date || 'Time not set'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="simple-card">
              <h4>{t('activityFeed')}</h4>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {attendedPatients.length === 0 ? (
                  <p>{t('noRecentActivity')}</p>
                ) : (
                  attendedPatients.slice(0, 10).map((p, idx) => (
                    <div key={p._id || idx} style={{ padding: 10, borderBottom: '1px dashed rgba(255,255,255,0.03)' }}>
                      <div style={{ color: '#00ffd0', fontWeight: 600 }}>{p.patient?.name || p.name || 'Unknown'}</div>
                      <div style={{ color: '#cfeee6', fontSize: 13 }}>{parsePossibleDate(p) ? new Date(parsePossibleDate(p)).toLocaleString() : '—'}</div>
                      <div style={{ marginTop: 6, color: '#cfeee6' }}>{(p.note || p.summary || (p.prescriptions && p.prescriptions.length > 0 ? `${p.prescriptions.length} prescription(s)` : t('visited')))}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}