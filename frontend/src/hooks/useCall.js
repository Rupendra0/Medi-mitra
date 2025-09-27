// frontend/src/hooks/useCall.js
// Thin React hook wrapper around the minimal WebRTC call controller.
import { useEffect, useState, useRef } from 'react';
import { createCallController } from '../webrtc/webrtcClient';
import { useSelector } from 'react-redux';

export function useCall() {
  const user = useSelector(s => s.auth.user);
  const controllerRef = useRef(null);
  const [snapshot, setSnapshot] = useState({ state: 'idle' });

  useEffect(() => {
    if (user?._id && !controllerRef.current) {
      controllerRef.current = createCallController(user._id);
      return controllerRef.current.subscribe(setSnapshot);
    }
  }, [user?._id]);

  return {
    ...snapshot,
    startCall: (toUserId) => controllerRef.current?.startCall(toUserId, user?.name),
    cancelCall: () => controllerRef.current?.cancelCall(),
    acceptCall: () => controllerRef.current?.acceptCall(),
    rejectCall: () => controllerRef.current?.rejectCall(),
    endCall: () => controllerRef.current?.endCall(),
    toggleAudio: () => controllerRef.current?.toggleAudio(),
    toggleVideo: () => controllerRef.current?.toggleVideo(),
    audioEnabled: controllerRef.current?.getAudioEnabled() ?? false,
    videoEnabled: controllerRef.current?.getVideoEnabled() ?? false,
  };
}
