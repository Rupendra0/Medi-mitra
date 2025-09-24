import React from 'react';

const HealthRecords = ({ prescriptions }) => {
  return (
    <div>
      <h2>Health Records</h2>
      <div className="simple-card">
        <h4>My Prescriptions</h4>
        {prescriptions && prescriptions.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {prescriptions.map(p => (
              <li key={p._id} style={{ padding: '8px 0', borderBottom: '1px solid #333' }}>
                <div><strong>Date:</strong> {new Date(p.createdAt).toLocaleDateString()}</div>
                <div><strong>Doctor:</strong> {p.doctor?.name || 'N/A'}</div>
                <div><strong>Notes:</strong> {p.notes || 'No notes provided.'}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No prescriptions found.</p>
        )}
      </div>
    </div>
  );
};

export default HealthRecords;
