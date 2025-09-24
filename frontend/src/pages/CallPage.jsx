// frontend/src/pages/CallPage.jsx
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import useWebRTC from "../hooks/useWebRTC";
import { useSelector } from "react-redux";

export default function CallPage() {
  const { id: appointmentId } = useParams();
  const user = useSelector((state) => state.auth.user);
  const { localVideoRef, remoteVideoRef, startCall, answerCall, incomingOffer } =
    useWebRTC(user);

  useEffect(() => {
    if (user?.role === "patient") {
      // 🔑 Always try to answer when joining the call page
      // because incomingOffer was set in hook
      answerCall();
    }
  }, [user, answerCall]);

  const handleDoctorStart = () => {
    if (user?.role === "doctor") {
      console.log("Doctor starting call with patient:", appointmentId);
      startCall(appointmentId);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="flex-1 flex">
        {/* Local Video */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-1/3 border-2 border-blue-400 rounded-lg m-4"
        />

        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="flex-1 border-2 border-green-400 rounded-lg m-4"
        />
      </div>

      {/* Footer Controls */}
      <div className="p-4 flex justify-center bg-gray-800">
        {user?.role === "doctor" && (
          <button
            onClick={handleDoctorStart}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Start Call
          </button>
        )}
      </div>
    </div>
  );
}
