import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchPatientData } from '../../utils/dashboardSlice'; // Adjust path if needed
import api from '../../utils/api';
import { useLanguage } from '../../utils/LanguageProvider';

const AppointmentBooking = ({ appointments, doctors, onBookingSuccess }) => {
  const [booking, setBooking] = useState({ doctor: '', date: '', symptoms: '' });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [showSymptomDropdown, setShowSymptomDropdown] = useState(false);
  const [description, setDescription] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const { t } = useLanguage();

  // Common symptoms list (expanded)
  const commonSymptoms = [
    'Fever', 'Cough', 'Cold', 'Headache', 'Body Pain', 'Sore Throat',
    'Fatigue', 'Nausea', 'Vomiting', 'Diarrhea', 'Stomach Pain',
    'Chest Pain', 'Shortness of Breath', 'Dizziness', 'Skin Rash',
    'Joint Pain', 'Back Pain', 'Runny Nose', 'Sneezing', 'Loss of Appetite',
    'Abdominal Pain', 'Constipation', 'Bloating', 'Heartburn', 'Acid Reflux',
    'Muscle Weakness', 'Numbness', 'Tingling', 'Blurred Vision', 'Eye Pain',
    'Ear Pain', 'Hearing Loss', 'Toothache', 'Gum Pain', 'Mouth Ulcers',
    'Anxiety', 'Depression', 'Insomnia', 'Sleep Disorders', 'Confusion',
    'Memory Loss', 'Difficulty Concentrating', 'Mood Swings', 'Irritability',
    'Weight Loss', 'Weight Gain', 'Excessive Thirst', 'Frequent Urination',
    'Blood in Urine', 'Painful Urination', 'Incontinence', 'Kidney Pain',
    'Swelling', 'Edema', 'Leg Cramps', 'Varicose Veins', 'Blood Clots',
    'High Blood Pressure', 'Low Blood Pressure', 'Irregular Heartbeat', 'Palpitations',
    'Sweating', 'Night Sweats', 'Chills', 'Shivering', 'Hot Flashes',
    'Hair Loss', 'Brittle Nails', 'Dry Skin', 'Itching', 'Hives',
    'Bruising', 'Bleeding', 'Nosebleeds', 'Gum Bleeding', 'Heavy Periods',
    'Irregular Periods', 'Missed Periods', 'Painful Periods', 'PMS',
    'Vaginal Discharge', 'Vaginal Itching', 'Painful Intercourse',
    'Erectile Dysfunction', 'Low Libido', 'Infertility',
    'Wheezing', 'Snoring', 'Sleep Apnea', 'Chronic Cough', 'Phlegm',
    'Hoarseness', 'Voice Changes', 'Difficulty Swallowing', 'Choking',
    'Tremors', 'Seizures', 'Fainting', 'Loss of Consciousness', 'Paralysis'
  ];

  // Handle symptom selection from dropdown
  const handleSymptomToggle = (symptom) => {
    let newSymptoms;
    if (selectedSymptoms.includes(symptom)) {
      newSymptoms = selectedSymptoms.filter(s => s !== symptom);
    } else {
      newSymptoms = [...selectedSymptoms, symptom];
    }
    setSelectedSymptoms(newSymptoms);
    setBooking({ ...booking, symptoms: newSymptoms.join(', ') });
  };

  // Remove a symptom
  const handleSymptomRemove = (symptom) => {
    const newSymptoms = selectedSymptoms.filter(s => s !== symptom);
    setSelectedSymptoms(newSymptoms);
    setBooking({ ...booking, symptoms: newSymptoms.join(', ') });
  };

  // Handle description change with word count limit
  const handleDescriptionChange = (e) => {
    const text = e.target.value;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const count = words.length;
    
    if (count <= 400) {
      setDescription(text);
      setWordCount(count);
    }
  };

  // Validate and restrict year to 4 digits (max 9999)
  const handleDateChange = (e) => {
    const value = e.target.value;
    if (value) {
      const date = new Date(value);
      const year = date.getFullYear();
      // Restrict year to be between 1000 and 9999 (4 digits)
      if (year > 9999) {
        setError('Please enter a valid year');
        return;
      }
      if (year < 1000) {
        setError('Please enter a valid year');
        return;
      }
      setError('');
    }
    setBooking({ ...booking, date: value });
  };

  const handleRequestCall = async () => {
    if (!booking.doctor || !booking.date || !booking.symptoms) {
      setError(t('pleaseSelectSymptom'));
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
      symptoms: booking.symptoms.split(',').map(s => s.trim()),
      date: booking.date,
      description: description.trim()
    };

    try {
      const res = await api.apiFetch('/api/appointments', {
        method: 'POST',
        body: appointmentData,
      });

      if (res.ok) {
        alert('Appointment requested successfully!');
        dispatch(fetchPatientData());
        setBooking({ doctor: '', date: '', symptoms: '' });
        setSelectedSymptoms([]);
        setDescription('');
        setWordCount(0);
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
              onChange={handleDateChange}
              min="1000-01-01T00:00"
              max="9999-12-31T23:59"
              className="input-style"
            />
          </div>
          <div>
            <label className="small">{t('symptomsLabel')}</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowSymptomDropdown(!showSymptomDropdown)}
                className="input-style"
                style={{ 
                  width: '100%', 
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(35,45,63,0.8)',
                  border: '1px solid #0ef6cc55',
                  color: '#e0f7f3'
                }}
              >
                <span>{selectedSymptoms.length > 0 ? `${selectedSymptoms.length} symptom(s) selected` : 'Click to select symptoms'}</span>
                <span style={{ fontSize: '1.2rem' }}>{showSymptomDropdown ? '▲' : '▼'}</span>
              </button>
              
              {showSymptomDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '250px',
                  overflowY: 'auto',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #0ef6cc',
                  borderRadius: '8px',
                  marginTop: '4px',
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ 
                    padding: '8px',
                    backgroundColor: '#0ef6cc22',
                    borderBottom: '1px solid #0ef6cc55',
                    fontSize: '0.85rem',
                    color: '#0ef6cc',
                    fontWeight: 'bold'
                  }}>
                    Select multiple symptoms
                  </div>
                  {commonSymptoms.map(symptom => (
                    <div
                      key={symptom}
                      onClick={() => handleSymptomToggle(symptom)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        backgroundColor: selectedSymptoms.includes(symptom) ? '#008170' : 'transparent',
                        color: selectedSymptoms.includes(symptom) ? 'white' : '#e0f7f3',
                        borderBottom: '1px solid #333',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedSymptoms.includes(symptom)) {
                          e.currentTarget.style.backgroundColor = '#232D3F';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedSymptoms.includes(symptom)) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span>{symptom}</span>
                      {selectedSymptoms.includes(symptom) && (
                        <span style={{ fontSize: '1.2rem', color: 'white' }}>✓</span>
                      )}
                    </div>
                  ))}
                  <div style={{ 
                    padding: '10px',
                    borderTop: '1px solid #0ef6cc55',
                    backgroundColor: '#0ef6cc11'
                  }}>
                    <button
                      type="button"
                      onClick={() => setShowSymptomDropdown(false)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: '#008170',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.9rem'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#00a08a'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#008170'}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {selectedSymptoms.length > 0 && (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px', 
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'rgba(0, 129, 112, 0.1)',
                borderRadius: '6px'
              }}>
                {selectedSymptoms.map(symptom => (
                  <span
                    key={symptom}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: '#008170',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSymptomRemove(symptom)}
                  >
                    {symptom}
                    <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>×</span>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={booking.symptoms}
              onChange={(e) => setBooking({ ...booking, symptoms: e.target.value })}
              placeholder="Or type custom symptoms (comma-separated)"
              className="input-style"
              style={{ marginTop: '8px' }}
            />
          </div>

          <div>
            <label className="small">
              Problem Description (Optional)
              <span style={{ 
                float: 'right', 
                fontSize: '0.75rem', 
                color: wordCount > 380 ? '#ff6b6b' : '#0ef6cc',
                fontWeight: 'normal'
              }}>
                {wordCount}/400 words
              </span>
            </label>
            <textarea
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Briefly describe your problem to help the doctor understand your condition better..."
              className="input-style"
              rows="3"
              style={{
                resize: 'vertical',
                minHeight: '70px',
                maxHeight: '150px',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
            />
            {wordCount > 380 && (
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#ff6b6b', 
                marginTop: '4px' 
              }}>
                Approaching word limit ({400 - wordCount} words remaining)
              </div>
            )}
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
