import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  symptoms: [String],
  complaints: { type: String, default: '' }, // Additional field for detailed complaints
  reason: { type: String, default: '' }, // Reason for appointment
  description: { type: String, default: '' }, // Detailed problem description from patient
  documents: [{ 
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String,
    uploadedAt: { type: Date, default: Date.now }
  }], // Medical documents (prescriptions, reports, images)
  slot: { type: String, default: '' }, // Time slot
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' }, // Link to prescription
  attendedAt: { type: Date }, // When the appointment was completed
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Appointment', appointmentSchema);