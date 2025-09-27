import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getSocket } from '../utils/socket';

export default function CallNotification() {
  const [incomingCall, setIncomingCall] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [callState, setCallState] = useState('idle'); // idle, incoming, declined, accepted
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'patient') return;

    const socket = getSocket();
    
    const handleIncomingCall = (data) => {
      // Prevent duplicate notifications
      if (callState === 'incoming' || callState === 'accepted') {
        console.log('🚫 Ignoring duplicate call notification - already in state:', callState);
        return;
      }

      console.log('📞 Incoming call notification received:', data);
      console.log('📞 Notification details:', {
        hasData: !!data,
        from: data?.from,
        appointmentId: data?.appointmentId,
        userRole: user?.role,
        socketConnected: socket?.connected,
        currentCallState: callState
      });
      
      setIncomingCall(data);
      setShowNotification(true);
      setCallState('incoming');
      
      // Auto-decline after 30 seconds if not answered
      setTimeout(() => {
        if (callState === 'incoming') {
          console.log('📞 Auto-declining call after timeout');
          handleDecline(true);
        }
      }, 30000);
    };

    const handleCallTimeout = (data) => {
      console.log('📞 Call timeout received:', data);
      if (data?.appointmentId === incomingCall?.appointmentId) {
        setShowNotification(false);
        setIncomingCall(null);
        setCallState('idle');
      }
    };

    const handleCallEnded = (data) => {
      console.log('📞 Call ended received:', data);
      setShowNotification(false);
      setIncomingCall(null);
      setCallState('idle');
    };

    const handleCallError = (data) => {
      console.log('📞 Call error received:', data);
      setShowNotification(false);
      setIncomingCall(null);
      setCallState('idle');
    };

    socket.on('webrtc:start-call', handleIncomingCall);
    socket.on('call:timeout', handleCallTimeout);
    socket.on('webrtc:call-ended', handleCallEnded);
    socket.on('call:error', handleCallError);

    return () => {
      socket.off('webrtc:start-call', handleIncomingCall);
      socket.off('call:timeout', handleCallTimeout);
      socket.off('webrtc:call-ended', handleCallEnded);
      socket.off('call:error', handleCallError);
    };
  }, [user, callState, incomingCall?.appointmentId]);

  const handleAccept = () => {
    if (callState !== 'incoming' || !incomingCall?.appointmentId) {
      console.log('❌ Cannot accept call - invalid state or missing data');
      return;
    }

    console.log('✅ Accepting call for appointment:', incomingCall.appointmentId);
    setCallState('accepted');
    setShowNotification(false);
    
    navigate(`/call/${incomingCall.appointmentId}`);
    
    // Clear state after navigation
    setTimeout(() => {
      setIncomingCall(null);
      setCallState('idle');
    }, 1000);
  };

  const handleDecline = (isTimeout = false) => {
    if (callState !== 'incoming') {
      console.log('❌ Cannot decline call - not in incoming state');
      return;
    }

    console.log('❌ Declining call for appointment:', incomingCall?.appointmentId);
    setCallState('declined');
    
    // Notify backend about declined call
    if (incomingCall?.from && incomingCall?.appointmentId && !isTimeout) {
      const socket = getSocket();
      socket.emit('webrtc:call-declined', {
        doctorId: incomingCall.from,
        appointmentId: incomingCall.appointmentId
      });
    }
    
    setShowNotification(false);
    setIncomingCall(null);
    
    // Reset state after a brief delay
    setTimeout(() => {
      setCallState('idle');
    }, 1000);
  };

  if (!showNotification || !incomingCall || callState !== 'incoming') return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Incoming Call
          </h3>
          <p className="text-gray-600 mb-2">
            {incomingCall.fromUserName || 'Doctor'} is calling you
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Appointment ID: {incomingCall.appointmentId}
          </p>
          <div className="flex space-x-3">
            <button
              onClick={handleDecline}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              disabled={callState !== 'incoming'}
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              disabled={callState !== 'incoming'}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}