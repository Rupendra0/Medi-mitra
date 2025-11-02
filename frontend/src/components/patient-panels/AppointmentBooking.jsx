import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchPatientData } from '../../utils/dashboardSlice'; // Adjust path if needed
import api from '../../utils/api';
import { useLanguage } from '../../utils/LanguageProvider';

const AppointmentBooking = ({ appointments, doctors, onBookingSuccess }) => {
  const [booking, setBooking] = useState({ doctor: '', date: '', symptoms: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const { t } = useLanguage();

  const handleRequestCall = async () => {
    // Validate required fields: doctor and date only. Symptoms are optional.
    if (!booking.doctor) {
      setError(t('pleaseSelectDoctor') || 'Please select a doctor');
      return;
    }
    if (!booking.date) {
      setError(t('pleaseSelectDate') || 'Please choose a date and time');
      return;
    }
    setLoading(true);
    setError('');

    // Request media permissions (for video consult)
    try {
      // feature detect and attempt video+audio, fallback to audio-only, and finally to legacy APIs
      const getMedia = async () => {
        if (typeof navigator === 'undefined') return null; // non-browser environment

        const tryModern = async (constraints) => {
          if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            return navigator.mediaDevices.getUserMedia(constraints);
          }
          return null;
        };

        const tryLegacy = (constraints) => {
          const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
          if (!getUserMedia) return null;
          return new Promise((resolve, reject) => {
            getUserMedia.call(navigator, constraints, resolve, reject);
          });
        };

        // 1) Try video+audio via modern API
        try {
          const s = await tryModern({ audio: true, video: true });
          if (s) return s;
        } catch (e) {
          // If permission denied, propagate so we stop the flow
          if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) throw e;
          // otherwise fall through to try audio-only
        }

        // 2) Try audio-only via modern API
        try {
          const s = await tryModern({ audio: true, video: false });
          if (s) return s;
        } catch (e) {
          if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) throw e;
        }

        // 3) Legacy APIs: try video+audio, then audio-only
        try {
          const s = await tryLegacy({ audio: true, video: true });
          if (s) return s;
        } catch (e) {
          if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) throw e;
        }
        try {
          const s = await tryLegacy({ audio: true, video: false });
          if (s) return s;
        } catch (e) {
          if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) throw e;
        }

        // nothing available
        return null;
      };

      const stream = await getMedia();
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => track.stop());
      } else {
        // No stream available: not supported in this environment. Show a non-blocking warning and continue booking.
        setError(t('mediaNotSupported') || 'Camera/microphone not available. Booking will proceed without media.');
      }
    } catch (err) {
      console.error('Media access error:', err);
      // Permission-denied should block the flow because user must allow
      if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message === 'Permission denied')) {
        setError(t('mediaPermissionDenied') || 'Camera/microphone permission denied. Please allow access and try again.');
        setLoading(false);
        return;
      }
      // Any other unexpected error: surface a general message but allow booking to continue
      setError(t('aiError') || 'Unable to access media devices. Booking will proceed without media.');
    }

    const appointmentData = {
      doctor: booking.doctor,
      // Make symptoms optional and sanitize list
      symptoms: booking.symptoms ? booking.symptoms.split(',').map(s => s.trim()).filter(Boolean) : [],
      date: booking.date,
    };

    try {
      const res = await api.apiFetch('/api/appointments', {
        method: 'POST',
        body: appointmentData,
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
      <h2>{t('bookConsultation')}</h2>
      <div className="simple-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="small">{t('doctorLabel')}</label>
            <select
              value={booking.doctor}
              onChange={(e) => setBooking({ ...booking, doctor: e.target.value })}
              className="input-style"
            >
              <option value="">{t('selectDoctor')}</option>
              {doctors.map(d => (
                <option key={d._id} value={d._id}>{d.name} ({d.specialization})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="small">{t('dateTime')}</label>
            <input
              type="datetime-local"
              value={booking.date}
              onChange={(e) => setBooking({ ...booking, date: e.target.value })}
              className="input-style"
            />
          </div>
          <div>
            <label className="small">{t('symptomsLabel')}</label>
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
              {loading ? t('checking') : t('requestCall')}
            </button>
          </div>
        </div>
      </div>
      <div className="simple-card">
        <h4>{t('recentAppointments')}</h4>
        {appointments && appointments.length > 0 ? (
          appointments.map(a => (
            <div key={a._id} className="queue-item">
              <span>Dr. {a.doctor?.name} - {new Date(a.date).toLocaleString()}</span>
              <span style={{ textTransform: 'capitalize' }}>{a.status}</span>
            </div>
          ))
        ) : <p>{t('noRecentAppointments')}</p>}
      </div>
    </div>
  );
};

export default AppointmentBooking;
