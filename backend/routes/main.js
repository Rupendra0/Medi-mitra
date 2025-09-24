import express from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import {
  createAppointment,
  getAppointments,
  createPrescription,
  getPrescriptions,
  startCall,
  getDoctorQueue,
  getAppointmentById,
  completeAppointment,
} from '../controllers/mainController.js';
import { listSockets, listUsers } from '../controllers/debugController.js';

const router = express.Router();

// --- Appointment Routes ---
router.route('/appointments')
  .post(authenticateJWT, createAppointment)
  .get(authenticateJWT, getAppointments);

router.post('/appointments/start-call', authenticateJWT, authorizeRoles('doctor'), startCall);
router.post('/appointments/complete', authenticateJWT, authorizeRoles('doctor'), completeAppointment);

// --- Prescription Routes ---
router.route('/prescriptions')
  .post(authenticateJWT, authorizeRoles('doctor'), createPrescription)
  .get(authenticateJWT, getPrescriptions);
  
// --- Queue Routes ---
router.get('/queue/doctor', authenticateJWT, authorizeRoles('doctor'), getDoctorQueue);

router.get('/appointments/:id', authenticateJWT, getAppointmentById);

// --- Debug Routes ---
router.get('/debug/sockets', listSockets);
router.get('/users', listUsers);

export default router;
