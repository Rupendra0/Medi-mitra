import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

/**
 * CallContext provides state and helpers for WebRTC call notifications.
 * This is a minimal scaffold inferred from usage of <CallProvider> and <CallNotification />.
 * Extend with actual signaling, peer connection, and media handling as needed.
 */
const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  // Incoming call info (e.g., callerId, roomId)
  const [incomingCall, setIncomingCall] = useState(null);
  const [isRinging, setIsRinging] = useState(false);
  const ringTimeoutRef = useRef(null);

  // Example: function to simulate receiving a call (replace with socket event handler)
  const simulateIncomingCall = useCallback((payload) => {
    setIncomingCall(payload);
    setIsRinging(true);
    // Auto-stop ringing after 30s if not answered/declined
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = setTimeout(() => {
      setIsRinging(false);
      setIncomingCall(null);
    }, 30000);
  }, []);

  const answerCall = useCallback(() => {
    setIsRinging(false);
    // Navigate or trigger state to open call page; caller supplies navigation externally
  }, []);

  const declineCall = useCallback(() => {
    setIsRinging(false);
    setIncomingCall(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    };
  }, []);

  const value = {
    incomingCall,
    isRinging,
    simulateIncomingCall,
    answerCall,
    declineCall,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
};

export default CallContext;
