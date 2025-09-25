import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchPatientData } from "../utils/dashboardSlice";
import { getSocket } from "../utils/socket";
import DashboardLayout from '../components/DashboardLayout';
import { useLanguage } from '../utils/LanguageProvider';
import PatientOverview from "../components/patient-panels/PatientOverview";
import AppointmentBooking from "../components/patient-panels/AppointmentBooking";
import HealthRecords from "../components/patient-panels/HealthRecords";
import MedicineTracker from "../components/patient-panels/MedicineTracker";
import SymptomChecker from "../components/SymptomChecker";
import "../styles/dashboard.simple.css";

export default function PatientDashboard() {
  const { t } = useLanguage();
  const [activePanel, setActivePanel] = useState("overview");
  const [incomingCall, setIncomingCall] = useState(null); // { fromUserName, appointmentId }
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector((state) => state.auth);
  const { appointments, prescriptions, doctors, loading, currentMedicines = [], previousMedicines = [] } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchPatientData());
  }, [dispatch]);

  // This new useEffect listens for incoming calls from the doctor
  useEffect(() => {
    const socket = getSocket();
    const handleStartCall = ({ fromUserName, appointmentId }) => {
      setIncomingCall({ fromUserName, appointmentId });
    };
    // Prefer explicit start-call notification
    socket.on('webrtc:start-call', handleStartCall);
    return () => {
      socket.off('webrtc:start-call', handleStartCall);
    };
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
      return <div className="simple-card">{t('loading')}</div>;
    }
    
    switch (activePanel) {
      case "overview":
        return <PatientOverview user={user} setActivePanel={setActivePanel} appointments={appointments} prescriptions={prescriptions} currentMedicines={currentMedicines} />;
      case "book":
        return <AppointmentBooking 
                  appointments={appointments} 
                  doctors={doctors} 
                  onBookingSuccess={() => setActivePanel('overview')} 
               />;
      case "records":
        return <HealthRecords prescriptions={prescriptions} />;
      case "medicines":
        return <MedicineTracker currentMedicines={currentMedicines} previousMedicines={previousMedicines} />;
      case "symptoms":
        return <SymptomChecker />;
      default:
        return <div>{t('panelNotFound')}</div>;
    }
  };

  const sidebarItems = [
    { key: 'overview', label: t('overview') },
    { key: 'book', label: t('book') },
    { key: 'records', label: t('records') },
    { key: 'symptoms', label: t('symptomCheckerTitle') },
    { key: 'medicines', label: t('medicineTrackerTitle') },
  ];

  return (
    <DashboardLayout
      title={t('patientDashboard')}
      subtitle={user?.uniqueId}
      currentUser={user}
      sidebarItems={sidebarItems}
      activeKey={activePanel}
      onSelect={setActivePanel}
    >
      {/* This block will now display the incoming call notification */}
      {incomingCall && (
        <div className="incoming-call-card">
          <h4>{t('incomingCall')} {incomingCall.fromUserName || 'Doctor'}</h4>
          <div className="actions">
            <button className="btn btn-secondary" onClick={declineCall}>{t('decline')}</button>
            <button className="btn btn-primary" onClick={acceptCall}>{t('accept')}</button>
          </div>
        </div>
      )}
      {renderActivePanel()}
    </DashboardLayout>
  );
}
