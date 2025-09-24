import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { fetchDoctorQueue } from "../utils/dashboardSlice";
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
  const { queue: patientQueue, loading } = useSelector((state) => state.dashboard);

  // ✅ Get the shared socket instance
  const socket = getSocket();

  useEffect(() => {
    dispatch(fetchDoctorQueue());
  }, [dispatch]);

  const handleStartCall = async (patientId, appointmentId) => {
    console.log(`Initializing call with patient: ${patientId}`);

    // Navigate immediately
    navigate(`/call/${appointmentId}`);

    // ✅ Emit start-call event
    socket.emit("webrtc:start-call", {
      to: patientId,
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
      default:
        return <div className="simple-card"><h3>{activePanel}</h3></div>;
    }
  };

  const sidebarItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "queue", label: "Patient Queue" },
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
