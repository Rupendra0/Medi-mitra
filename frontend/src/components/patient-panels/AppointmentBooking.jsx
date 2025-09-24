import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchPatientData } from '../../utils/dashboardSlice'; // Adjust path if needed
import api from '../../utils/api';

const AppointmentBooking = ({ appointments, doctors, onBookingSuccess }) => {
  const [booking, setBooking] = useState({ doctor: '', date: '', symptoms: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleRequestCall = async () => {
    if (!booking.doctor || !booking.date || !booking.symptoms) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError('');

    // ✅ PROACTIVELY REQUEST PERMISSIONS
    try {
      // This will trigger the browser's permission pop-up
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // We got permission, so we can immediately stop the tracks as we don't need them yet.
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Media permissions denied:", err);
      setError("Camera and microphone access is required to book a video consultation. Please grant permission and try again.");
      setLoading(false);
      return; // Stop the booking if permission is denied
    }

    const appointmentData = {
      doctor: booking.doctor,
      symptoms: booking.symptoms.split(',').map(s => s.trim()),
      date: booking.date,
    };

    try {
      const res = await api.apiFetch('/api/appointments', {
        method: 'POST',
        body: JSON.stringify(appointmentData),
      });

      if (res.ok) {
        alert('Appointment requested successfully!');
        dispatch(fetchPatientData());
        onBookingSuccess();
      } else {
        setError(res.data?.message || 'Failed to create appointment.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Book Consultation</h2>
      <div className="simple-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="small">Doctor</label>
            <select
              value={booking.doctor}
              onChange={(e) => setBooking({ ...booking, doctor: e.target.value })}
              className="input-style"
            >
              <option value="">Select a doctor</option>
              {doctors.map(d => (
                <option key={d._id} value={d._id}>{d.name} ({d.specialization})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="small">Date and Time</label>
            <input
              type="datetime-local"
              value={booking.date}
              onChange={(e) => setBooking({ ...booking, date: e.target.value })}
              className="input-style"
            />
          </div>
          <div>
            <label className="small">Symptoms (comma-separated)</label>
            <input
              type="text"
              value={booking.symptoms}
              onChange={(e) => setBooking({ ...booking, symptoms: e.target.value })}
              placeholder="e.g., Fever, Cough"
              className="input-style"
            />
          </div>
          {error && <p style={{ color: '#ff4d4f' }}>{error}</p>}
          <div>
            <button className="btn btn-primary" onClick={handleRequestCall} disabled={loading}>
              {loading ? 'Requesting...' : 'Request Call'}
            </button>
          </div>
        </div>
      </div>
      <div className="simple-card">
        <h4>Recent Appointments</h4>
        {appointments && appointments.length > 0 ? (
          appointments.map(a => (
            <div key={a._id} className="queue-item">
              <span>Dr. {a.doctor?.name} - {new Date(a.date).toLocaleString()}</span>
              <span style={{ textTransform: 'capitalize' }}>{a.status}</span>
            </div>
          ))
        ) : <p>No recent appointments.</p>}
      </div>
    </div>
  );
};

export default AppointmentBooking;
