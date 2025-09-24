import express from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Example protected route for patients
router.get('/patient/dashboard', authenticateJWT, authorizeRoles('patient'), (req, res) => {
  res.json({ message: 'Welcome to the patient dashboard!', user: req.user });
});

// Example protected route for doctors
router.get('/doctor/dashboard', authenticateJWT, authorizeRoles('doctor'), (req, res) => {
  res.json({ message: 'Welcome to the doctor dashboard!', user: req.user });
});

export default router;