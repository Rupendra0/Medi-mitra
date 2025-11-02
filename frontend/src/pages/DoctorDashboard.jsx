import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { fetchDoctorQueue, fetchAttendedPatients, fetchDigitalRecords } from "../utils/dashboardSlice";
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

const QueueList = ({ items, onStartCall, onMarkComplete, onGivePrescription, onViewDocuments }) => {
  if (!items || items.length === 0) {
    return <div className="simple-card"><p>The patient queue is empty.</p></div>;
  }
  return (
    <div className="simple-card elegant-scroll-area" style={{ 
      maxHeight: 'calc(100vh - 200px)'
    }}>
      {items.map((item, index) => (
        <div key={item.appointmentId || index} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '16px',
          marginBottom: '12px',
          background: 'rgba(0,255,208,0.05)',
          border: '1px solid rgba(0,255,208,0.1)',
          borderRadius: '12px'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                background: '#00ffd0',
                color: '#071e24',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '700',
                marginRight: '12px'
              }}>{index + 1}</span>
              <span style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#ffffff' 
              }}>{item.name}</span>
            </div>
            
            {/* Patient Details/Symptoms */}
            <div style={{ marginLeft: '36px' }}>
              {item.symptoms && (
                <div style={{ marginBottom: '6px' }}>
                  <strong style={{ color: '#00ffd0', fontSize: '12px' }}>SYMPTOMS: </strong>
                  <span style={{ color: '#cfeee6', fontSize: '14px' }}>{item.symptoms}</span>
                </div>
              )}
              {item.appointmentTime && (
                <div style={{ marginBottom: '6px' }}>
                  <strong style={{ color: '#00ffd0', fontSize: '12px' }}>TIME: </strong>
                  <span style={{ color: '#cfeee6', fontSize: '14px' }}>{item.appointmentTime}</span>
                </div>
              )}
              {item.description && (
                <div style={{ marginBottom: '6px' }}>
                  <strong style={{ color: '#00ffd0', fontSize: '12px' }}>DESCRIPTION: </strong>
                  <span style={{ color: '#cfeee6', fontSize: '14px' }}>{item.description}</span>
                </div>
              )}
              {item.documents && item.documents.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  <strong style={{ color: '#00ffd0', fontSize: '12px' }}>DOCUMENTS: </strong>
                  <span style={{ color: '#ffa500', fontSize: '14px', fontWeight: '600' }}>
                    📎 {item.documents.length} file{item.documents.length > 1 ? 's' : ''} attached
                  </span>
                </div>
              )}
              {item.reason && (
                <div style={{ marginBottom: '6px' }}>
                  <strong style={{ color: '#00ffd0', fontSize: '12px' }}>REASON: </strong>
                  <span style={{ color: '#cfeee6', fontSize: '14px' }}>{item.reason}</span>
                </div>
              )}
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <button 
              className="btn btn-primary" 
              style={{ minWidth: '100px' }}
              onClick={() => onStartCall(item.patientId, item.appointmentId)}
            >
              Start Call
            </button>
            <button 
              className="btn" 
              style={{ 
                minWidth: '110px',
                background: '#ff6b35',
                border: '1px solid #ff6b35',
                color: '#fff'
              }}
              onClick={() => onViewDocuments(item)}
            >
              � Documents
              {item.documents && item.documents.length > 0 && (
                <span style={{ 
                  marginLeft: '4px',
                  background: '#fff',
                  color: '#ff6b35',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {item.documents.length}
                </span>
              )}
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ minWidth: '110px' }}
              onClick={() => onGivePrescription(item)}
            >
              Prescription
            </button>
            <button 
              className="btn btn-outline" 
              style={{ minWidth: '80px' }}
              onClick={() => onMarkComplete(item.appointmentId)}
            >
              Done
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function DoctorDashboard() {
  const [activePanel, setActivePanel] = useState("queue");
  const [selectedRecordPatient, setSelectedRecordPatient] = useState(null);
  const [patientCompleteHistory, setPatientCompleteHistory] = useState(null);
  const [recordsFilter, setRecordsFilter] = useState({ period: 'all', search: '' });
  const [showExportMenu, setShowExportMenu] = useState(null); // For showing export options menu
  const [showPrescription, setShowPrescription] = useState(false);
  const [currentPrescriptionPatient, setCurrentPrescriptionPatient] = useState(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [currentDocumentsPatient, setCurrentDocumentsPatient] = useState(null);
  const [prescriptionData, setPrescriptionData] = useState({
    notes: '',
    medicines: [],
    nextVisit: 'No follow-up needed'
  });
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);
  const { t } = useLanguage();
  const { queue: patientQueueRaw, attendedPatients: attendedPatientsRaw, digitalRecords, loading } = useSelector((state) => state.dashboard);
  const patientQueue = Array.isArray(patientQueueRaw) ? patientQueueRaw : [];
  const attendedPatients = Array.isArray(attendedPatientsRaw) ? attendedPatientsRaw : [];

  // ✅ Get the shared socket instance
  const socket = getSocket();

  useEffect(() => {
    dispatch(fetchDoctorQueue());
    dispatch(fetchAttendedPatients());
    dispatch(fetchDigitalRecords());
  }, [dispatch]);

  // Clear selected record when switching panels
  useEffect(() => {
    if (activePanel !== 'records') {
      setSelectedRecordPatient(null);
    }
  }, [activePanel]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportMenu && !event.target.closest('.export-menu-container')) {
        setShowExportMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Close modal on Escape key press
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && selectedRecordPatient) {
        setSelectedRecordPatient(null);
      }
    };

    if (selectedRecordPatient) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scrolling when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [selectedRecordPatient]);

  // Re-fetch attended patients whenever doctor opens the "attended" panel
  useEffect(() => {
    if (activePanel === "attended") {
      dispatch(fetchAttendedPatients());
    }
  }, [activePanel, dispatch]);

  const handleStartCall = async (patientId, appointmentId) => {
    console.log('Initializing call with patient:', patientId);

    if (!patientId || !appointmentId) {
      console.error('❌ Start call aborted: missing identifiers', { patientId, appointmentId });
      return;
    }

    const doctorId = currentUser?.id || currentUser?._id;
    const doctorQuery = doctorId ? `&doctorId=${doctorId}` : '';
    navigate(`/call/${appointmentId}?patientId=${patientId}${doctorQuery}`);

    console.log('📞 Start call - IDs check:', {
      patientId,
      appointmentId,
      doctorId,
      hasPatientId: !!patientId,
      hasAppointmentId: !!appointmentId
    });

    socket.emit('webrtc:start-call', {
      patientId,
      fromUserName: currentUser?.name || 'Doctor',
      appointmentId,
    });

    try {
      const res = await api.apiFetch('/api/appointments/start-call', {
        method: 'POST',
        body: { patientId, appointmentId },
      });

      if (!res.ok) {
        console.warn('Start-call API returned non-ok status:', res.status);
        console.error('API error response:', res.data);
      } else {
        console.log('✅ Start-call API successful');
      }
    } catch (error) {
      console.error('Failed to signal start of call:', error);
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

  // Prescription handling functions
  const handleGivePrescription = (patient) => {
    setCurrentPrescriptionPatient(patient);
    setShowPrescription(true);
    setPrescriptionData({
      notes: '',
      medicines: [],
      nextVisit: 'No follow-up needed'
    });
  };

  // Document viewing handler
  const handleViewDocuments = (patient) => {
    setCurrentDocumentsPatient(patient);
    setShowDocuments(true);
  };

  const handleAddMedicine = () => {
    setPrescriptionData(prev => ({
      ...prev,
      medicines: [...prev.medicines, { name: '', dosage: '', frequency: '', duration: '' }]
    }));
  };

  const handleMedicineChange = (index, field, value) => {
    setPrescriptionData(prev => ({
      ...prev,
      medicines: prev.medicines.map((med, i) => 
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  const handleRemoveMedicine = (index) => {
    setPrescriptionData(prev => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index)
    }));
  };

  // Function to generate individual prescription TXT file
  const generateIndividualPrescriptionTxt = (prescriptionData, patientData, visitData) => {
    const patientName = patientData.name || 'Unknown';
    const patientId = patientData.uniqueId || patientData.patientId || patientData._id || 'N/A';
    const visitDate = visitData.date || new Date().toISOString();
    const doctor = currentUser?.name || 'N/A';

    const lines = [
      '═══════════════════════════════════════════════════',
      '           INDIVIDUAL PRESCRIPTION RECORD',
      '═══════════════════════════════════════════════════',
      '',
      '📋 PATIENT INFORMATION',
      '─────────────────────────────────────────────────',
      `Patient Name    : ${patientName}`,
      `Patient ID      : ${patientId}`,
      `Visit Date      : ${new Date(visitDate).toLocaleDateString()} ${new Date(visitDate).toLocaleTimeString()}`,
      `Attending Doctor: ${doctor}`,
      '',
      '💊 PRESCRIBED MEDICATIONS',
      '═════════════════════════════════════════════════',
    ];

    if (prescriptionData.medicines.length === 0) {
      lines.push('No medications prescribed for this visit.');
    } else {
      prescriptionData.medicines.forEach((medicine, i) => {
        lines.push(`${i + 1}. MEDICATION ${i + 1}`);
        lines.push('   ──────────────────────────────────');
        lines.push(`   Medicine Name : ${medicine.name || 'N/A'}`);
        lines.push(`   Dosage        : ${medicine.dosage || 'N/A'}`);
        lines.push(`   Frequency     : ${medicine.frequency || 'N/A'}`);
        lines.push(`   Duration      : ${medicine.duration || 'N/A'}`);
        lines.push('');
      });
    }

    if (prescriptionData.notes) {
      lines.push('📝 ADDITIONAL NOTES');
      lines.push('─────────────────────────────────────────────────');
      lines.push(prescriptionData.notes);
      lines.push('');
    }

    if (prescriptionData.nextVisit) {
      lines.push('📅 FOLLOW-UP VISIT');
      lines.push('─────────────────────────────────────────────────');
      lines.push(`Next Visit: ${prescriptionData.nextVisit}`);
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════');
    lines.push(`Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
    lines.push('Generated by: Medi-mitra Telemedicine Platform');
    lines.push('═══════════════════════════════════════════════════');

    return lines.join('\n');
  };

  // Function to save individual prescription TXT file
  const saveIndividualPrescriptionTxt = (prescriptionData, patientData, visitData) => {
    const txtContent = generateIndividualPrescriptionTxt(prescriptionData, patientData, visitData);
    const patientName = patientData.name || 'Unknown';
    const visitDate = visitData.date || new Date().toISOString();
    
    const blob = new Blob([txtContent], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patientName.replace(/\s+/g, '_')}_Prescription_${new Date(visitDate).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSavePrescription = async () => {
    try {
      console.log('Saving prescription with data:', {
        appointmentId: currentPrescriptionPatient.appointmentId,
        patientId: currentPrescriptionPatient.patientId,
        doctorId: currentUser?.id || currentUser?._id,
        notes: prescriptionData.notes,
        medicines: prescriptionData.medicines,
        nextVisit: prescriptionData.nextVisit
      });

      const response = await api.apiFetch('/api/prescriptions/create', {
        method: 'POST',
        body: {
          appointmentId: currentPrescriptionPatient.appointmentId,
          patientId: currentPrescriptionPatient.patientId,
          doctorId: currentUser?.id || currentUser?._id,
          notes: prescriptionData.notes,
          medicines: prescriptionData.medicines,
          nextVisit: prescriptionData.nextVisit
        }
      });

      if (response.ok) {
        console.log('Prescription saved successfully:', response.data);
        
        // ✅ AUTO-GENERATE INDIVIDUAL PRESCRIPTION TXT FILE
        saveIndividualPrescriptionTxt(
          prescriptionData,
          {
            name: currentPrescriptionPatient.name,
            patientId: currentPrescriptionPatient.patientId
          },
          {
            date: new Date().toISOString()
          }
        );
        
        alert('Prescription saved successfully! Individual prescription file has been downloaded.');
        
        // Refresh the attended patients data and digital records to show updated prescriptions
        dispatch(fetchAttendedPatients());
        dispatch(fetchDigitalRecords());
        
        // Close the prescription modal and reset form
        setShowPrescription(false);
        setCurrentPrescriptionPatient(null);
        setPrescriptionData({
          notes: '',
          medicines: [],
          nextVisit: 'No follow-up needed'
        });
      } else {
        throw new Error(response.data.message || 'Failed to save prescription');
      }
    } catch (error) {
      console.error('Error saving prescription:', error);
      alert('Error saving prescription: ' + (error.message || 'Please try again.'));
    }
  };

  // Function to download complete patient history (all-time record)
  // Load complete patient history for viewing in modal
  const loadPatientCompleteHistory = async (patientId, patientName) => {
    try {
      console.log('Loading complete history for modal:', patientId);
      
      const response = await api.apiFetch(`/api/patient/${patientId}/complete-history`, {
        method: 'GET'
      });

      if (!response.ok) {
        console.error('API Error:', response);
        throw new Error(`Failed to fetch patient complete history: ${response.status}`);
      }

      const responseData = response.data;
      const historyData = responseData?.data || responseData;
      
      if (!historyData) {
        throw new Error('No history data received from server');
      }

      // Store the complete history for modal display
      setPatientCompleteHistory({
        patient: historyData.patient,
        visits: historyData.visits || [],
        totalVisits: historyData.totalVisits || 0,
        totalPrescriptions: historyData.totalPrescriptions || 0,
        firstVisit: historyData.firstVisit,
        latestVisit: historyData.latestVisit,
        allPrescriptions: historyData.allPrescriptions || []
      });

      // Open the modal
      setSelectedRecordPatient({ showCompleteHistory: true, patientName });
      
    } catch (error) {
      console.error('Error loading patient complete history:', error);
      alert('Error loading patient history: ' + (error.message || 'Please try again.'));
    }
  };

  const downloadCompletePatientHistory = async (patientId, patientName) => {
    try {
      console.log('Downloading complete history for patient:', patientId);
      
      const response = await api.apiFetch(`/api/patient/${patientId}/complete-history`, {
        method: 'GET'
      });

      console.log('=== FRONTEND DEBUG ===');
      console.log('API Response Status:', response.status);
      console.log('API Response OK:', response.ok);
      console.log('Raw API Response:', response);
      console.log('Response Data:', response.data);

      if (!response.ok) {
        console.error('API Error:', response);
        console.error('Error Response Data:', response.data);
        throw new Error(`Failed to fetch patient complete history: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const responseData = response.data;
      console.log('History Data Structure:', responseData);
      console.log('History Data Type:', typeof responseData);
      console.log('Is Success:', responseData?.success);
      console.log('Actual Data:', responseData?.data);
      
      // Fix: The backend returns { success: true, data: actualData }
      // So we need to access response.data.data, not just response.data
      const historyData = responseData?.data || responseData;
      
      console.log('Processed History Data:', historyData);
      
      // Add safety checks for undefined data
      if (!historyData) {
        throw new Error('No history data received from server');
      }
      
      // Ensure visits array exists and get patient data
      const patientVisits = historyData.visits || [];
      const patient = historyData.patient;
      const totalVisits = historyData.totalVisits || 0;
      const totalPrescriptions = historyData.totalPrescriptions || 0;
      
      console.log('Final processed data:', {
        patientVisits: patientVisits.length,
        patient: patient?.name,
        totalVisits,
        totalPrescriptions
      });
      
      // Format dates properly
      const firstVisitFormatted = historyData.firstVisit ? 
        new Date(historyData.firstVisit).toLocaleDateString() : 'N/A';
      const latestVisitFormatted = historyData.latestVisit ? 
        new Date(historyData.latestVisit).toLocaleDateString() : 'N/A';
      
      const lines = [
        '═══════════════════════════════════════════════════',
        '        COMPLETE PATIENT MEDICAL HISTORY',
        '═══════════════════════════════════════════════════',
        '',
        '👤 PATIENT INFORMATION',
        '─────────────────────────────────────────────────',
        `Patient Name     : ${patient?.name || patientName || 'Unknown'}`,
        `Patient ID       : ${patient?.uniqueId || 'N/A'}`,
        `Email Address    : ${patient?.email || 'Not provided'}`,
        `Phone Number     : ${patient?.phone || 'Not provided'}`,
        `Age              : ${patient?.age || 'Not specified'}`,
        `Gender           : ${patient?.gender || 'Not specified'}`,
        `Blood Group      : ${patient?.bloodGroup || 'Not specified'}`,
        `Total Visits     : ${totalVisits}`,
        `Total Prescriptions : ${totalPrescriptions}`,
        '',
        '📊 MEDICAL SUMMARY',
        '─────────────────────────────────────────────────',
        `First Visit      : ${firstVisitFormatted}`,
        `Latest Visit     : ${latestVisitFormatted}`,
        `Report Generated : ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        '',
        '═══════════════════════════════════════════════════',
        '                 COMPLETE VISIT HISTORY',
        '═══════════════════════════════════════════════════',
      ];

      // Add each visit with its prescriptions - with enhanced formatting
      if (patientVisits.length === 0) {
        lines.push('');
        lines.push('📋 No completed visit records found for this patient.');
        lines.push('');
        // Still show prescription history if available
        if (historyData.allPrescriptions && historyData.allPrescriptions.length > 0) {
          lines.push('💊 PRESCRIPTION HISTORY (Independent Records):');
          lines.push('═════════════════════════════════════════════════');
          
          historyData.allPrescriptions.forEach((prescription, index) => {
            lines.push('');
            lines.push(`📋 PRESCRIPTION ${index + 1} - ${new Date(prescription.createdAt).toLocaleDateString()}`);
            lines.push('─────────────────────────────────────────────────');
            lines.push(`Prescribed Date  : ${new Date(prescription.createdAt).toLocaleDateString()} ${new Date(prescription.createdAt).toLocaleTimeString()}`);
            lines.push(`Prescribing Doctor: ${prescription.doctor?.name || 'N/A'}`);
            lines.push('');
            
            if (prescription.medicines && prescription.medicines.length > 0) {
              lines.push('💊 PRESCRIBED MEDICATIONS:');
              prescription.medicines.forEach((medicine, medIndex) => {
                lines.push(`   ${medIndex + 1}. Medicine: ${medicine.name || 'N/A'}`);
                lines.push(`      Dosage   : ${medicine.dosage || 'N/A'}`);
                lines.push(`      Frequency: ${medicine.frequency || 'N/A'}`);
                lines.push(`      Duration : ${medicine.duration || 'N/A'}`);
                lines.push('');
              });
            }
            
            if (prescription.notes) {
              lines.push('📝 PRESCRIPTION NOTES:');
              lines.push(`${prescription.notes}`);
              lines.push('');
            }
            
            if (prescription.nextVisit) {
              lines.push(`📅 Next Visit: ${prescription.nextVisit}`);
              lines.push('');
            }
            
            lines.push('─────────────────────────────────────────────────');
          });
        }
      } else {
        patientVisits.forEach((visit, index) => {
          lines.push('');
          lines.push(`🏥 VISIT ${patientVisits.length - index} - ${new Date(visit.visitDate).toLocaleDateString()}`);
          lines.push('═════════════════════════════════════════════════');
          lines.push(`Visit Date       : ${new Date(visit.visitDate).toLocaleDateString()} ${new Date(visit.visitDate).toLocaleTimeString()}`);
          lines.push(`Attending Doctor : ${visit.doctor?.name || 'N/A'}`);
          lines.push(`Visit Status     : ${visit.status?.toUpperCase() || 'N/A'}`);
          lines.push('');
          
          // Enhanced complaints and symptoms display
          const symptoms = Array.isArray(visit.symptoms) ? visit.symptoms.join(', ') : 
                          (visit.symptoms || '');
          const complaints = visit.complaints || '';
          const reason = visit.reason || '';
          
          lines.push('🔍 CHIEF COMPLAINTS & SYMPTOMS:');
          if (symptoms) {
            lines.push(`Symptoms     : ${symptoms}`);
          }
          if (complaints) {
            lines.push(`Complaints   : ${complaints}`);
          }
          if (reason) {
            lines.push(`Reason       : ${reason}`);
          }
          if (!symptoms && !complaints && !reason) {
            lines.push('No specific complaints recorded');
          }
          lines.push('');
          
          // Prescriptions for this visit with enhanced formatting
          if (visit.prescription && visit.prescription.medicines && visit.prescription.medicines.length > 0) {
            lines.push('💊 PRESCRIBED MEDICATIONS:');
            lines.push('─────────────────────────────────────────────────');
            
            visit.prescription.medicines.forEach((medicine, medIndex) => {
              lines.push(`${medIndex + 1}. Medicine: ${medicine.name || 'N/A'}`);
              lines.push(`   Dosage    : ${medicine.dosage || 'N/A'}`);
              lines.push(`   Frequency : ${medicine.frequency || 'N/A'}`);
              lines.push(`   Duration  : ${medicine.duration || 'N/A'}`);
              lines.push('');
            });
            
            if (visit.prescription.notes) {
              lines.push('📝 DOCTOR\'S NOTES & RECOMMENDATIONS:');
              lines.push(`${visit.prescription.notes}`);
              lines.push('');
            }
            
            if (visit.prescription.nextVisit) {
              lines.push(`📅 Next Visit Recommended: ${visit.prescription.nextVisit}`);
              lines.push('');
            }
          } else {
            lines.push('💊 No prescriptions recorded for this visit.');
            lines.push('');
          }
          
          lines.push('─────────────────────────────────────────────────');
        });
      }

      // Add medication summary section
      lines.push('');
      lines.push('═══════════════════════════════════════════════════');
      lines.push('                 MEDICATION SUMMARY');
      lines.push('═══════════════════════════════════════════════════');
      
      // Collect all unique medications across all visits
      const allMedications = new Map();
      
      // From visits
      patientVisits.forEach(visit => {
        if (visit.prescription && visit.prescription.medicines) {
          visit.prescription.medicines.forEach(medicine => {
            const key = medicine.name?.toLowerCase() || 'unknown';
            if (!allMedications.has(key)) {
              allMedications.set(key, {
                name: medicine.name || 'Unknown',
                prescriptionCount: 1,
                lastPrescribed: visit.visitDate,
                dosages: [medicine.dosage || 'N/A']
              });
            } else {
              const existing = allMedications.get(key);
              existing.prescriptionCount++;
              if (!existing.dosages.includes(medicine.dosage)) {
                existing.dosages.push(medicine.dosage || 'N/A');
              }
            }
          });
        }
      });
      
      // From standalone prescriptions
      if (historyData.allPrescriptions) {
        historyData.allPrescriptions.forEach(prescription => {
          if (prescription.medicines) {
            prescription.medicines.forEach(medicine => {
              const key = medicine.name?.toLowerCase() || 'unknown';
              if (!allMedications.has(key)) {
                allMedications.set(key, {
                  name: medicine.name || 'Unknown',
                  prescriptionCount: 1,
                  lastPrescribed: prescription.createdAt,
                  dosages: [medicine.dosage || 'N/A']
                });
              } else {
                const existing = allMedications.get(key);
                existing.prescriptionCount++;
                if (!existing.dosages.includes(medicine.dosage)) {
                  existing.dosages.push(medicine.dosage || 'N/A');
                }
              }
            });
          }
        });
      }

      if (allMedications.size > 0) {
        lines.push('📊 All medications prescribed to this patient:');
        lines.push('─────────────────────────────────────────────────');
        
        const sortedMeds = Array.from(allMedications.values())
          .sort((a, b) => b.prescriptionCount - a.prescriptionCount);
        
        sortedMeds.forEach((med, index) => {
          lines.push(`${index + 1}. ${med.name}`);
          lines.push(`   Prescribed: ${med.prescriptionCount} time(s)`);
          lines.push(`   Dosages: ${med.dosages.join(', ')}`);
          lines.push(`   Last Prescribed: ${new Date(med.lastPrescribed).toLocaleDateString()}`);
          lines.push('');
        });
      } else {
        lines.push('No medications have been prescribed to this patient.');
        lines.push('');
      }

      lines.push('');
      lines.push('═══════════════════════════════════════════════════');
      lines.push('This complete medical history was generated by');
      lines.push('Medi-mitra Telemedicine Platform');
      lines.push('');
      lines.push('⚠️  CONFIDENTIAL MEDICAL INFORMATION');
      lines.push('This comprehensive report contains all medical');
      lines.push('records and should be handled with utmost care.');
      lines.push('═══════════════════════════════════════════════════');

      // Download the complete history file
      const blob = new Blob([lines.join('\n')], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(patient?.name || patientName || 'Patient').replace(/\s+/g, '_')}_Complete_Medical_History_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Complete patient history downloaded successfully');
      
    } catch (error) {
      console.error('Error downloading complete patient history:', error);
      alert('Error downloading patient history: ' + (error.message || 'Please try again.'));
    }
  };

  // Function to toggle export menu for a specific patient visit
  const toggleExportMenu = (uniqueKey) => {
    setShowExportMenu(showExportMenu === uniqueKey ? null : uniqueKey);
  };

  // attendedPatients now comes from Redux state (fetched from backend)

  const handleDownloadPrescription = (patient) => {
    const prescriptionsSafe = Array.isArray(patient.prescriptions) ? patient.prescriptions : [];
    const patientName = patient.name || patient.patient?.name || 'Unknown';
    const patientId = patient.patient?.uniqueId || patient.uniqueId || patient.id || patient.patient?.id || patient.patient?._id || 'N/A';
    const patientEmail = patient.patient?.email || patient.email || 'N/A';
    const patientPhone = patient.patient?.phone || patient.phone || 'N/A';
    const visitDate = patient.attendedAt || patient.date || patient.visitDate || 'N/A';
    const doctor = patient.doctor || currentUser?.name || 'N/A';
    const complaints = patient.complaints || patient.symptoms?.join(', ') || patient.reason || 'N/A';
    const status = patient.status || 'N/A';

    const lines = [
      '════════════════════════════',
      'MEDICAL PRESCRIPTION REPORT',
      '════════════════════════════',
      '',
      '📋 PATIENT INFORMATION',
      '════════════════════════════',
      `Patient Name    : ${patientName}`,
      `Patient ID      : ${patientId}`,
      `Email Address   : ${patientEmail}`,
      `Phone Number    : ${patientPhone}`,
      '',
      '🏥 VISIT INFORMATION',
      '════════════════════════════',
      `Visit Date      : ${new Date(visitDate).toLocaleDateString()} ${new Date(visitDate).toLocaleTimeString()}`,
      `Attending Doctor: ${doctor}`,
      `Visit Status    : ${status.toUpperCase()}`,
      '',
      ' COMPLAINTS & SYMPTOMS',
      '════════════════════════════',
      `${complaints}`,
      '',
      ' PRESCRIBED MEDICATIONS',
      '════════════════════════════',
    ];

    // Get medicines from prescriptions array - each prescription has a medicines array
    const allMedicines = [];
    const prescriptionNotes = [];
    
    prescriptionsSafe.forEach(prescription => {
      if (prescription.medicines && Array.isArray(prescription.medicines)) {
        allMedicines.push(...prescription.medicines);
      }
      if (prescription.notes) {
        prescriptionNotes.push(prescription.notes);
      }
    });

    if (allMedicines.length === 0) {
      lines.push('No prescriptions recorded for this visit.');
    } else {
      allMedicines.forEach((medicine, i) => {
        lines.push(`${i + 1}. MEDICATION ${i + 1}`);
        lines.push('════════════════════════════');
        lines.push(`   Medicine Name : ${medicine.name || 'N/A'}`);
        lines.push(`   Dosage        : ${medicine.dosage || 'N/A'}`);
        lines.push(`   Frequency     : ${medicine.frequency || 'N/A'}`);
        lines.push(`   Duration      : ${medicine.duration || 'N/A'}`);
        lines.push('');
      });
      
      // Add prescription notes if any
      if (prescriptionNotes.length > 0) {
        lines.push(' ADDITIONAL NOTES');
        lines.push('════════════════════════════');
        prescriptionNotes.forEach((note, i) => {
          lines.push(`${i + 1}. ${note}`);
        });
        lines.push('');
      }
    }

    // Add next visit information if available
    const nextVisit = patient.nextVisit || prescriptionsSafe[0]?.nextVisit;
    if (nextVisit) {
      lines.push('FOLLOW-UP VISIT');
      lines.push('════════════════════════════');
      lines.push(`Next Visit: ${nextVisit}`);
      lines.push('');
    }
              //────────────────────────────
    lines.push('════════════════════════════');
    lines.push(`Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
    lines.push('Generated by: Medi-mitra Telemedicine Platform');
    lines.push('════════════════════════════');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patientName.replace(/\s+/g, '_')}_Prescription_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parsePossibleDate = (p) => {
    return p?.attendedAt || p?.date || p?.completedAt || p?.createdAt || p?.appointmentDate || null;
  };

  const isSameDay = (dStr) => {
    if (!dStr) return false;
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate();
  };

  const totalAttended = attendedPatients.length;
  const attendedToday = attendedPatients.filter(p => isSameDay(parsePossibleDate(p))).length;

  const upcomingPreview = patientQueue.slice(0, 6).map((a) => {
    const appointmentId = a?.appointmentId || a?._id || null;
    const patientId = a?.patientId || a?.patient?._id || null;

    return {
      name: a.patient?.name || a.name || 'Unknown',
      appointmentId,
      patientId,
      time: a.slot || a.time || a.date || ''
    };
  });

  const renderPanel = () => {
    switch (activePanel) {
      case "dashboard":
        return (
          <div className="simple-card" style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: '1 1 420px' }}>
                <div style={{ marginRight: 12 }}>
                  <Avatar user={currentUser} size={84} />
                </div>
                <div style={{ minWidth: 200 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 20 }}>{currentUser?.name || 'Doctor'}</h3>
                  <p style={{ margin: '4px 0', color: '#00ffd0', fontWeight: 600 }}>{currentUser?.specialization || 'General'}</p>
                  <div style={{ marginTop: 6, color: '#cfeee6' }}>
                    <div><strong style={{ color: '#fff' }}>Contact:</strong> {currentUser?.phone || currentUser?.contact || 'N/A'}</div>
                    <div><strong style={{ color: '#fff' }}>Email:</strong> {currentUser?.email || 'N/A'}</div>
                    <div><strong style={{ color: '#fff' }}>Experience:</strong> {currentUser?.experience || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
                <div style={{ background: '#071e24', border: '1px solid #00ffd0', padding: 12, borderRadius: 8, minWidth: 140 }}>
                  <div style={{ color: '#00ffd0', fontSize: 12 }}>Total Attended</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{totalAttended}</div>
                </div>
                <div style={{ background: '#071e24', border: '1px solid #00ffd0', padding: 12, borderRadius: 8, minWidth: 140 }}>
                  <div style={{ color: '#00ffd0', fontSize: 12 }}>Attended Today</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{attendedToday}</div>
                </div>
                <div style={{ background: '#071e24', border: '1px solid #00ffd0', padding: 12, borderRadius: 8, minWidth: 140 }}>
                  <div style={{ color: '#00ffd0', fontSize: 12 }}>Waiting</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{patientQueue.length}</div>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(0,255,208,0.08)', margin: '14px 0' }} />

            <div style={{ display: 'flex', gap: 18, alignItems: 'stretch', flexWrap: 'wrap', flex: 1, minHeight: 0 }}>
              <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ marginTop: 0, marginBottom: 16 }}>Upcoming Patients</h4>
                {upcomingPreview.length === 0 ? (
                  <p>No upcoming patients.</p>
                ) : (
                  <div style={{ flex: 1 }}>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {upcomingPreview.map((p, i) => (
                        <li key={p.appointmentId || i} style={{ marginBottom: 16, color: '#fff' }}>
                          <strong>{p.name}</strong>
                          {p.time ? <span style={{ color: '#00ffd0', marginLeft: 8 }}>{p.time}</span> : null}
                          <div style={{ marginTop: 8 }}>
                            <button className="btn btn-primary" style={{ marginRight: 8 }} onClick={() => handleStartCall(p.patientId, p.appointmentId)}>Start Call</button>
                            <button className="btn btn-secondary" onClick={() => handleMarkComplete(p.appointmentId)}>Mark Done</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ width: 320, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h4 style={{ marginTop: 0, marginBottom: 16 }}>Recent Attended</h4>
                {attendedPatients.length === 0 ? (
                  <p>No patients attended yet.</p>
                ) : (
                  <div className="elegant-scroll-area" style={{ 
                    flex: 1, 
                    minHeight: 0
                  }}>
                    {attendedPatients.slice(0, 20).map((p, idx) => (
                      <div key={p._id || p.id || idx} style={{ padding: 12, borderBottom: '1px dashed rgba(255,255,255,0.03)', marginBottom: 8 }}>
                        <div style={{ color: '#00ffd0', fontWeight: 600 }}>{p.patient?.name || p.name || 'Unknown'}</div>
                        <div style={{ color: '#cfeee6', fontSize: 13 }}>
                          {parsePossibleDate(p) ? new Date(parsePossibleDate(p)).toLocaleString() : '—'}
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
            </div>
          </div>
        );
      case "queue":
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: 20 }}>Patient Queue</h3>
            {loading ? <p>Loading queue...</p> : 
              <div style={{ flex: 1 }}>
                <QueueList 
                  items={patientQueue.map(a => ({
                    name: a.patient?.name || 'Unknown',
                    appointmentId: a.appointmentId || a._id,
                    patientId: a.patientId || a.patient?._id,
                    symptoms: a.symptoms || a.reason || a.complaints || 'No symptoms specified',
                    appointmentTime: a.slot || a.time || a.appointmentTime,
                    reason: a.reason || a.purpose,
                    description: a.description || '',
                    documents: a.documents || []
                  }))} 
                  onStartCall={handleStartCall} 
                  onMarkComplete={handleMarkComplete}
                  onGivePrescription={handleGivePrescription}
                  onViewDocuments={handleViewDocuments}
                  currentUser={currentUser}
                />
              </div>
            }
          </div>
        );
      case "attended":
        {
          const list = Array.isArray(attendedPatients) ? attendedPatients : [];
          return (
            <div className="simple-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: 20 }}>Attended Patients</h3>
              {list.length === 0 ? (
                <p>No patients attended yet.</p>
              ) : (
                <div className="table-scroll-container" style={{ 
                  flex: 1, 
                  maxHeight: 'calc(100vh - 200px)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#0a233a', color: '#00ffd0', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ border: '1px solid #00ffd0', padding: '12px' }}>Patient ID</th>
                        <th style={{ border: '1px solid #00ffd0', padding: '12px' }}>Name</th>
                        <th style={{ border: '1px solid #00ffd0', padding: '12px' }}>Prescriptions</th>
                        <th style={{ border: '1px solid #00ffd0', padding: '12px' }}>Download</th>
                      </tr>
                    </thead>
                    <tbody>
                    {list.map((p, idx) => {
                      const key = p._id || p.id || (p.patient && (p.patient._id || p.patient.id)) || idx;
                      const prescriptionsSafe = Array.isArray(p.prescriptions) ? p.prescriptions : (Array.isArray(p.patient?.prescriptions) ? p.patient.prescriptions : []);
                      const patientIdDisplay = p.patient?.uniqueId || p.uniqueId || p.id || p.patient?.id || p.patient?._id || '—';
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
                </div>
              )}
            </div>
          );
        }
      default:
        return <div className="simple-card"><h3>{activePanel}</h3></div>;
    }
  };

  // Records panel: timeline view, filters, and exports
  const renderRecordsPanel = () => {
    // Use attendedPatients as primary source since it has the complete data (5 entries vs 2 in digitalRecords)
    const list = Array.isArray(attendedPatients) && attendedPatients.length > 0 
      ? attendedPatients 
      : Array.isArray(digitalRecords) ? digitalRecords : [];

    console.log('=== DIGITAL RECORDS DEBUG ===');
    console.log('digitalRecords:', digitalRecords);
    console.log('attendedPatients:', attendedPatients);
    console.log('list:', list);
    console.log('list.length:', list.length);

    // Build flattened visits array - Updated for attendedPatients structure
    const visits = [];
    list.forEach((p) => {
      // Handle attendedPatients structure from sanitized API
      const patientObj = p.patient || p;
      const patientUniqueId = patientObj?.uniqueId; // This should be the P... ID
      const patientName = patientObj?.name || p.name || 'Unknown';
      const mongoId = patientObj?._id || patientObj?.id || p.id || p._id; // Keep MongoDB ID for API calls
      
      console.log('Processing patient:', { patientUniqueId, patientName, mongoId, patientObj });
      
      // Check for visits array in the structure
      const vlist = Array.isArray(p.visits) ? p.visits : (p.history || p.record?.visits || []);
      if (vlist && vlist.length > 0) {
        vlist.forEach(v => visits.push({ 
          patientId: mongoId, // Keep for backward compatibility 
          patientUniqueId, 
          patientName, 
          visit: v, 
          source: p
        }));
      } else {
        // Treat p as a visit object if it contains timestamp fields
        const maybeDate = p.attendedAt || p.date || p.createdAt || p.visitedAt;
        if (maybeDate) {
          visits.push({ 
            patientId: mongoId, // Keep for backward compatibility
            patientUniqueId, 
            patientName, 
            visit: p, 
            source: p
          });
        }
      }
    });

    // Add sample data if no real data exists (for demonstration)
    if (visits.length === 0 && list.length > 0) {
      list.forEach((p, index) => {
        const patientObj = p.patient || p;
        const patientId = patientObj?.uniqueId || p.uniqueId || patientObj?.id || patientObj?._id || p.id || p._id || `PATIENT_${index + 1}`;
        const patientName = patientObj?.name || p.name || `Patient ${index + 1}`;
        
        // Create a visit entry from the patient data
        visits.push({ 
          patientId, 
          patientName, 
          visit: {
            date: p.attendedAt || p.date || p.createdAt || '2025-09-28T00:00:00.000Z',
            complaints: p.symptoms || p.reason || p.complaints || 'General checkup',
            prescriptions: p.prescriptions || [],
            doctor: 'Dr. ' + (currentUser?.name || 'Doctor'),
            status: p.status || 'completed'
          }, 
          source: p 
        });
      });
    }

    // If still no visits, create demo data to show table structure
    if (visits.length === 0) {
      visits.push({
        patientId: "68d82787bcff53b5f22982df",
        patientName: "heer",
        visit: {
          date: "2025-09-28T07:50:00.000Z",
          complaints: "ertyuio",
          prescriptions: [
            { medicine: "Paracetamol", dosage: "500mg", frequency: "2 times daily" }
          ],
          doctor: "Dr. " + (currentUser?.name || "Doctor"),
          status: "completed"
        },
        source: { 
          patient: { name: "heer", id: "68d82787bcff53b5f22982df" },
          symptoms: "ertyuio",
          date: "2025-09-28T07:50:00.000Z"
        }
      });
    }

    // Group patients and show only latest visit per patient
    const groupedPatients = (() => {
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      // First apply time filter if needed
      let filtered = visits.slice();
      if (recordsFilter.period === 'lastMonth') {
        filtered = filtered.filter(x => {
          const d = new Date(x.visit.date || x.visit.attendedAt || x.visit.createdAt || x.visit.visitedAt);
          return !isNaN(d.getTime()) && d >= oneMonthAgo;
        });
      }
      
      // Group by patient unique ID
      const patientMap = new Map();
      
      filtered.forEach(visit => {
        const patientUniqueId = visit.patientUniqueId || visit.source?.patient?.uniqueId;
        const patientName = visit.patientName || visit.source?.patient?.name || visit.source?.name;
        const visitDate = new Date(visit.visit.date || visit.visit.attendedAt || visit.visit.createdAt || visit.visit.visitedAt);
        const mongoPatientId = visit.patientId; // Keep MongoDB ID for API compatibility
        
        console.log('Processing visit for grouping:', { 
          patientUniqueId, 
          patientName, 
          mongoPatientId, 
          visitDate 
        });
        
        if (!patientName) {
          console.log('Skipping visit - missing patient name');
          return;
        }
        
        // Use uniqueId for display, fallback to name-based ID if uniqueId missing
        const displayId = patientUniqueId || `PT-${patientName?.replace(/\s+/g, '')?.toUpperCase()?.slice(0, 6)}` || 'UNKNOWN';
        
        const key = displayId;
        
        if (!patientMap.has(key) || visitDate > new Date(patientMap.get(key).lastVisitDate)) {
          patientMap.set(key, {
            patientUniqueId: displayId,
            patientName,
            lastVisitDate: visitDate,
            lastComplaint: visit.visit.complaints || visit.visit.reason || 
                          (Array.isArray(visit.visit.symptoms) ? visit.visit.symptoms.join(', ') : visit.visit.symptoms) || 'No complaints recorded',
            totalVisits: 0, // Will be calculated
            latestVisit: visit,
            originalPatientId: mongoPatientId // Keep MongoDB ID for API calls
          });
        }
      });
      
      // Calculate total visits for each patient
      patientMap.forEach((patient, displayId) => {
        const patientVisits = visits.filter(v => {
          const vUniqueId = v.patientUniqueId || v.source?.patient?.uniqueId;
          const vFallbackId = vUniqueId || `PT-${v.patientName?.replace(/\s+/g, '')?.toUpperCase()?.slice(0, 6)}` || 'UNKNOWN';
          return vFallbackId === displayId;
        });
        patient.totalVisits = patientVisits.length;
        
        console.log(`Patient ${patient.patientName} (${displayId}): ${patientVisits.length} visits`);
      });
      
      // Convert to array and apply search filter
      let result = Array.from(patientMap.values());
      
      if (recordsFilter.search && recordsFilter.search.trim() !== '') {
        const q = recordsFilter.search.toLowerCase();
        result = result.filter(patient => 
          (patient.patientName || '').toLowerCase().includes(q) || 
          (patient.lastComplaint || '').toLowerCase().includes(q)
        );
      }
      
      // Sort by last visit date (newest first)
      result.sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate));
      
      return result;
    })();
    
    // Keep filtered for backward compatibility but use groupedPatients for rendering
    const filtered = groupedPatients;

    const exportPatientTimelineTxt = (patientId) => {
      const pVisits = visits.filter(v => v.patientId === patientId);
      const patientData = pVisits[0]?.source || selectedRecordPatient;
      const patientName = pVisits[0]?.patientName || patientData?.patient?.name || patientData?.name || 'Unknown';
      const patientEmail = patientData?.patient?.email || patientData?.email || 'N/A';
      const patientPhone = patientData?.patient?.phone || patientData?.phone || 'N/A';
      
      const lines = [];
      lines.push('═══════════════════════════════════════════════════');
      lines.push('           PATIENT MEDICAL TIMELINE');
      lines.push('═══════════════════════════════════════════════════');
      lines.push('');
      lines.push('👤 PATIENT INFORMATION');
      lines.push('─────────────────────────────────────────────────');
      lines.push(`Patient Name    : ${patientName}`);
      lines.push(`Patient ID      : ${patientId}`);
      lines.push(`Email Address   : ${patientEmail}`);
      lines.push(`Phone Number    : ${patientPhone}`);
      lines.push('');
      
      if (pVisits.length === 0) {
        lines.push('No visit records found for this patient.');
      } else {
        lines.push('📋 MEDICAL HISTORY & VISITS');
        lines.push('═════════════════════════════════════════════════');
        
        pVisits.forEach((pv, i) => {
          const v = pv.visit;
          const visitDate = v.date || v.attendedAt || v.createdAt || v.visitedAt || 'N/A';
          const doctors = v.doctors ? (Array.isArray(v.doctors) ? v.doctors.join(', ') : v.doctors) : (v.doctor?.name || v.doctor || 'N/A');
          const complaints = v.complaints || v.reason || (Array.isArray(v.symptoms) ? v.symptoms.join(', ') : v.symptoms) || 'No complaints recorded';
          const visitStatus = v.status || 'N/A';
          
          lines.push(`🏥 VISIT ${i + 1}`);
          lines.push('─────────────────────────────────────────────────');
          lines.push(`Visit Date      : ${new Date(visitDate).toLocaleDateString()} ${new Date(visitDate).toLocaleTimeString()}`);
          lines.push(`Attending Doctor: ${doctors}`);
          lines.push(`Visit Status    : ${visitStatus.toUpperCase()}`);
          lines.push('');
          lines.push('🔍 Complaints & Symptoms:');
          lines.push(`${complaints}`);
          lines.push('');
          
          // Handle prescriptions - extract medicines from prescriptions array
          let allMedicines = [];
          let prescriptionNotes = [];
          let nextVisit = null;
          
          // Get prescriptions from different sources
          let prescriptions = [];
          if (Array.isArray(v.prescriptions)) {
            prescriptions = v.prescriptions;
          } else if (pv.source?.prescriptions) {
            prescriptions = Array.isArray(pv.source.prescriptions) ? pv.source.prescriptions : [pv.source.prescriptions];
          }
          
          // Extract medicines from prescriptions
          prescriptions.forEach(prescription => {
            if (prescription.medicines && Array.isArray(prescription.medicines)) {
              allMedicines.push(...prescription.medicines);
            }
            if (prescription.notes) {
              prescriptionNotes.push(prescription.notes);
            }
            if (prescription.nextVisit && !nextVisit) {
              nextVisit = prescription.nextVisit;
            }
          });
          
          if (allMedicines.length > 0) {
            lines.push('💊 PRESCRIBED MEDICATIONS:');
            allMedicines.forEach((medicine, j) => {
              lines.push(`   ${j + 1}. Medicine: ${medicine.name || 'N/A'}`);
              lines.push(`      Dosage   : ${medicine.dosage || 'N/A'}`);
              lines.push(`      Frequency: ${medicine.frequency || 'N/A'}`);
              lines.push(`      Duration : ${medicine.duration || 'N/A'}`);
              lines.push('');
            });
            
            // Add prescription notes
            if (prescriptionNotes.length > 0) {
              lines.push('📝 PRESCRIPTION NOTES:');
              prescriptionNotes.forEach((note, k) => {
                lines.push(`   ${k + 1}. ${note}`);
              });
              lines.push('');
            }
            
            // Add next visit info if available
            if (nextVisit) {
              lines.push(`📅 Next Visit: ${nextVisit}`);
              lines.push('');
            }
          } else {
            lines.push('💊 No prescriptions recorded for this visit.');
            lines.push('');
          }
          
          lines.push('═════════════════════════════════════════════════');
          lines.push('');
        });
      }
      
      lines.push(`📊 SUMMARY: Total ${pVisits.length} visit(s) on record`);
      lines.push('');
      lines.push('═══════════════════════════════════════════════════');
      lines.push(`Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
      lines.push('Generated by: Medi-mitra Telemedicine Platform');
      lines.push('═══════════════════════════════════════════════════');
      
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${patientName.replace(/\s+/g, '_')}_Medical_Timeline_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // Enhanced export function for detailed patient record from the modal view
    const exportDetailedPatientRecord = (record) => {
      const patientName = record.patient?.name || record.name || 'Unknown';
      const patientId = record.patient?.uniqueId || record.uniqueId || record.patient?._id || record.patientId || 'N/A';
      const patientEmail = record.patient?.email || record.email || 'N/A';
      const patientPhone = record.patient?.phone || record.phone || 'N/A';
      const visitDate = record.visitDate || record.date || record.attendedAt || 'N/A';
      const doctor = record.doctor || currentUser?.name || 'N/A';
      const complaints = record.complaints || (Array.isArray(record.symptoms) ? record.symptoms.join(', ') : record.symptoms) || 'No complaints recorded';
      const status = record.status || 'N/A';
      const prescriptions = Array.isArray(record.prescriptions) ? record.prescriptions : [];
      const nextVisit = record.nextVisit || prescriptions[0]?.nextVisit || 'No follow-up needed';

      const lines = [
        '═══════════════════════════════════════════════════',
        '        COMPREHENSIVE PATIENT RECORD REPORT',
        '═══════════════════════════════════════════════════',
        '',
        '👤 PATIENT INFORMATION',
        '─────────────────────────────────────────────────',
        `Patient Name     : ${patientName}`,
        `Patient ID       : ${patientId}`,
        `Email Address    : ${patientEmail}`,
        `Phone Number     : ${patientPhone}`,
        '',
        '🏥 VISIT DETAILS',
        '─────────────────────────────────────────────────',
        `Visit Date       : ${new Date(visitDate).toLocaleDateString()} ${new Date(visitDate).toLocaleTimeString()}`,
        `Attending Doctor : ${doctor}`,
        `Visit Status     : ${status.toUpperCase()}`,
        `Record ID        : ${record._id || 'N/A'}`,
        '',
        '🔍 MEDICAL ASSESSMENT',
        '─────────────────────────────────────────────────',
        'Chief Complaints & Symptoms:',
        `${complaints}`,
        '',
        '💊 PRESCRIPTION DETAILS',
        '═════════════════════════════════════════════════',
      ];

      // Extract medicines from prescriptions array - each prescription has a medicines array
      const allMedicines = [];
      const prescriptionNotes = [];
      
      prescriptions.forEach(prescription => {
        if (prescription.medicines && Array.isArray(prescription.medicines)) {
          allMedicines.push(...prescription.medicines);
        }
        if (prescription.notes) {
          prescriptionNotes.push(prescription.notes);
        }
      });

      if (allMedicines.length === 0) {
        lines.push('No medications prescribed during this visit.');
      } else {
        lines.push(`Total Medications Prescribed: ${allMedicines.length}`);
        lines.push('');
        
        allMedicines.forEach((medicine, i) => {
          lines.push(`${i + 1}. MEDICATION ${i + 1}`);
          lines.push('   ╭──────────────────────────────────────╮');
          lines.push(`   │ Medicine Name : ${(medicine.name || 'N/A').padEnd(22)} │`);
          lines.push(`   │ Dosage        : ${(medicine.dosage || 'N/A').padEnd(22)} │`);
          lines.push(`   │ Frequency     : ${(medicine.frequency || 'N/A').padEnd(22)} │`);
          lines.push(`   │ Duration      : ${(medicine.duration || 'N/A').padEnd(22)} │`);
          lines.push('   ╰──────────────────────────────────────╯');
          lines.push('');
        });
        
        // Add prescription notes if any
        if (prescriptionNotes.length > 0) {
          lines.push('📝 PRESCRIPTION NOTES & INSTRUCTIONS');
          lines.push('─────────────────────────────────────────────────');
          prescriptionNotes.forEach((note, i) => {
            lines.push(`${i + 1}. ${note}`);
          });
          lines.push('');
        }
      }

      lines.push('📅 FOLLOW-UP INFORMATION');
      lines.push('─────────────────────────────────────────────────');
      lines.push(`Next Visit Recommendation: ${nextVisit}`);
      lines.push('');
      
      lines.push('📊 RECORD METADATA');
      lines.push('─────────────────────────────────────────────────');
      lines.push(`Record Created    : ${record.createdAt ? new Date(record.createdAt).toLocaleString() : 'N/A'}`);
      lines.push(`Last Updated      : ${record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'N/A'}`);
      lines.push(`Report Generated  : ${new Date().toLocaleString()}`);
      lines.push('');
      
      lines.push('═══════════════════════════════════════════════════');
      lines.push('This is a comprehensive medical record generated by');
      lines.push('Medi-mitra Telemedicine Platform');
      lines.push('');
      lines.push('⚠️  CONFIDENTIAL MEDICAL INFORMATION');
      lines.push('This report contains sensitive patient data and should');
      lines.push('be handled according to medical privacy regulations.');
      lines.push('═══════════════════════════════════════════════════');

      const blob = new Blob([lines.join('\n')], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${patientName.replace(/\s+/g, '_')}_Full_Medical_Record_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <div className="simple-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: 20 }}>Digital Records - Patient Overview</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={recordsFilter.period} onChange={(e) => setRecordsFilter(f => ({ ...f, period: e.target.value }))}>
            <option value="all">All time</option>
            <option value="lastMonth">Last month</option>
          </select>
          <input placeholder="Search patient name or complaint" style={{ flex: 1, minWidth: '200px' }} value={recordsFilter.search} onChange={(e) => setRecordsFilter(f => ({ ...f, search: e.target.value }))} />
          <button className="btn btn-secondary" onClick={() => { setRecordsFilter({ period: 'all', search: '' }); }}>Clear</button>
        </div>

        {filtered.length === 0 ? (
          <p>No visits match the current filter.</p>
        ) : (
          <div className="table-scroll-container" style={{ 
            flex: 1, 
            maxHeight: 'calc(100vh - 250px)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0a233a', color: '#00ffd0', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ border: '1px solid #00ffd0', padding: 12, minWidth: '120px' }}>Patient ID</th>
                  <th style={{ border: '1px solid #00ffd0', padding: 12, minWidth: '150px' }}>Name</th>
                  <th style={{ border: '1px solid #00ffd0', padding: 12, minWidth: '130px' }}>Last Visit</th>
                  <th style={{ border: '1px solid #00ffd0', padding: 12, minWidth: '250px' }}>Last Complaint</th>
                  <th style={{ border: '1px solid #00ffd0', padding: 12, minWidth: '100px' }}>Total Visits</th>
                  <th style={{ border: '1px solid #00ffd0', padding: 12, minWidth: '180px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient, idx) => {
                  const uniqueKey = `${patient.patientUniqueId}-grouped`;
                  const lastVisitFormatted = patient.lastVisitDate ? new Date(patient.lastVisitDate).toLocaleDateString() : '—';
                  
                  return (
                    <tr key={uniqueKey} style={{ background: idx % 2 === 0 ? '#18232e' : 'transparent' }}>
                      <td style={{ border: '1px solid #00ffd0', padding: 12, color: '#fff', fontWeight: '500' }}>{patient.patientUniqueId}</td>
                      <td style={{ border: '1px solid #00ffd0', padding: 12, color: '#fff', fontWeight: '600' }}>{patient.patientName}</td>
                      <td style={{ border: '1px solid #00ffd0', padding: 12, color: '#00ffd0', fontSize: '14px' }}>{lastVisitFormatted}</td>
                      <td style={{ border: '1px solid #00ffd0', padding: 12, color: '#cfeee6', maxWidth: '300px', wordWrap: 'break-word' }}>{patient.lastComplaint}</td>
                      <td style={{ border: '1px solid #00ffd0', padding: 12, color: '#00ffd0', fontSize: '14px', textAlign: 'center', fontWeight: '600' }}>{patient.totalVisits}</td>
                      <td style={{ border: '1px solid #00ffd0', padding: 12, color: '#fff', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* Direct Export Complete History Button */}
                          <button 
                            className="btn btn-secondary" 
                            style={{ 
                              fontSize: '12px', 
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'transparent',
                              color: '#ff6b35',
                              border: '1px solid #ff6b35',
                              borderRadius: '6px',
                              transition: 'all 0.2s ease'
                            }} 
                            onMouseEnter={(e) => {
                              e.target.style.background = '#ff6b35';
                              e.target.style.color = '#071e24';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent';
                              e.target.style.color = '#ff6b35';
                            }}
                            onClick={() => {
                              // Use original patient ID for backward compatibility with API
                              const patientId = patient.originalPatientId || patient.patientUniqueId;
                              downloadCompletePatientHistory(patientId, patient.patientName);
                            }}
                          >
                            � Complete History
                          </button>
                          <button 
                            className="btn btn-primary" 
                            style={{ fontSize: '12px', padding: '6px 12px' }} 
                            onClick={() => {
                              const patientId = patient.originalPatientId || patient.patientUniqueId;
                              loadPatientCompleteHistory(patientId, patient.patientName);
                            }}
                          >
                            View Complete History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Patient Record Popup Modal */}
        {selectedRecordPatient && (
          <div 
            className="patient-record-modal"
            onClick={(e) => {
              // Close modal when clicking on backdrop
              if (e.target === e.currentTarget) {
                setSelectedRecordPatient(null);
                setPatientCompleteHistory(null);
              }
            }}
          >
            <div className="patient-record-card" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ color: '#00ffd0', margin: 0, fontSize: '24px' }}>
                  {patientCompleteHistory ? 'Complete Patient Medical History' : 'Patient Record Details'}
                </h3>
                <button 
                  onClick={() => {
                    setSelectedRecordPatient(null);
                    setPatientCompleteHistory(null);
                  }}
                  style={{
                    background: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Patient Information Card */}
              {patientCompleteHistory ? (
                <div style={{
                  background: 'rgba(0,255,208,0.05)',
                  border: '1px solid rgba(0,255,208,0.2)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ color: '#00ffd0', marginTop: 0, marginBottom: '16px' }}>Patient Information</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Name:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {patientCompleteHistory.patient?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Patient ID:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {patientCompleteHistory.patient?.uniqueId || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Email:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {patientCompleteHistory.patient?.email || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Phone:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {patientCompleteHistory.patient?.phone || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Age:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {patientCompleteHistory.patient?.age || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Gender:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {patientCompleteHistory.patient?.gender || 'Not specified'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Medical Summary */}
                  <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <h5 style={{ color: '#00ffd0', margin: '0 0 12px 0' }}>Medical Summary</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#ffffff', fontSize: '14px' }}>Total Visits:</strong>
                        <p style={{ margin: '4px 0', color: '#00ffd0', fontWeight: 'bold' }}>{patientCompleteHistory.totalVisits}</p>
                      </div>
                      <div>
                        <strong style={{ color: '#ffffff', fontSize: '14px' }}>Total Prescriptions:</strong>
                        <p style={{ margin: '4px 0', color: '#00ffd0', fontWeight: 'bold' }}>{patientCompleteHistory.totalPrescriptions}</p>
                      </div>
                      <div>
                        <strong style={{ color: '#ffffff', fontSize: '14px' }}>First Visit:</strong>
                        <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                          {patientCompleteHistory.firstVisit ? new Date(patientCompleteHistory.firstVisit).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <strong style={{ color: '#ffffff', fontSize: '14px' }}>Latest Visit:</strong>
                        <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                          {patientCompleteHistory.latestVisit ? new Date(patientCompleteHistory.latestVisit).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(0,255,208,0.05)',
                  border: '1px solid rgba(0,255,208,0.2)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ color: '#00ffd0', marginTop: 0, marginBottom: '16px' }}>Patient Information</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Name:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {selectedRecordPatient.patient?.name || selectedRecordPatient.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Patient ID:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {selectedRecordPatient.patient?.uniqueId || selectedRecordPatient.patient?._id || selectedRecordPatient.patientId || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Email:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {selectedRecordPatient.patient?.email || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Phone:</strong>
                      <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                        {selectedRecordPatient.patient?.phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Complete Medical History or Single Visit Information */}
              {patientCompleteHistory ? (
                // Complete Medical History View
                <div>
                  {/* Medical Timeline */}
                  <div style={{
                    background: 'rgba(30,30,30,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ color: '#00ffd0', marginTop: 0, marginBottom: '16px' }}>
                      Medical History Timeline ({patientCompleteHistory.totalVisits} visits)
                    </h4>
                    
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                      {patientCompleteHistory.visits && patientCompleteHistory.visits.length > 0 ? (
                        patientCompleteHistory.visits.map((visit, index) => (
                          <div key={index} style={{
                            marginBottom: '20px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h5 style={{ color: '#ffffff', margin: 0 }}>
                                Visit #{patientCompleteHistory.totalVisits - index}
                              </h5>
                              <span style={{ color: '#00ffd0', fontSize: '14px', fontWeight: 'bold' }}>
                                {new Date(visit.visitDate).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                              <div>
                                <strong style={{ color: '#ffffff', fontSize: '13px' }}>Visit ID:</strong>
                                <p style={{ margin: '4px 0', color: '#cfeee6', fontSize: '13px' }}>
                                  {visit.visitRef || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <strong style={{ color: '#ffffff', fontSize: '13px' }}>Status:</strong>
                                <p style={{ margin: '4px 0', color: visit.status === 'completed' ? '#4ade80' : '#fbbf24', fontSize: '13px' }}>
                                  {visit.status || 'N/A'}
                                </p>
                              </div>
                              {visit.doctor && (
                                <div>
                                  <strong style={{ color: '#ffffff', fontSize: '13px' }}>Doctor:</strong>
                                  <p style={{ margin: '4px 0', color: '#cfeee6', fontSize: '13px' }}>
                                    {visit.doctor.name || 'N/A'}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                              <strong style={{ color: '#ffffff', fontSize: '13px' }}>Symptoms:</strong>
                              <p style={{ margin: '4px 0', color: '#cfeee6', fontSize: '13px', lineHeight: '1.4' }}>
                                {Array.isArray(visit.symptoms) ? visit.symptoms.join(', ') : visit.symptoms || 'No symptoms recorded'}
                              </p>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                              <strong style={{ color: '#ffffff', fontSize: '13px' }}>Complaints:</strong>
                              <p style={{ margin: '4px 0', color: '#cfeee6', fontSize: '13px', lineHeight: '1.4' }}>
                                {visit.complaints || visit.reason || 'No complaints recorded'}
                              </p>
                            </div>

                            {visit.prescription && (
                              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,255,208,0.1)', borderRadius: '6px' }}>
                                <strong style={{ color: '#00ffd0', fontSize: '13px' }}>Prescription:</strong>
                                <p style={{ margin: '4px 0', color: '#cfeee6', fontSize: '12px' }}>
                                  {visit.prescription.prescriptionRef}
                                </p>
                                {visit.prescription.medicines && visit.prescription.medicines.length > 0 && (
                                  <div style={{ marginTop: '8px' }}>
                                    <strong style={{ color: '#ffffff', fontSize: '12px' }}>Medicines:</strong>
                                    <ul style={{ margin: '4px 0', color: '#cfeee6', fontSize: '12px', paddingLeft: '20px' }}>
                                      {visit.prescription.medicines.map((med, medIndex) => (
                                        <li key={medIndex}>{med.name} - {med.dosage} ({med.frequency})</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p style={{ color: '#cfeee6', textAlign: 'center', padding: '20px' }}>
                          No appointment history available
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Prescription History */}
                  {patientCompleteHistory.allPrescriptions && patientCompleteHistory.allPrescriptions.length > 0 && (
                    <div style={{
                      background: 'rgba(30,30,30,0.8)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '20px'
                    }}>
                      <h4 style={{ color: '#00ffd0', marginTop: 0, marginBottom: '16px' }}>
                        Prescription History ({patientCompleteHistory.totalPrescriptions} prescriptions)
                      </h4>
                      
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {patientCompleteHistory.allPrescriptions.map((prescription, index) => (
                          <div key={index} style={{
                            marginBottom: '16px',
                            padding: '16px',
                            background: 'rgba(0,255,208,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(0,255,208,0.2)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h6 style={{ color: '#00ffd0', margin: 0 }}>
                                Prescription #{patientCompleteHistory.totalPrescriptions - index}
                              </h6>
                              <span style={{ color: '#cfeee6', fontSize: '12px' }}>
                                {prescription.prescriptionRef || 'N/A'}
                              </span>
                            </div>

                            {prescription.doctor && (
                              <div style={{ marginBottom: '12px' }}>
                                <strong style={{ color: '#ffffff', fontSize: '13px' }}>Doctor:</strong>
                                <span style={{ margin: '0 0 0 8px', color: '#cfeee6', fontSize: '13px' }}>
                                  {prescription.doctor.name}
                                </span>
                              </div>
                            )}

                            {prescription.medicines && prescription.medicines.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <strong style={{ color: '#ffffff', fontSize: '13px' }}>Medicines:</strong>
                                <div style={{ marginTop: '8px' }}>
                                  {prescription.medicines.map((medicine, medIndex) => (
                                    <div key={medIndex} style={{ 
                                      marginBottom: '8px', 
                                      padding: '8px', 
                                      background: 'rgba(0,0,0,0.2)', 
                                      borderRadius: '4px' 
                                    }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                                        <div>
                                          <strong style={{ color: '#00ffd0', fontSize: '12px' }}>Medicine:</strong>
                                          <p style={{ margin: '2px 0', color: '#cfeee6', fontSize: '12px' }}>
                                            {medicine.name || 'N/A'}
                                          </p>
                                        </div>
                                        <div>
                                          <strong style={{ color: '#00ffd0', fontSize: '12px' }}>Dosage:</strong>
                                          <p style={{ margin: '2px 0', color: '#cfeee6', fontSize: '12px' }}>
                                            {medicine.dosage || 'N/A'}
                                          </p>
                                        </div>
                                        <div>
                                          <strong style={{ color: '#00ffd0', fontSize: '12px' }}>Frequency:</strong>
                                          <p style={{ margin: '2px 0', color: '#cfeee6', fontSize: '12px' }}>
                                            {medicine.frequency || 'N/A'}
                                          </p>
                                        </div>
                                        <div>
                                          <strong style={{ color: '#00ffd0', fontSize: '12px' }}>Duration:</strong>
                                          <p style={{ margin: '2px 0', color: '#cfeee6', fontSize: '12px' }}>
                                            {medicine.duration || 'N/A'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {prescription.notes && (
                              <div style={{ marginTop: '10px' }}>
                                <strong style={{ color: '#ffffff', fontSize: '13px' }}>Notes:</strong>
                                <p style={{ margin: '4px 0', color: '#cfeee6', fontSize: '13px', fontStyle: 'italic' }}>
                                  {prescription.notes}
                                </p>
                              </div>
                            )}

                            {prescription.nextVisit && (
                              <div style={{ marginTop: '8px' }}>
                                <strong style={{ color: '#ffffff', fontSize: '13px' }}>Next Visit:</strong>
                                <p style={{ margin: '4px 0', color: '#00ffd0', fontSize: '13px' }}>
                                  {prescription.nextVisit}
                                </p>
                              </div>
                            )}

                            <div style={{ marginTop: '10px', textAlign: 'right' }}>
                              <span style={{ color: '#00ffd0', fontSize: '12px' }}>
                                Created: {new Date(prescription.createdAt).toLocaleDateString()}
                              </span>
                              {prescription.appointmentRef && (
                                <span style={{ margin: '0 0 0 12px', color: '#cfeee6', fontSize: '12px' }}>
                                  Visit: {prescription.appointmentRef}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Single Visit Information View (fallback)
                <>
                  {/* Visit Information Card */}
                  <div style={{
                    background: 'rgba(0,255,208,0.05)',
                    border: '1px solid rgba(0,255,208,0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ color: '#00ffd0', marginTop: 0, marginBottom: '16px' }}>Visit Information</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#ffffff' }}>Visit Date:</strong>
                        <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                          {selectedRecordPatient.visitDate || selectedRecordPatient.date || selectedRecordPatient.attendedAt || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <strong style={{ color: '#ffffff' }}>Doctor:</strong>
                        <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                          {selectedRecordPatient.doctor || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <strong style={{ color: '#ffffff' }}>Status:</strong>
                        <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                          {selectedRecordPatient.status || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                      <strong style={{ color: '#ffffff' }}>Complaints/Symptoms:</strong>
                      <p style={{ 
                        margin: '8px 0', 
                        color: '#cfeee6', 
                        background: 'rgba(0,0,0,0.2)', 
                        padding: '12px', 
                        borderRadius: '8px',
                        minHeight: '40px'
                      }}>
                        {selectedRecordPatient.complaints || selectedRecordPatient.symptoms?.join(', ') || 'No complaints recorded'}
                      </p>
                    </div>
                  </div>

                  {/* Prescriptions Card */}
                  <div style={{
                    background: 'rgba(0,255,208,0.05)',
                    border: '1px solid rgba(0,255,208,0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ color: '#00ffd0', marginTop: 0, marginBottom: '16px' }}>Prescriptions</h4>
                    {selectedRecordPatient.prescriptions && selectedRecordPatient.prescriptions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {selectedRecordPatient.prescriptions.map((prescription, index) => (
                          <div key={index} style={{
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(0,255,208,0.1)',
                            borderRadius: '8px',
                            padding: '16px'
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minWidth(150px, 1fr))', gap: '8px' }}>
                              <div>
                                <strong style={{ color: '#ffffff', fontSize: '14px' }}>Medicine:</strong>
                                <p style={{ margin: '4px 0', color: '#00ffd0', fontWeight: 'bold' }}>
                                  {prescription.medicine || prescription.medication || prescription.name || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <strong style={{ color: '#ffffff', fontSize: '14px' }}>Dosage:</strong>
                                <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                                  {prescription.dosage || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <strong style={{ color: '#ffffff', fontSize: '14px' }}>Frequency:</strong>
                                <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                                  {prescription.frequency || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <strong style={{ color: '#ffffff', fontSize: '14px' }}>Duration:</strong>
                                <p style={{ margin: '4px 0', color: '#cfeee6' }}>
                                  {prescription.duration || 'N/A'}
                                </p>
                              </div>
                            </div>
                            {prescription.notes && (
                              <div style={{ marginTop: '12px' }}>
                                <strong style={{ color: '#ffffff', fontSize: '14px' }}>Notes:</strong>
                                <p style={{ margin: '4px 0', color: '#cfeee6', fontStyle: 'italic' }}>
                                  {prescription.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#cfeee6', fontStyle: 'italic' }}>No prescriptions recorded</p>
                    )}
                    
                    {selectedRecordPatient.nextVisit && (
                      <div style={{ marginTop: '16px' }}>
                        <strong style={{ color: '#ffffff' }}>Next Visit:</strong>
                        <p style={{ margin: '4px 0', color: '#00ffd0' }}>
                          {selectedRecordPatient.nextVisit}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {patientCompleteHistory ? (
                  // Complete History View Actions
                  <>
                    <button 
                      className="btn" 
                      onClick={() => downloadCompletePatientHistory(
                        patientCompleteHistory.patient?._id || patientCompleteHistory.patient?.uniqueId,
                        patientCompleteHistory.patient?.name
                      )}
                      style={{ 
                        fontSize: '14px', 
                        background: '#ff6b35', 
                        color: '#fff', 
                        border: '1px solid #ff6b35',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📊 Export Complete History
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => {
                        setSelectedRecordPatient(null);
                        setPatientCompleteHistory(null);
                      }}
                      style={{ fontSize: '14px' }}
                    >
                      Close
                    </button>
                  </>
                ) : (
                  // Single Visit View Actions
                  <>
                    <button 
                      className="btn" 
                      onClick={() => downloadCompletePatientHistory(
                        selectedRecordPatient.patient?._id || selectedRecordPatient.patientId, 
                        selectedRecordPatient.patient?.name || selectedRecordPatient.name
                      )}
                      style={{ fontSize: '14px', background: '#ff6b35', color: '#fff', border: '1px solid #ff6b35' }}
                    >
                      📊 Complete History
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => setSelectedRecordPatient(null)}
                      style={{ fontSize: '14px' }}
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const sidebarItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "queue", label: "Patient Queue" },
    { key: "attended", label: "Attended Patients" },
    { key: "records", label: "Digital Records" },
  ];

  // Make the main content occupy full available height and width for a spacious layout
  return (
    <DashboardLayout
      title={currentUser?.name || 'Doctor'}
      subtitle={currentUser?.specialization || 'Dashboard'}
      currentUser={currentUser}
      sidebarItems={sidebarItems}
      activeKey={activePanel}
      onSelect={setActivePanel}
      onRefresh={() => { dispatch(fetchDoctorQueue()); dispatch(fetchAttendedPatients()); dispatch(fetchDigitalRecords()); }}
      quickActions={[
        { label: t('refreshQueue'), variant: 'primary', onClick: () => dispatch(fetchDoctorQueue()) },
        { label: t('refreshRecords'), variant: 'outline', onClick: () => { dispatch(fetchAttendedPatients()); dispatch(fetchDigitalRecords()); } }
      ]}
    >
      <div style={{ 
        height: '100%',
        width: '100%',
        display: 'flex', 
        flexDirection: 'column'
      }}>
        <div style={{ 
          flex: 1,
          width: '100%',
          height: '100%'
        }}>
          {activePanel === 'records' ? renderRecordsPanel() : renderPanel()}
        </div>
      </div>

      {/* Prescription Modal */}
      {showPrescription && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #071e24 0%, #0a2a32 100%)',
            border: '1px solid rgba(0,255,208,0.2)',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,255,208,0.3) transparent'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: '#00ffd0', margin: 0, fontSize: '24px' }}>
                Give Prescription - {currentPrescriptionPatient?.name}
              </h3>
              <button 
                onClick={() => setShowPrescription(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ff6b6b',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {/* Notes Section */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ color: '#00ffd0', fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                Notes / Instructions
              </label>
              <textarea
                value={prescriptionData.notes}
                onChange={(e) => setPrescriptionData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter prescription notes, instructions, or recommendations..."
                style={{
                  width: '100%',
                  height: '100px',
                  padding: '12px',
                  border: '1px solid rgba(0,255,208,0.2)',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#ffffff',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Medicines Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <label style={{ color: '#00ffd0', fontSize: '14px', fontWeight: '600' }}>
                  Medicines
                </label>
                <button 
                  onClick={handleAddMedicine}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  + Add Medicine
                </button>
              </div>

              {prescriptionData.medicines.map((medicine, index) => (
                <div key={index} style={{
                  background: 'rgba(0,255,208,0.05)',
                  border: '1px solid rgba(0,255,208,0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Medicine name"
                      value={medicine.name}
                      onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid rgba(0,255,208,0.2)',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        color: '#ffffff'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Dosage"
                      value={medicine.dosage}
                      onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid rgba(0,255,208,0.2)',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        color: '#ffffff'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Frequency"
                      value={medicine.frequency}
                      onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid rgba(0,255,208,0.2)',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        color: '#ffffff'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Duration (e.g., 7 days)"
                      value={medicine.duration}
                      onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid rgba(0,255,208,0.2)',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        color: '#ffffff',
                        flex: 1,
                        marginRight: '12px'
                      }}
                    />
                    <button 
                      onClick={() => handleRemoveMedicine(index)}
                      style={{
                        background: '#ff6b6b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Next Visit Section */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ color: '#00ffd0', fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                Next Visit
              </label>
              <select
                value={prescriptionData.nextVisit}
                onChange={(e) => setPrescriptionData(prev => ({ ...prev, nextVisit: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid rgba(0,255,208,0.2)',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#ffffff'
                }}
              >
                <option value="No follow-up needed">No follow-up needed</option>
                <option value="1 week">After 1 week</option>
                <option value="2 weeks">After 2 weeks</option>
                <option value="1 month">After 1 month</option>
                <option value="3 months">After 3 months</option>
                <option value="As needed">As needed</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowPrescription(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePrescription}
                className="btn btn-primary"
              >
                Save Prescription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocuments && currentDocumentsPatient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #071e24 0%, #0a2a32 100%)',
            border: '1px solid rgba(0,255,208,0.2)',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,255,208,0.3) transparent'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: '#00ffd0', margin: 0, fontSize: '24px' }}>
                Medical Documents - {currentDocumentsPatient.name}
              </h3>
              <button 
                onClick={() => setShowDocuments(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ff6b6b',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {/* Patient Information */}
            <div style={{
              background: 'rgba(0,255,208,0.05)',
              border: '1px solid rgba(0,255,208,0.1)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: '#00ffd0' }}>Patient: </strong>
                <span style={{ color: '#fff' }}>{currentDocumentsPatient.name}</span>
              </div>
              {currentDocumentsPatient.symptoms && (
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#00ffd0' }}>Symptoms: </strong>
                  <span style={{ color: '#cfeee6' }}>{currentDocumentsPatient.symptoms}</span>
                </div>
              )}
              {currentDocumentsPatient.description && (
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#00ffd0' }}>Description: </strong>
                  <span style={{ color: '#cfeee6' }}>{currentDocumentsPatient.description}</span>
                </div>
              )}
              {currentDocumentsPatient.appointmentTime && (
                <div>
                  <strong style={{ color: '#00ffd0' }}>Appointment Time: </strong>
                  <span style={{ color: '#cfeee6' }}>{currentDocumentsPatient.appointmentTime}</span>
                </div>
              )}
            </div>

            {/* Documents Grid */}
            <div>
              <h4 style={{ color: '#00ffd0', marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
                📎 Uploaded Documents ({currentDocumentsPatient.documents?.length || 0})
              </h4>
              
              {currentDocumentsPatient.documents && currentDocumentsPatient.documents.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  {currentDocumentsPatient.documents.map((doc, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'rgba(0,255,208,0.05)',
                        border: '1px solid rgba(0,255,208,0.1)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, border-color 0.2s'
                      }}
                      onClick={() => {
                        const docUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/appointments/${currentDocumentsPatient.appointmentId}/documents/${doc.filename}`;
                        window.open(docUrl, '_blank');
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.borderColor = 'rgba(0,255,208,0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = 'rgba(0,255,208,0.1)';
                      }}
                    >
                      {doc.mimetype && doc.mimetype.startsWith('image/') ? (
                        <img
                          src={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/appointments/${currentDocumentsPatient.appointmentId}/documents/${doc.filename}`}
                          alt={doc.originalName}
                          style={{
                            width: '100%',
                            height: '150px',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '150px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '3rem',
                          background: 'rgba(0,0,0,0.3)'
                        }}>
                          📄
                        </div>
                      )}
                      <div style={{
                        padding: '12px',
                        background: 'rgba(0,0,0,0.2)'
                      }}>
                        <div style={{
                          fontSize: '0.85rem',
                          color: '#fff',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: '600'
                        }}>
                          {doc.originalName || doc.filename}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#00ffd0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>{(doc.size / 1024).toFixed(2)} KB</span>
                          <span>📥 View</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#cfeee6',
                  background: 'rgba(0,255,208,0.05)',
                  borderRadius: '12px'
                }}>
                  No documents uploaded for this appointment.
                </div>
              )}
            </div>

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                onClick={() => setShowDocuments(false)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
