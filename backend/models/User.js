import mongoose from 'mongoose';


const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor'], required: true },
  uniqueId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  pendingAppointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
  }],
  specialization: {
    type: String,
    required: function () {
      return this.role === "doctor";
    },
  },
});

export default mongoose.model('User', userSchema);