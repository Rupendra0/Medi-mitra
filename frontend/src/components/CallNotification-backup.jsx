import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getSocket } from '../utils/socket';

export default function CallNotification() {
  const [incomingCall, setIncomingCall] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'patient') return;

    const socket = getSocket();
    
    const handleIncomingCall = (data) => {
      console.log('📞 Incoming call notification received:', data);
      console.log('📞 Notification details:', {
        hasData: !!data,
        from: data?.from,
        appointmentId: data?.appointmentId,
        userRole: user?.role,
        socketConnected: socket?.connected
      });
      setIncomingCall(data);
      setShowNotification(true);
      
      // Auto-hide after 30 seconds
      setTimeout(() => {
        setShowNotification(false);
        setIncomingCall(null);
      }, 30000);
    };

    socket.on('webrtc:start-call', handleIncomingCall);

    return () => {
      socket.off('webrtc:start-call', handleIncomingCall);
    };
  }, [user]);

  const acceptCall = () => {
    if (incomingCall?.appointmentId) {
      navigate(`/call/${incomingCall.appointmentId}`);
      setShowNotification(false);
      setIncomingCall(null);
    }
  };

  const declineCall = () => {
    setShowNotification(false);
    setIncomingCall(null);
  };

  if (!showNotification || !incomingCall) return null;

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
            Doctor is calling you for your appointment
          </p>
          <div className="flex space-x-3">
            <button
              onClick={declineCall}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={acceptCall}
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
