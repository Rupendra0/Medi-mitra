import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchPatientData } from '../../utils/dashboardSlice'; // Adjust path if needed
import api from '../../utils/api';
import { useLanguage } from '../../utils/LanguageProvider';

const AppointmentBooking = ({ appointments, doctors, onBookingSuccess }) => {
  const [booking, setBooking] = useState({ doctor: '', date: '', symptoms: '' });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptoms, setCustomSymptoms] = useState('');
  const [showSymptomDropdown, setShowSymptomDropdown] = useState(false);
  const [description, setDescription] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
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
    
    // Combine dropdown symptoms with custom symptoms
    const allSymptoms = [...newSymptoms];
    if (customSymptoms.trim()) {
      allSymptoms.push(...customSymptoms.split(',').map(s => s.trim()).filter(s => s));
    }
    setBooking({ ...booking, symptoms: allSymptoms.join(', ') });
    setError(''); // Clear error when symptom is selected
  };

  // Remove a symptom
  const handleSymptomRemove = (symptom) => {
    const newSymptoms = selectedSymptoms.filter(s => s !== symptom);
    setSelectedSymptoms(newSymptoms);
    
    // Combine remaining dropdown symptoms with custom symptoms
    const allSymptoms = [...newSymptoms];
    if (customSymptoms.trim()) {
      allSymptoms.push(...customSymptoms.split(',').map(s => s.trim()).filter(s => s));
    }
    setBooking({ ...booking, symptoms: allSymptoms.join(', ') });
  };
  // Handle custom symptoms input
  const handleCustomSymptomsChange = (e) => {
    const value = e.target.value;
    setCustomSymptoms(value);
    
    // Combine dropdown symptoms with custom symptoms
    const allSymptoms = [...selectedSymptoms];
    if (value.trim()) {
      allSymptoms.push(...value.split(',').map(s => s.trim()).filter(s => s));
    }
    setBooking({ ...booking, symptoms: allSymptoms.join(', ') });
    setError(''); // Clear error when symptom is entered
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
    }
    setError(''); // Clear any previous errors
    setBooking({ ...booking, date: value });
  };

  // Handle document upload (images and files)
  const handleDocumentUpload = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 5 * 1024 * 1024; // 5MB per file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'image/heic'];
    
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        setError(`${file.name} is not a supported format. Please upload JPG, PNG, PDF, or HEIC files.`);
        return false;
      }
      if (file.size > maxSize) {
        setError(`${file.name} is too large. Maximum file size is 5MB.`);
        return false;
      }
      return true;
    });

    // Create preview objects for uploaded files
    const newDocuments = validFiles.map(file => ({
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB',
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    setUploadedDocuments([...uploadedDocuments, ...newDocuments]);
    setError('');
  };

  // Handle camera capture
  const handleCameraCapture = (e) => {
    handleDocumentUpload(e);
  };

  // Remove uploaded document
  const handleRemoveDocument = (index) => {
    const newDocs = [...uploadedDocuments];
    if (newDocs[index].preview) {
      URL.revokeObjectURL(newDocs[index].preview);
    }
    newDocs.splice(index, 1);
    setUploadedDocuments(newDocs);
  };

  const handleRequestCall = async () => {
    // Clear previous errors first
    setError('');
    
    // Detailed validation with specific error messages
    if (!booking.doctor) {
      setError('Please select a doctor');
      return;
    }
    if (!booking.date) {
      setError('Please select date and time');
      return;
    }
    if (!booking.symptoms) {
      setError('Please select or enter symptoms');
      return;
    }
    
    setLoading(true);

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

    // Prepare form data for file upload
    const formData = new FormData();
    formData.append('doctor', booking.doctor);
    formData.append('symptoms', JSON.stringify(booking.symptoms.split(',').map(s => s.trim())));
    formData.append('date', booking.date);
    formData.append('description', description.trim());
    
    // Append uploaded documents
    uploadedDocuments.forEach((doc, index) => {
      formData.append('documents', doc.file);
    });

    try {
      console.log('Submitting appointment with data:', {
        doctor: booking.doctor,
        symptoms: booking.symptoms,
        date: booking.date,
        description: description.trim(),
        documentsCount: uploadedDocuments.length
      });
      
      const res = await api.apiFetch('/api/appointments', {
        method: 'POST',
        body: formData,
        isFormData: true, // Signal to not set Content-Type header
      });

      if (res.ok) {
        alert('Appointment requested successfully!');
        dispatch(fetchPatientData());
        setBooking({ doctor: '', date: '', symptoms: '' });
        setSelectedSymptoms([]);
        setCustomSymptoms('');
        setDescription('');
        setWordCount(0);
        // Clean up document previews
        uploadedDocuments.forEach(doc => {
          if (doc.preview) URL.revokeObjectURL(doc.preview);
        });
        setUploadedDocuments([]);
        onBookingSuccess();
      } else {
        const errorMsg = res.data?.message || 'Failed to create appointment.';
        console.error('Appointment creation failed:', errorMsg, res);
        setError(errorMsg);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <h2>{t('bookConsultation')}</h2>
      <div className="simple-card" style={{ marginBottom: '20px' }}>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleRequestCall();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <div>
            <label className="small">{t('doctorLabel')}</label>
            <select
              value={booking.doctor}
              onChange={(e) => {
                setBooking({ ...booking, doctor: e.target.value });
                setError(''); // Clear error when doctor is selected
              }}
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
                <div 
                  style={{
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
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setShowSymptomDropdown(false);
                    }
                  }}
                  tabIndex="0"
                >
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
              value={customSymptoms}
              onChange={handleCustomSymptomsChange}
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

          <div>
            <label className="small">
              Upload Medical Documents (Optional)
              <span style={{ 
                fontSize: '0.75rem', 
                color: '#0ef6cc99',
                fontWeight: 'normal',
                marginLeft: '8px'
              }}>
                (Images, Prescriptions, Reports - Max 5MB each)
              </span>
            </label>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginTop: '8px',
              flexWrap: 'wrap'
            }}>
              {/* File Upload Button */}
              <label style={{
                flex: '1',
                minWidth: '150px',
                padding: '10px 16px',
                backgroundColor: '#008170',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#00a08a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#008170'}
              >
                📁 Choose Files
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleDocumentUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {/* Camera Capture Button */}
              <label style={{
                flex: '1',
                minWidth: '150px',
                padding: '10px 16px',
                backgroundColor: '#005B41',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#007055'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#005B41'}
              >
                📷 Take Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCameraCapture}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Uploaded Documents Preview */}
            {uploadedDocuments.length > 0 && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: 'rgba(0, 129, 112, 0.1)',
                borderRadius: '8px',
                border: '1px solid #0ef6cc33'
              }}>
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: '#0ef6cc',
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}>
                  Uploaded Documents ({uploadedDocuments.length})
                </div>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '10px'
                }}>
                  {uploadedDocuments.map((doc, index) => (
                    <div
                      key={index}
                      style={{
                        position: 'relative',
                        backgroundColor: '#232D3F',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid #0ef6cc44'
                      }}
                    >
                      {doc.preview ? (
                        <img
                          src={doc.preview}
                          alt={doc.name}
                          style={{
                            width: '100%',
                            height: '100px',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem'
                        }}>
                          📄
                        </div>
                      )}
                      <div style={{
                        padding: '6px',
                        fontSize: '0.7rem',
                        color: '#e0f7f3',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {doc.name}
                      </div>
                      <div style={{
                        padding: '2px 6px',
                        fontSize: '0.65rem',
                        color: '#0ef6cc99',
                        textAlign: 'center'
                      }}>
                        {doc.size}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(index)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#ff4d4f',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ff7875'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff4d4f'}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p style={{ color: '#ff4d4f' }}>{error}</p>}
          <div style={{ marginTop: '16px' }}>
            <button 
              type="submit"
              className="btn btn-primary" 
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? t('checking') : t('requestCall')}
            </button>
          </div>
        </form>
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
