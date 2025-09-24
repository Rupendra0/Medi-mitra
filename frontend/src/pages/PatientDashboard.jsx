import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchPatientData } from "../utils/dashboardSlice";
import { getSocket } from "../utils/socket";
import DashboardLayout from '../components/DashboardLayout';
import PatientOverview from "../components/patient-panels/PatientOverview";
import AppointmentBooking from "../components/patient-panels/AppointmentBooking";
import HealthRecords from "../components/patient-panels/HealthRecords";
import "../styles/dashboard.simple.css";

export default function PatientDashboard() {
  const [activePanel, setActivePanel] = useState("overview");
  const [incomingCall, setIncomingCall] = useState(null); // { fromUserName, appointmentId }
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector((state) => state.auth);
  const { appointments, prescriptions, doctors, loading } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchPatientData());
  }, [dispatch]);

  // This new useEffect listens for incoming calls from the doctor
  useEffect(() => {
    const socket = getSocket();
    const handleIncomingCall = ({ fromUserName, appointmentId }) => {
      setIncomingCall({ fromUserName, appointmentId });
    };
    socket.on('webrtc:offer', handleIncomingCall);
    return () => socket.off('webrtc:offer', handleIncomingCall);
  }, []);

  const acceptCall = () => {
    if (incomingCall) {
      navigate(`/call/${incomingCall.appointmentId}`);
    }
  };

  const declineCall = () => {
    setIncomingCall(null);
    // Optional: you could emit a 'webrtc:decline' event back to the doctor here
  };

  const renderActivePanel = () => {
    if (loading && appointments.length === 0) {
      return <div className="simple-card">Loading...</div>;
    }
    
    switch (activePanel) {
      case "overview":
        return <PatientOverview user={user} setActivePanel={setActivePanel} />;
      case "book":
        return <AppointmentBooking 
                  appointments={appointments} 
                  doctors={doctors} 
                  onBookingSuccess={() => setActivePanel('overview')} 
               />;
      case "records":
        return <HealthRecords prescriptions={prescriptions} />;
      default:
        return <div>Panel not found</div>;
    }
  };

  const sidebarItems = [
    { key: 'overview', label: 'Overview' },
    { key: 'book', label: 'Book Appointment' },
    { key: 'records', label: 'Health Records' },
  ];

  return (
    <DashboardLayout
      title="Patient Dashboard"
      subtitle={user?.uniqueId}
      currentUser={user}
      sidebarItems={sidebarItems}
      activeKey={activePanel}
      onSelect={setActivePanel}
    >
      {/* This block will now display the incoming call notification */}
      {incomingCall && (
        <div className="incoming-call-card">
          <h4>Incoming Call from Dr. {incomingCall.fromUserName}</h4>
          <div className="actions">
            <button className="btn btn-secondary" onClick={declineCall}>Decline</button>
            <button className="btn btn-primary" onClick={acceptCall}>Accept</button>
          </div>
        </div>
      )}
      {renderActivePanel()}
    </DashboardLayout>
  );
}
