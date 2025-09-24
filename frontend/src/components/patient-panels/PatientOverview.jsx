import React from 'react';
import SymptomChecker from '../SymptomChecker';

const PatientOverview = ({ user, setActivePanel }) => (
  <div>
    <h2>Hello, {user?.name || "Patient"}!</h2>
    <div className="simple-card">
      <strong>Quick Actions</strong>
      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <button className="btn" onClick={() => setActivePanel("book")}>Book Appointment</button>
        <button className="btn" onClick={() => setActivePanel("records")}>View Records</button>
      </div>
    </div>
    <div className="simple-card">
      <SymptomChecker />
    </div>
  </div>
);

export default PatientOverview;
