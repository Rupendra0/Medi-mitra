import React, { useEffect, useState } from 'react';
import '../../styles/patient-overview.premium.css';
import { useLanguage } from '../../utils/LanguageProvider';
import { useDispatch } from 'react-redux';
import api from '../../utils/api';
import { loginSuccess } from '../../utils/authSlice';

const compactDate = (d) => {
  try {
    return new Date(d).toLocaleDateString();
  } catch (e) {
    return d || '-';
  }
};

const PatientOverview = ({ user, setActivePanel, appointments = [], prescriptions = [], currentMedicines = [], latestPrescriptionAt = null }) => {
  const upcoming = (appointments || [])
    .filter(a => a && a.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  const recentPrescriptions = (prescriptions || []).slice(0, 3);

  const { t } = useLanguage();
  const dispatch = useDispatch();

  const [editing, setEditing] = useState(false);
  const [hasUnseenPrescription, setHasUnseenPrescription] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    age: user?.age || '',
    gender: user?.gender || '',
    bloodGroup: user?.bloodGroup || '',
    address: user?.address || '',
    emergencyContact: user?.emergencyContact || '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const saveProfile = async () => {
    try {
      const res = await api.updateProfile(form);
      if (!res.ok) throw new Error(res.data?.message || 'Update failed');
      // Update redux auth user
      dispatch(loginSuccess({ user: res.data.user }));
      setEditing(false);
      window.dispatchEvent(new Event('user-updated'));
    } catch (err) {
      console.error('Profile update error', err);
      alert(err.message || 'Failed to update profile');
    }
  };

  useEffect(() => {
    const evaluate = () => {
      if (!latestPrescriptionAt) {
        setHasUnseenPrescription(false);
        return;
      }

      try {
        const stored = typeof window !== 'undefined'
          ? window.localStorage.getItem('mm_prescription_last_seen')
          : null;
        const latestIso = new Date(latestPrescriptionAt).toISOString();
        if (!stored || new Date(latestIso) > new Date(stored)) {
          setHasUnseenPrescription(true);
        } else {
          setHasUnseenPrescription(false);
        }
      } catch (err) {
        console.warn('Prescription badge state unavailable', err);
        setHasUnseenPrescription(true);
      }
    };

    evaluate();

    if (typeof window !== 'undefined') {
      window.addEventListener('mm:prescriptions-seen', evaluate);
      return () => {
        window.removeEventListener('mm:prescriptions-seen', evaluate);
      };
    }
    return undefined;
  }, [latestPrescriptionAt]);

  return (
    <div>
      <div className="premium-card premium-header">
        <div>
          <div className="premium-title">{t('patientDashboard').replace('Dashboard','') || `Hello, ${user?.name || 'Patient'}!`}</div>
          <div className="premium-subtitle">{user?.uniqueId ? `ID: ${user.uniqueId}` : ''}</div>
        </div>
        <div>
          <span className="badge">Patient</span>
        </div>
      </div>

      <div className="premium-card premium-overview" style={{ marginTop: 14 }}>
        <div>
          <div className="detail-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{t('patientDetails')}</strong>
              {!editing ? (
                <button className="btn" onClick={() => setEditing(true)}>Edit</button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => { setEditing(false); setForm({ name: user?.name || '', age: user?.age || '', gender: user?.gender || '', bloodGroup: user?.bloodGroup || '', address: user?.address || '', emergencyContact: user?.emergencyContact || '' }); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveProfile}>Save</button>
                </div>
              )}
            </div>

            <div className="details-grid">
              <div className="detail-item"><strong>{t('nameLabel')}</strong><div>{!editing ? (user?.name || '-') : (<input name="name" value={form.name} onChange={handleChange} className="input" />)}</div></div>
              <div className="detail-item"><strong>{t('uniqueIdLabel')}</strong><div>{user?.uniqueId || '-'}</div></div>
              <div className="detail-item"><strong>{t('ageLabel')}</strong><div>{!editing ? (user?.age ?? '-') : (<input name="age" type="number" value={form.age} onChange={handleChange} className="input" />)}</div></div>
              <div className="detail-item"><strong>{t('genderLabel')}</strong><div>{!editing ? (user?.gender || '-') : (<select name="gender" value={form.gender} onChange={handleChange} className="input"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select>)}</div></div>
              <div className="detail-item"><strong>{t('contactLabel')}</strong><div>{!editing ? (user?.phone || user?.email || '-') : (<input name="phone" value={form.phone} onChange={handleChange} className="input" />)}</div></div>
              <div className="detail-item"><strong>{t('emergencyLabel')}</strong><div>{!editing ? (user?.emergencyContact || '-') : (<input name="emergencyContact" value={form.emergencyContact} onChange={handleChange} className="input" />)}</div></div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}><strong>{t('addressLabel')}</strong><div>{!editing ? (user?.address || '-') : (<textarea name="address" value={form.address} onChange={handleChange} className="input" />)}</div></div>
              <div className="detail-item"><strong>Blood Group</strong><div>{!editing ? (user?.bloodGroup || '-') : (<input name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className="input" />)}</div></div>
            </div>
          </div>
        </div>

        <div>
          <div className="detail-item health-snapshot-card">
            <strong>Health Snapshot</strong>

            <div className="health-metrics">
              <div className="metric-card">
                <div className="badge metric-value">{currentMedicines?.length || 0}</div>
                <div className="metric-label">{t('activeMedicines')}</div>
              </div>
              <div className="metric-card">
                <div className="badge metric-value">{appointments?.length || 0}</div>
                <div className="metric-label">{t('appointmentsLabel')}</div>
              </div>
              <div className="metric-card">
                {hasUnseenPrescription && (
                  <span className="metric-indicator">New</span>
                )}
                <div className="badge metric-value">{prescriptions?.length || 0}</div>
                <div className="metric-label">{t('prescriptionsLabel')}</div>
              </div>
            </div>

            <div className="actions-row">
              <button className="btn action-btn" onClick={() => setActivePanel('book')}>{t('bookAppointmentBtn') || t('book')}</button>
              <button className="btn action-btn" onClick={() => setActivePanel('records')}>{t('viewRecordsBtn') || t('records')}</button>
              <button className="btn action-btn" onClick={() => setActivePanel('medicines')}>{t('medicineTrackerBtn') || t('medicineTrackerTitle')}</button>
              <button className="btn action-btn" onClick={() => setActivePanel('symptoms')}>{t('symptomCheckerTitle')}</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }} className="detail-item">
            <strong>Recent Prescriptions</strong>
            <div className="prescription-list" style={{ marginTop: 8 }}>
              {recentPrescriptions.length > 0 ? (
                recentPrescriptions.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>{p.medicines && p.medicines[0]?.name ? p.medicines[0].name : (p.medicationName || p.name || 'Prescription')}</div>
                    <div style={{ color: '#6b7280' }}>{compactDate(p.createdAt || p.date)}</div>
                  </div>
                ))
              ) : (
                <div>No recent prescriptions.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="premium-card" style={{ marginTop: 14 }}>
        <strong>Upcoming Appointments</strong>
        <div className="upcoming-list" style={{ marginTop: 8 }}>
          {upcoming.length > 0 ? (
            upcoming.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{a.doctorName ? `Dr. ${a.doctorName}` : 'Doctor' }{a.reason ? ` — ${a.reason}` : ''}</div>
                <div style={{ color: '#6b7280' }}>{compactDate(a.date)}</div>
              </div>
            ))
          ) : (
            <div>No upcoming appointments.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {/* SymptomChecker moved to its own panel - open via Quick Actions */}
      </div>
    </div>
  );
};

export default PatientOverview;
