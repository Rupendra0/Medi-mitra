import express from 'express';
import { signup, login, logout, getMe } from '../controllers/authController.js';

const router = express.Router();

router.get('/me', getMe);
router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);

export default router;