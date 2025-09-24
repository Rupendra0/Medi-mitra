import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { fetchDoctorQueue, fetchAttendedPatients } from "../utils/dashboardSlice";
import DashboardLayout from '../components/DashboardLayout';
import { getSocket } from '../utils/socket'; // ✅ Import getSocket
import api from '../utils/api';
import "../styles/dashboard.simple.css";

const QueueList = ({ items, onStartCall, onMarkComplete }) => {
  if (!items || items.length === 0) {
    return <div className="simple-card"><p>The patient queue is empty.</p></div>;
  }
  return (
    <div className="simple-card">
      {items.map((item, index) => (
        <div key={item.appointmentId || index} className="queue-item">
          <div className="patient-info">
            <span className="queue-number">{index + 1}</span>
            <span className="patient-name">{item.name}</span>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" onClick={() => onMarkComplete(item.appointmentId)}>Done</button>
            <button className="btn btn-primary" onClick={() => onStartCall(item.patientId, item.appointmentId)}>Start Call</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function DoctorDashboard() {
  const [activePanel, setActivePanel] = useState("queue");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);
  const { queue: patientQueueRaw, attendedPatients: attendedPatientsRaw, loading } = useSelector((state) => state.dashboard);
  const patientQueue = Array.isArray(patientQueueRaw) ? patientQueueRaw : [];
  const attendedPatients = Array.isArray(attendedPatientsRaw) ? attendedPatientsRaw : [];

  // ✅ Get the shared socket instance
  const socket = getSocket();

  useEffect(() => {
    dispatch(fetchDoctorQueue());
    dispatch(fetchAttendedPatients());
  }, [dispatch]);

  const handleStartCall = async (patientId, appointmentId) => {
    console.log(`Initializing call with patient: ${patientId}`);

    // Navigate immediately
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
    try {
      await api.apiFetch('/api/appointments/complete', {
        method: 'POST',
        body: JSON.stringify({ appointmentId })
      });
      dispatch(fetchDoctorQueue());
    } catch (error) {
      console.error("Failed to mark appointment as completed:", error);
    }
  };

  // attendedPatients now comes from Redux state (fetched from backend)

  const handleDownloadPrescription = (patient) => {
    const lines = [
      `Patient Name: ${patient.name}`,
      `Patient ID: ${patient.id}`,
      '',
      'Prescriptions:',
      ...patient.prescriptions.map((presc, i) => (
        `${i + 1}. ${presc.medicine} - ${presc.dosage} (${presc.date})\n   Notes: ${presc.notes}`
      ))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patient.name}_prescription.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderPanel = () => {
    switch (activePanel) {
      case "dashboard":
        return (
          <div className="simple-card">
            <h3>Overview</h3>
            <p>Patients waiting in queue: {patientQueue.length}</p>
          </div>
        );
      case "queue":
        return (
          <div>
            <h3>Patient Queue</h3>
            {loading ? <p>Loading queue...</p> : 
              <QueueList 
                items={patientQueue.map(a => ({
                  name: a.patient?.name || 'Unknown',
                  appointmentId: a._id,
                  patientId: a.patient?._id,
                }))} 
                onStartCall={handleStartCall} 
                onMarkComplete={handleMarkComplete} 
              />
            }
          </div>
        );
      case "attended":
        return (
          <div className="simple-card">
            <h3>Attended Patients</h3>
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
                {attendedPatients.map((p, idx) => (
                  <tr key={p.id} style={{ background: idx % 2 === 0 ? '#18232e' : 'transparent' }}>
                    <td style={{ border: '1px solid #00ffd0', padding: '8px', color: '#fff' }}>{p.id}</td>
                    <td style={{ border: '1px solid #00ffd0', padding: '8px', color: '#fff' }}>{p.name}</td>
                    <td style={{ border: '1px solid #00ffd0', padding: '8px', color: '#fff' }}>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {p.prescriptions.map((presc, i) => (
                          <li key={i}>
                            <strong>{presc.medicine}</strong> - {presc.dosage} ({presc.date})<br />
                            <span style={{ fontSize: '0.95em', color: '#00ffd0' }}>{presc.notes}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td style={{ border: '1px solid #00ffd0', padding: '8px', color: '#fff', textAlign: 'center' }}>
                      <button className="btn btn-primary" onClick={() => handleDownloadPrescription(p)}>
                        Download Prescription
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <div className="simple-card"><h3>{activePanel}</h3></div>;
    }
  };

  const sidebarItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "queue", label: "Patient Queue" },
    { key: "attended", label: "Attended Patients" },
    { key: "records", label: "Digital Records" },
  ];

  return (
    <DashboardLayout
      title={currentUser?.name || 'Doctor'}
      subtitle={currentUser?.specialization || 'Dashboard'}
      currentUser={currentUser}
      sidebarItems={sidebarItems}
      activeKey={activePanel}
      onSelect={setActivePanel}
    >
      {renderPanel()}
    </DashboardLayout>
  );
}
