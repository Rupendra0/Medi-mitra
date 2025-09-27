import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

export default function initSocket(io) {
  // Track active calls and call states
  const activeCalls = new Map(); // appointmentId -> { doctorId, patientId, status, timestamp }
  const userCallStates = new Map(); // userId -> { appointmentId, status }

  // Helper functions
  const isUserInCall = (userId) => {
    const userState = userCallStates.get(userId);
    return userState && ['calling', 'ringing', 'connected'].includes(userState.status);
  };

  const isAppointmentActive = (appointmentId) => {
    const call = activeCalls.get(appointmentId);
    return call && ['calling', 'ringing', 'connected'].includes(call.status);
  };

  const setCallState = (appointmentId, doctorId, patientId, status) => {
    const timestamp = Date.now();
    
    // Update appointment call state
    activeCalls.set(appointmentId, { doctorId, patientId, status, timestamp });
    
    // Update user call states
    userCallStates.set(doctorId, { appointmentId, status });
    userCallStates.set(patientId, { appointmentId, status });
    
    console.log(`📞 Call state updated: ${appointmentId} -> ${status}`);
  };

  const clearCallState = (appointmentId) => {
    const call = activeCalls.get(appointmentId);
    if (call) {
      userCallStates.delete(call.doctorId);
      userCallStates.delete(call.patientId);
      activeCalls.delete(appointmentId);
      console.log(`📞 Call state cleared: ${appointmentId}`);
    }
  };

  io.use(async (socket, next) => {
    try {
      const tokenFromAuth = socket.handshake.auth?.token;
      const tokenFromCookie = socket.handshake.headers?.cookie?.includes("token=")
        ? socket.handshake.headers.cookie.split("token=")[1]
        : null;
      const tokenFromHeader = socket.handshake.headers?.authorization?.startsWith("Bearer ")
        ? socket.handshake.headers.authorization.split(" ")[1]
        : null;

      const token = tokenFromAuth || tokenFromCookie || tokenFromHeader;
      if (!token) return next();

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id role name");

      if (user) {
        socket.data.user = { id: user._id.toString(), role: user.role, name: user.name };
        socket.join(user._id.toString());
      }
      next();
    } catch {
      next();
    }
  });

  io.on("connection", (socket) => {
    // Basic connection log
    if (socket.data?.user) {
      console.log("🔌 Socket connected:", socket.id, socket.data.user);
    } else {
      console.log("🔌 Socket connected without auth:", socket.id);
    }

    // Send current call state to user on connection
    if (socket.data?.user?.id) {
      const userId = socket.data.user.id;
      const userCallState = userCallStates.get(userId);
      if (userCallState) {
        socket.emit("call:state-sync", userCallState);
      }
    }

    // ✅ Chat events
    socket.on("chat:message", (data) => io.to(data.to).emit("chat:message", data));

    // ✅ WebRTC signaling
    socket.on("webrtc:offer", (data) => {
      io.to(data.to).emit("webrtc:offer", { offer: data.offer, from: socket.data.user?.id });
    });

    socket.on("webrtc:answer", (data) => {
      io.to(data.to).emit("webrtc:answer", { answer: data.answer, from: socket.data.user?.id });
      
      // Update call state to connected when answer is sent
      const patientId = socket.data.user?.id;
      const doctorId = data.to;
      
      // Find appointment ID for this call
      for (const [appointmentId, call] of activeCalls.entries()) {
        if (call.patientId === patientId && call.doctorId === doctorId) {
          setCallState(appointmentId, doctorId, patientId, 'connected');
          break;
        }
      }
    });

    socket.on("webrtc:ice-candidate", (data) => {
      io.to(data.to).emit("webrtc:ice-candidate", { candidate: data.candidate, from: socket.data.user?.id });
    });

    // ✅ Incoming call (doctor → patient) - Enhanced with state management
    socket.on("webrtc:start-call", ({ patientId, to, appointmentId, fromUserName }) => {
      const target = patientId || to; // frontend may send either field
      const doctorId = socket.data.user?.id;
      
      if (!target || !doctorId || !appointmentId) {
        console.log("❌ Invalid call parameters:", { target, doctorId, appointmentId });
        return;
      }

      // Check if doctor is already in a call
      if (isUserInCall(doctorId)) {
        console.log("❌ Doctor already in a call:", doctorId);
        socket.emit("call:error", { 
          message: "You are already in a call",
          code: "ALREADY_IN_CALL"
        });
        return;
      }

      // Check if patient is already in a call
      if (isUserInCall(target)) {
        console.log("❌ Patient already in a call:", target);
        socket.emit("call:error", { 
          message: "Patient is already in a call",
          code: "PATIENT_BUSY"
        });
        return;
      }

      // Check if this appointment already has an active call
      if (isAppointmentActive(appointmentId)) {
        console.log("❌ Appointment already has active call:", appointmentId);
        socket.emit("call:error", { 
          message: "This appointment already has an active call",
          code: "APPOINTMENT_ACTIVE"
        });
        return;
      }

      // Set call state to calling/ringing
      setCallState(appointmentId, doctorId, target, 'calling');

      const payload = {
        from: doctorId,
        fromUserName: fromUserName || socket.data.user?.name || "Doctor",
        appointmentId,
        timestamp: Date.now(),
        type: "call-notification",
      };
      
      console.log("📞 Emitting webrtc:start-call to", target, payload);
      io.to(target).emit("webrtc:start-call", payload);

      // Set timeout to auto-clear call if not answered in 60 seconds
      setTimeout(() => {
        const call = activeCalls.get(appointmentId);
        if (call && call.status === 'calling') {
          console.log("📞 Call timeout for appointment:", appointmentId);
          clearCallState(appointmentId);
          io.to(doctorId).emit("call:timeout", { appointmentId });
          io.to(target).emit("call:timeout", { appointmentId });
        }
      }, 60000);
    });

    // ✅ Patient rejects call
    socket.on("webrtc:call-declined", ({ doctorId, appointmentId }) => {
      console.log("📞 Call declined:", { doctorId, appointmentId });
      clearCallState(appointmentId);
      io.to(doctorId).emit("webrtc:call-declined", {
        from: socket.data.user?.id,
        appointmentId,
      });
    });

    // ✅ Call ended by either party
    socket.on("webrtc:end-call", ({ appointmentId, targetUserId }) => {
      console.log("📞 Call ended:", { appointmentId, userId: socket.data.user?.id });
      
      if (appointmentId) {
        const call = activeCalls.get(appointmentId);
        if (call) {
          clearCallState(appointmentId);
          // Notify both parties
          io.to(call.doctorId).emit("webrtc:call-ended", { appointmentId });
          io.to(call.patientId).emit("webrtc:call-ended", { appointmentId });
        }
      } else if (targetUserId) {
        // Fallback if only targetUserId is provided
        io.to(targetUserId).emit("webrtc:call-ended", {});
      }
    });

    // Handle disconnection - clean up call states
    socket.on("disconnect", () => {
      const userId = socket.data?.user?.id;
      if (userId) {
        const userCallState = userCallStates.get(userId);
        if (userCallState) {
          console.log("📞 User disconnected during call:", userId);
          const call = activeCalls.get(userCallState.appointmentId);
          if (call) {
            // Notify the other party
            const otherUserId = call.doctorId === userId ? call.patientId : call.doctorId;
            io.to(otherUserId).emit("webrtc:call-ended", { 
              reason: "OTHER_USER_DISCONNECTED",
              appointmentId: userCallState.appointmentId
            });
            clearCallState(userCallState.appointmentId);
          }
        }
        console.log("🔌 Socket disconnected:", socket.id, socket.data.user);
      }
    });

    // ✅ User registration / join rooms
    socket.on("join", (userId) => {
      if (userId) socket.join(userId);
    });

    socket.on("register", (data) => {
      const userId = data?.userId || data;
      if (userId) socket.join(userId);
    });

    // ✅ Consultation & queue logic (untouched)
    socket.on("consultation:request", async ({ patientUniqueId, doctorUniqueId, appointmentId }) => {
      const patient = await User.findOne({ uniqueId: patientUniqueId });
      const doctor = await User.findOne({ uniqueId: doctorUniqueId });
      if (patient && doctor) {
        io.to(doctor._id.toString()).emit("consultation:request", {
          patientId: patient._id.toString(),
          appointmentId,
        });
      }
    });

    socket.on("consultation:accept", async ({ doctorUniqueId, patientUniqueId, appointmentId }) => {
      const patient = await User.findOne({ uniqueId: patientUniqueId });
      const doctor = await User.findOne({ uniqueId: doctorUniqueId });
      if (patient && doctor) {
        io.to(patient._id.toString()).emit("consultation:accepted", {
          doctorId: doctor._id.toString(),
          appointmentId,
        });
        await Appointment.findByIdAndUpdate(appointmentId, { status: "completed" });
      }
    });

    socket.on("queue:join", async ({ patientUniqueId, doctorUniqueId, symptoms }) => {
      const patient = await User.findOne({ uniqueId: patientUniqueId });
      const doctor = await User.findOne({ uniqueId: doctorUniqueId });
      if (patient && doctor) {
        const queueItem = {
          patientId: patient._id.toString(),
          name: patient.name,
          age: patient.age,
          village: patient.village,
          symptoms,
          urgency: "yellow",
        };
        doctor.queue = doctor.queue || [];
        doctor.queue.push(queueItem);
        await doctor.save();
        io.to(doctor._id.toString()).emit("queue:update", doctor.queue);
      }
    });

    socket.on("queue:leave", async ({ patientUniqueId, doctorUniqueId }) => {
      const doctor = await User.findOne({ uniqueId: doctorUniqueId });
      if (doctor) {
        doctor.queue = (doctor.queue || []).filter((item) => item.patientId !== patientUniqueId);
        await doctor.save();
        io.to(doctor._id.toString()).emit("queue:update", doctor.queue);
      }
    });

    socket.on("queue:assign", async ({ doctorUniqueId }) => {
      const doctor = await User.findOne({ uniqueId: doctorUniqueId });
      if (doctor?.queue) {
        const avgConsultationTime = 10;
        doctor.queue = doctor.queue.map((patient, index) => ({
          ...patient,
          queueNumber: index + 1,
          expectedWaitTime: (index + 1) * avgConsultationTime,
        }));
        await doctor.save();
        io.to(doctor._id.toString()).emit("queue:update", doctor.queue);
      }
    });

    socket.on("queue:update", async ({ doctorId }) => {
      const doctor = await User.findById(doctorId).populate("queue");
      if (doctor) {
        io.to(doctorId).emit("queue:update", doctor.queue);
      }
    });
  });
}