import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCall } from '../hooks/useCall';

export default function CallNotification() {
  const user = useSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const { state, callId, acceptCall, rejectCall } = useCall();
  const [appointmentId] = useState(null); // placeholder: integrate appointment mapping if needed

  if (user?.role !== 'patient') return null;
  const isRinging = state === 'ringing';
  if (!isRinging) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Incoming Call
          </h3>
          <p className="text-gray-600 mb-4">
            Incoming call
          </p>
          <div className="flex space-x-3">
            <button
              onClick={rejectCall}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={() => {
                acceptCall();
                if (appointmentId) navigate(`/call/${appointmentId}`); else navigate('/call/temp');
              }}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
