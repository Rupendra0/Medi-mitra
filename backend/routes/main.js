




import express from 'express';
import path from 'path';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import Appointment from '../models/Appointment.js';
import {
  createAppointment,
  getAppointments,
  createPrescription,
  getPrescriptions,
  startCall,
  getDoctorQueue,
  getAppointmentById,
  completeAppointment,
  getAttendedPatients,
  getPatientCompleteHistory,
  debugPatientData
} from '../controllers/mainController.js';
import { listSockets, listUsers } from '../controllers/debugController.js';

const router = express.Router();

// --- Appointment Routes ---
router.post('/appointments', authenticateJWT, upload.array('documents', 10), createAppointment);
router.get('/appointments', authenticateJWT, getAppointments);

// --- Document Download Route ---
router.get('/appointments/:id/documents/:documentId', authenticateJWT, async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    
    // Check if user is authorized (patient or doctor of the appointment)
    if (!appointment.patient.equals(req.user.id) && !appointment.doctor.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    // Find document by _id or filename
    const document = appointment.documents.find(doc => 
      doc._id.toString() === documentId || doc.filename === documentId
    );
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }
    
    // Send file with absolute path
    const absolutePath = path.resolve(document.path);
    res.sendFile(absolutePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ message: 'Failed to send document.' });
      }
    });
  } catch (err) {
    console.error('Error downloading document:', err);
    res.status(500).json({ message: 'Failed to download document.' });
  }
});

router.post('/appointments/start-call', authenticateJWT, authorizeRoles('doctor'), startCall);
router.post('/appointments/complete', authenticateJWT, authorizeRoles('doctor'), completeAppointment);

// --- Prescription Routes ---
router.route('/prescriptions')
  .post(authenticateJWT, authorizeRoles('doctor'), createPrescription)
  .get(authenticateJWT, getPrescriptions);
  
// --- Queue Routes ---
router.get('/queue/doctor', authenticateJWT, authorizeRoles('doctor'), getDoctorQueue);

// --- Doctor attended patients ---
router.get('/doctor/attended-patients', authenticateJWT, authorizeRoles('doctor'), getAttendedPatients);

// --- Patient complete history (accepts uniqueId or MongoDB ObjectID for backward compatibility) ---
router.get('/patient/:patientId/complete-history', authenticateJWT, authorizeRoles('doctor'), getPatientCompleteHistory);

// --- Debug route ---
router.get('/debug/patient/:patientId', debugPatientData);

router.get('/appointments/:id', authenticateJWT, getAppointmentById);

// --- Debug Routes ---
router.get('/debug/sockets', listSockets);
router.get('/users', listUsers);

export default router;
