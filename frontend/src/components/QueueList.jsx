import React from 'react';

export default function QueueList({ items = [], onStart, onRecords, onDone, currentUser, allowStart = false }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className="simple-card muted">No items</div>;
  }

  return (
    <div className="simple-card compact-list">
      {items.map((p, i) => (
        <div key={p.appointmentId || p.patientId || i} className="queue-row">
          <div>
            <div style={{fontWeight:700}}>{p.name}</div>
            <div className="muted small">{p.symptoms || p.info || ''}</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {(() => {
              const isDoctor = !!(currentUser && typeof currentUser.role === 'string' && currentUser.role.toLowerCase() === 'doctor');
              const showStart = onStart && (allowStart || isDoctor);
              return showStart ? <button className="btn" onClick={() => onStart(p.patientId || p.appointmentId)}>Start</button> : null;
            })()}
            {onRecords ? <button className="btn" onClick={() => onRecords(p.patientId || p.appointmentId)}>Records</button> : null}
            {onDone ? <button className="btn" onClick={() => onDone(p.appointmentId)}>Done</button> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
