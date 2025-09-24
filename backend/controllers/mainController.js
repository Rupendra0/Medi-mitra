import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import User from '../models/User.js';

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

    res.json(queue);
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
    const { doctor: doctorInput, date, symptoms } = req.body;
    const patientId = req.user.id;

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

    const appointment = new Appointment({
      patient: patientId,
      doctor: doctor._id,
      date,
      symptoms,
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
    res.status(500).json({ message: 'Failed to create appointment.' });
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
    if (!patientId || !appointmentId) {
        return res.status(400).json({ message: 'patientId and appointmentId are required.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(patientId).emit('webrtc:offer', {
        from: req.user.id,
        fromUserName: req.user.name, // ✅ Doctor's name is now included
        appointmentId,
      });
    }

    res.json({ message: 'Call initiated successfully.' });
  } catch (err) {
    console.error('Error starting call:', err);
    res.status(500).json({ message: 'Failed to start call.' });
  }
};
