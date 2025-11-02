import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import User from '../models/User.js';

export const getAttendedPatients = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Access denied. Only doctors can view attended patients.' });
    }
    
    const attendedAppointments = await Appointment.find({
      doctor: req.user.id,
      status: 'completed'
    })
    .populate('patient', 'name email uniqueId phone')
    .populate('prescription')
    .sort({ attendedAt: -1, date: -1 });

    // Transform the data to use secure unique IDs instead of MongoDB ObjectIDs
    const attendedPatientsWithPrescriptions = attendedAppointments.map(appointment => ({
      appointmentRef: appointment.uniqueId || `APT-${appointment._id.toString().slice(-8)}`, // Secure reference
      patient: {
        uniqueId: appointment.patient?.uniqueId,
        name: appointment.patient?.name,
        email: appointment.patient?.email,
        phone: appointment.patient?.phone
      },
      date: appointment.date,
      attendedAt: appointment.attendedAt || appointment.date,
      symptoms: appointment.symptoms,
      complaints: appointment.complaints,
      reason: appointment.reason,
      status: appointment.status,
      prescriptions: appointment.prescription ? [{
        prescriptionRef: `PRESC-${appointment.prescription._id.toString().slice(-8)}`, // Secure reference
        medicines: appointment.prescription.medicines,
        notes: appointment.prescription.notes,
        nextVisit: appointment.prescription.nextVisit,
        createdAt: appointment.prescription.createdAt
      }] : [],
      // Add visit-like structure for digital records compatibility
      visits: [{
        date: appointment.attendedAt || appointment.date,
        complaints: appointment.complaints || appointment.symptoms?.join(', ') || '',
        symptoms: appointment.symptoms || [],
        reason: appointment.reason || '',
        prescriptions: appointment.prescription?.medicines || [],
        doctors: req.user.name,
        doctor: { 
          name: req.user.name,
          uniqueId: req.user.uniqueId 
        },
        status: 'completed'
      }]
    }));
    
    return res.json({ success: true, data: attendedPatientsWithPrescriptions });
  } catch (err) {
    console.error('getAttendedPatients:error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch attended patients.', error: err.message });
  }
};
export const getDoctorQueue = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const queue = await Appointment.find({
      doctor: req.user.id,
      status: 'scheduled'
    })
    .populate('patient', 'name email uniqueId')
    .sort({ date: 1 });

    // Sanitize response - remove MongoDB ObjectIDs and use secure references
    const sanitizedQueue = queue.map(appointment => ({
      appointmentRef: `APT-${appointment._id.toString().slice(-8)}`, // Secure reference for UI display
      appointmentId: appointment._id.toString(), // Provide actual ID for internal actions (start call, complete, etc.)
      patientId: appointment.patient?._id?.toString(),
      patient: {
        uniqueId: appointment.patient?.uniqueId,
        name: appointment.patient?.name,
        email: appointment.patient?.email
      },
      date: appointment.date,
      symptoms: appointment.symptoms,
      complaints: appointment.complaints,
      reason: appointment.reason,
      description: appointment.description,
      status: appointment.status,
      slot: appointment.slot,
      documents: appointment.documents || []
    }));

    res.json(sanitizedQueue);
  } catch (err) {
    console.error('Error fetching doctor queue:', err);
    res.status(500).json({ message: 'Failed to fetch queue.' });
  }
};

export const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id).populate('patient doctor', 'name role');
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    res.json(appointment);
  } catch (err) {
    console.error('Error fetching appointment by ID:', err);
    res.status(500).json({ message: 'Failed to fetch appointment.' });
  }
};

export const completeAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) {
      return res.status(400).json({ message: 'Appointment ID is required.' });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status: 'completed' },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    res.json({ message: 'Appointment marked as completed.', appointment: updatedAppointment });
  } catch (err) {
    console.error('Error completing appointment:', err);
    res.status(500).json({ message: 'Failed to complete appointment.' });
  }
};

export const createAppointment = async (req, res) => {
  try {
    const { doctor: doctorInput, date, description } = req.body;
    const patientId = req.user.id;
    
    // Check if the logged-in user is a patient
    if (req.user.role === 'doctor') {
      return res.status(403).json({ message: 'Doctors cannot book appointments. Please log in as a patient.' });
    }
    
    // Parse symptoms (can be JSON string from FormData)
    let symptoms = req.body.symptoms;
    if (typeof symptoms === 'string') {
      try {
        symptoms = JSON.parse(symptoms);
      } catch (e) {
        // If parsing fails, treat as comma-separated string
        symptoms = symptoms.split(',').map(s => s.trim()).filter(s => s);
      }
    }

    if (!doctorInput) {
      return res.status(400).json({ message: 'Doctor is required.' });
    }

    const doctorQuery = mongoose.Types.ObjectId.isValid(doctorInput)
      ? { _id: doctorInput }
      : { uniqueId: doctorInput };
    const doctor = await User.findOne(doctorQuery);

    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found or the specified user is not a doctor.' });
    }

    if (doctor._id.equals(patientId)) {
      return res.status(400).json({ message: 'You cannot book an appointment with yourself.' });
    }

    // Process uploaded documents
    const documents = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date()
    })) : [];

    const appointment = new Appointment({
      patient: patientId,
      doctor: doctor._id,
      date,
      symptoms,
      description: description || '',
      documents: documents
    });
    
    await appointment.save();
    
    await appointment.populate([
      { path: 'patient', select: 'name email role uniqueId' },
      { path: 'doctor', select: 'name email role uniqueId' }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(doctor._id.toString()).emit('consultation:request', {
        appointmentId: appointment._id.toString(),
        patient: appointment.patient,
      });
    }

    res.status(201).json(appointment);

  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ message: 'Failed to create appointment.', error: err.message });
  }
};

export const getAppointments = async (req, res) => {
  try {
    const query = { [req.user.role]: req.user.id };
    const appointments = await Appointment.find(query)
      .populate('doctor patient', 'name email role uniqueId')
      .sort({ date: -1 });
    res.json(appointments);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ message: 'Failed to fetch appointments.' });
  }
};

export const createPrescription = async (req, res) => {
  try {
    const { patientId, appointmentId, medicines, notes } = req.body;
    
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can write prescriptions.' });
    }

    const prescription = new Prescription({
      patient: patientId,
      doctor: req.user.id,
      appointment: appointmentId,
      medicines,
      notes,
    });

    await prescription.save();

    await prescription.populate([
      { path: 'patient', select: 'name email role' },
      { path: 'doctor', select: 'name email role' }
    ]);

    res.status(201).json(prescription);
  } catch (err) {
    console.error('Error creating prescription:', err);
    res.status(500).json({ message: 'Failed to create prescription.' });
  }
};

export const getPrescriptions = async (req, res) => {
  try {
    const query = { [req.user.role]: req.user.id };
    const prescriptions = await Prescription.find(query)
      .populate('doctor patient', 'name email role')
      .sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (err) {
    console.error('Error fetching prescriptions:', err);
    res.status(500).json({ message: 'Failed to fetch prescriptions.' });
  }
};

export const startCall = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can start calls.' });
    }

    const { patientId, appointmentId } = req.body;
    
    // Enhanced validation with better error messages
    if (!patientId) {
      console.error('❌ startCall: Missing patientId', { body: req.body });
      return res.status(400).json({ 
        success: false,
        message: 'patientId is required.',
        receivedBody: req.body 
      });
    }
    
    if (!appointmentId) {
      console.error('❌ startCall: Missing appointmentId', { body: req.body });
      return res.status(400).json({ 
        success: false,
        message: 'appointmentId is required.',
        receivedBody: req.body 
      });
    }

    console.log('✅ startCall: Valid request', { patientId, appointmentId, doctor: req.user.id });

    const io = req.app.get('io');
    if (io) {
      // Emit a start-call notification (do not send an empty RTC offer from the server)
      io.to(patientId).emit('webrtc:start-call', {
        from: req.user.id,
        fromUserName: req.user.name,
        appointmentId,
        timestamp: Date.now(),
        type: 'call-notification',
      });
      console.log('📞 Emitted webrtc:start-call to patient:', patientId);
    } else {
      console.warn('⚠️ Socket.io not available');
    }

    res.json({ success: true, message: 'Call initiated successfully.' });
  } catch (err) {
    console.error('Error starting call:', err);
    res.status(500).json({ success: false, message: 'Failed to start call.', error: err.message });
  }
};

// Debug endpoint to check patient data
export const debugPatientData = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    console.log('=== DEBUGGING PATIENT DATA ===');
    console.log('Patient ID:', patientId);
    
    // Check if patient exists
    const patient = await User.findById(patientId);
    console.log('Patient found:', patient ? patient.name : 'NOT FOUND');
    
    // Get ALL appointments (regardless of status)
    const allAppointments = await Appointment.find({ patient: patientId });
    console.log('Total appointments found:', allAppointments.length);
    allAppointments.forEach(apt => {
      console.log(`  Appointment: ${apt._id}, Status: ${apt.status}, Date: ${apt.date}`);
    });
    
    // Get ALL prescriptions
    const allPrescriptions = await Prescription.find({ patient: patientId });
    console.log('Total prescriptions found:', allPrescriptions.length);
    allPrescriptions.forEach(presc => {
      console.log(`  Prescription: ${presc._id}, Medicines: ${presc.medicines?.length || 0}`);
    });
    
    return res.json({
      patient: patient ? { name: patient.name, email: patient.email } : null,
      appointments: allAppointments.length,
      prescriptions: allPrescriptions.length,
      appointmentDetails: allAppointments,
      prescriptionDetails: allPrescriptions
    });
  } catch (err) {
    console.error('Debug error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Get complete history of a patient including all prescriptions and visits
export const getPatientCompleteHistory = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Access denied. Only doctors can view patient history.' });
    }

    const { patientId } = req.params;

    console.log('Fetching complete history for patient ID:', patientId);

    // Determine if patientId is a MongoDB ObjectID or uniqueId
    let patientQuery;
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      // For backward compatibility, still support MongoDB ObjectID
      patientQuery = { _id: patientId };
    } else {
      // Use uniqueId for secure queries
      patientQuery = { uniqueId: patientId };
    }

    // Get the actual patient first to get the MongoDB _id for queries
    const patient = await User.findOne(patientQuery);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const actualPatientId = patient._id;

    // Get all appointments for this patient with all statuses to capture more data
    const allAppointments = await Appointment.find({
      patient: actualPatientId
    })
    .populate('patient', 'name email uniqueId phone age gender bloodGroup')
    .populate('prescription')
    .populate('doctor', 'name')
    .sort({ attendedAt: -1, date: -1 });

    console.log('Found appointments:', allAppointments.length);

    // Get all prescriptions for this patient
    const allPrescriptions = await Prescription.find({
      patient: actualPatientId
    })
    .populate('patient', 'name email uniqueId phone age gender bloodGroup')
    .populate('doctor', 'name')
    .populate('appointment')
    .sort({ createdAt: -1 });

    console.log('Found prescriptions:', allPrescriptions.length);

    // Use the patient info we already retrieved
    const patientInfo = patient;

    console.log('Patient info found:', patientInfo ? patientInfo.name : 'No patient found');

    // Log appointment statuses for debugging
    console.log('Appointment statuses found:');
    allAppointments.forEach(apt => {
      console.log(`  Appointment ${apt._id}: status="${apt.status}", date=${apt.date}`);
    });

    // Filter appointments - be more inclusive to capture more data
    const completedAppointments = allAppointments.filter(apt => 
      apt.status === 'completed' || apt.status === 'attended' || apt.status === 'scheduled'
    );
    
    console.log(`Filtered appointments: ${completedAppointments.length} out of ${allAppointments.length}`);

    // Calculate proper statistics - include all appointments for now to show data
    const totalVisits = allAppointments.length; // Show all appointments for debugging
    const totalPrescriptions = allPrescriptions.length;
    
    // Find first and last visit dates from all appointments
    let firstVisitDate = null;
    let latestVisitDate = null;
    
    if (allAppointments.length > 0) {
      const sortedByDate = [...allAppointments].sort((a, b) => {
        const aDate = new Date(a.attendedAt || a.date);
        const bDate = new Date(b.attendedAt || b.date);
        return aDate - bDate; // Ascending order for first visit
      });
      
      firstVisitDate = sortedByDate[0].attendedAt || sortedByDate[0].date;
      latestVisitDate = sortedByDate[sortedByDate.length - 1].attendedAt || sortedByDate[sortedByDate.length - 1].date;
    }

    // Structure the complete history with secure IDs (no MongoDB ObjectIDs exposed)
    const completeHistory = {
      patient: patientInfo ? {
        uniqueId: patientInfo.uniqueId,
        name: patientInfo.name,
        email: patientInfo.email,
        phone: patientInfo.phone,
        age: patientInfo.age,
        gender: patientInfo.gender,
        bloodGroup: patientInfo.bloodGroup
      } : null,
      totalVisits,
      totalPrescriptions,
      firstVisit: firstVisitDate,
      latestVisit: latestVisitDate,
      visits: allAppointments.map(appointment => ({
        visitRef: `VISIT-${appointment._id.toString().slice(-8)}`, // Secure reference
        visitDate: appointment.attendedAt || appointment.date,
        doctor: appointment.doctor ? {
          name: appointment.doctor.name,
          uniqueId: appointment.doctor.uniqueId
        } : null,
        symptoms: appointment.symptoms || [],
        complaints: appointment.complaints || '',
        reason: appointment.reason || '',
        status: appointment.status,
        prescription: appointment.prescription ? {
          prescriptionRef: `PRESC-${appointment.prescription._id.toString().slice(-8)}`, // Secure reference
          medicines: appointment.prescription.medicines || [],
          notes: appointment.prescription.notes || '',
          nextVisit: appointment.prescription.nextVisit || '',
          createdAt: appointment.prescription.createdAt
        } : null
      })),
      allPrescriptions: allPrescriptions.map(prescription => ({
        prescriptionRef: `PRESC-${prescription._id.toString().slice(-8)}`, // Secure reference
        medicines: prescription.medicines || [],
        notes: prescription.notes || '',
        nextVisit: prescription.nextVisit || '',
        createdAt: prescription.createdAt,
        doctor: prescription.doctor ? {
          name: prescription.doctor.name,
          uniqueId: prescription.doctor.uniqueId
        } : null,
        appointmentRef: prescription.appointment ? `VISIT-${prescription.appointment._id.toString().slice(-8)}` : null
      }))
    };

    console.log('Complete history response:', {
      patientName: patientInfo?.name,
      totalVisits,
      totalPrescriptions,
      visitsCount: completeHistory.visits.length
    });

    return res.json({ success: true, data: completeHistory });
  } catch (err) {
    console.error('getPatientCompleteHistory:error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch patient complete history.', error: err.message });
  }
};