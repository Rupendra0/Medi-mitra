import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

export default function initSocket(io) {
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
    // ✅ Chat events
    socket.on("chat:message", (data) => io.to(data.to).emit("chat:message", data));

    // ✅ WebRTC signaling
    socket.on("webrtc:offer", (data) => {
      io.to(data.to).emit("webrtc:offer", { offer: data.offer, from: socket.data.user?.id });
    });

    socket.on("webrtc:answer", (data) => {
      io.to(data.to).emit("webrtc:answer", { answer: data.answer, from: socket.data.user?.id });
    });

    socket.on("webrtc:ice-candidate", (data) => {
      io.to(data.to).emit("webrtc:ice-candidate", { candidate: data.candidate, from: socket.data.user?.id });
    });

    // ✅ Incoming call (doctor → patient)
    socket.on("webrtc:start-call", ({ patientId, to, appointmentId, fromUserName }) => {
      const target = patientId || to; // frontend may send either field
      if (!target) return;
      const payload = {
        from: socket.data.user?.id,
        fromUserName: fromUserName || socket.data.user?.name || "Doctor",
        appointmentId,
        timestamp: Date.now(),
        type: "call-notification",
      };
      console.log("📞 Emitting webrtc:start-call to", target, payload);
      io.to(target).emit("webrtc:start-call", payload);
    });

    // ✅ Patient rejects call
    socket.on("webrtc:call-declined", ({ doctorId, appointmentId }) => {
      io.to(doctorId).emit("webrtc:call-declined", {
        from: socket.data.user?.id,
        appointmentId,
      });
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
