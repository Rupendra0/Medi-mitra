import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

export default function initSocket(io) {
  // Authentication middleware – required for call signaling
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
      if (!token) return next(); // allow unauthenticated for non-call features if desired

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id role name");
      if (user) {
        socket.data.user = { id: user._id.toString(), role: user.role, name: user.name };
        socket.join(user._id.toString());
      }
      next();
    } catch (err) {
      console.warn("Socket auth failed", err?.message);
      next();
    }
  });

  io.on("connection", (socket) => {
    // =========================
    // Minimal Call Signaling (new)
    // =========================
    // In-memory call registry: NOT for clustering – upgrade with Redis adapter for multi-instance.
    // Structure: callId -> { callerId, calleeId, status, createdAt, acceptedAt?, ringTimer }
    if (!io.activeCalls) io.activeCalls = new Map();

    const RING_TIMEOUT_MS = parseInt(process.env.CALL_RING_TIMEOUT_MS || '45000', 10);

    function now() { return Date.now(); }
    function safeRelay(toUserId, event, payload) { if (toUserId) io.to(toUserId).emit(event, payload); }
    function isValidId(id) { return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id); }

    function endCallServer(callId, reason = 'ended', initiatorUserId = null) {
      const meta = io.activeCalls.get(callId);
      if (!meta) return;
      if (meta.ringTimer) clearTimeout(meta.ringTimer);
      const participants = [meta.callerId, meta.calleeId];
      participants.forEach(p => safeRelay(p, 'call:end', { callId, reason }));
      io.activeCalls.delete(callId);
      console.log(`📞 [CALL END] callId=${callId} reason=${reason} initiator=${initiatorUserId || 'server'} durationMs=${meta.acceptedAt ? (now()-meta.acceptedAt) : 0}`);
    }

    // ============ CALL REQUEST ============
    socket.on('call:request', ({ callId, toUserId, fromName }) => {
      const fromUserId = socket.data.user?.id;
      if (!fromUserId) return; // unauthenticated – ignore
      if (!callId || !toUserId) return;
      if (!isValidId(toUserId) || !isValidId(fromUserId)) return;

      // Prevent caller starting multiple concurrent calls
      for (const [, meta] of io.activeCalls.entries()) {
        if ((meta.callerId === fromUserId || meta.calleeId === fromUserId) && meta.status !== 'ended') {
          safeRelay(fromUserId, 'call:busy', { callId });
          return;
        }
      }
      // Busy check: callee engaged
      for (const [, meta] of io.activeCalls.entries()) {
        if ((meta.callerId === toUserId || meta.calleeId === toUserId) && meta.status !== 'ended') {
          safeRelay(fromUserId, 'call:busy', { callId });
          return;
        }
      }
      const meta = { callerId: fromUserId, calleeId: toUserId, status: 'request', createdAt: now(), acceptedAt: null, ringTimer: null };
      // Ring timeout
      meta.ringTimer = setTimeout(() => {
        if (io.activeCalls.get(callId)?.status === 'request') {
          endCallServer(callId, 'timeout');
        }
      }, RING_TIMEOUT_MS);
      io.activeCalls.set(callId, meta);
      console.log(`📞 [CALL REQUEST] callId=${callId} from=${fromUserId} to=${toUserId}`);
      safeRelay(toUserId, 'call:request', { callId, fromUserId, fromName: fromName || socket.data.user?.name || 'Caller' });
    });

    socket.on('call:cancel', ({ callId }) => {
      const meta = io.activeCalls.get(callId);
      if (!meta) return;
      const fromUserId = socket.data.user?.id;
      if (fromUserId !== meta.callerId) return;
      endCallServer(callId, 'cancelled', fromUserId);
    });

    socket.on('call:reject', ({ callId }) => {
      const meta = io.activeCalls.get(callId);
      if (!meta) return;
      const fromUserId = socket.data.user?.id;
      if (fromUserId !== meta.calleeId) return;
      endCallServer(callId, 'rejected', fromUserId);
    });

    socket.on('call:accept', ({ callId }) => {
      const meta = io.activeCalls.get(callId);
      if (!meta) return;
      const fromUserId = socket.data.user?.id;
      if (fromUserId !== meta.calleeId) return;
      meta.status = 'accepted';
      meta.acceptedAt = now();
      if (meta.ringTimer) { clearTimeout(meta.ringTimer); meta.ringTimer = null; }
      safeRelay(meta.callerId, 'call:accept', { callId });
      console.log(`📞 [CALL ACCEPT] callId=${callId} callee=${fromUserId}`);
    });

    socket.on('call:offer', ({ callId, sdp }) => {
      const meta = io.activeCalls.get(callId);
      if (!meta || meta.status !== 'accepted' || !sdp) return;
      const fromUserId = socket.data.user?.id;
      if (fromUserId !== meta.callerId) return;
      safeRelay(meta.calleeId, 'call:offer', { callId, sdp });
    });

    socket.on('call:answer', ({ callId, sdp }) => {
      const meta = io.activeCalls.get(callId);
      if (!meta || meta.status !== 'accepted' || !sdp) return;
      const fromUserId = socket.data.user?.id;
      if (fromUserId !== meta.calleeId) return;
      safeRelay(meta.callerId, 'call:answer', { callId, sdp });
    });

    socket.on('call:ice', ({ callId, candidate }) => {
      const meta = io.activeCalls.get(callId);
      if (!meta || !candidate) return;
      const fromUserId = socket.data.user?.id;
      if (fromUserId !== meta.callerId && fromUserId !== meta.calleeId) return;
      const target = fromUserId === meta.callerId ? meta.calleeId : meta.callerId;
      safeRelay(target, 'call:ice', { callId, candidate });
    });

    socket.on('call:end', ({ callId, reason }) => {
      const meta = io.activeCalls.get(callId);
      if (!meta) return;
      const fromUserId = socket.data.user?.id;
      if (fromUserId !== meta.callerId && fromUserId !== meta.calleeId) return;
      endCallServer(callId, reason || 'ended', fromUserId);
    });

    socket.on('disconnect', () => {
      const userId = socket.data.user?.id;
      if (!userId || !io.activeCalls?.size) return;
      for (const [callId, meta] of [...io.activeCalls.entries()]) {
        if (meta.callerId === userId || meta.calleeId === userId) {
          endCallServer(callId, 'peer-disconnected', userId);
        }
      }
    });

    // Basic connection log
    if (socket.data?.user) {
      console.log("🔌 Socket connected:", socket.id, socket.data.user);
    } else {
      console.log("🔌 Socket connected without auth:", socket.id);
    }
    // ✅ Chat events
    socket.on("chat:message", (data) => io.to(data.to).emit("chat:message", data));

    // (Legacy webrtc:* signaling removed after migration to call:* events)

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

    // ✅ WebRTC signaling events (for useWebRTC.js compatibility)
    socket.on("webrtc:offer", ({ to, offer, from }) => {
      const fromId = from || socket.data.user?.id;
      console.log(`📞 WebRTC offer from ${fromId} to ${to}`);
      console.log(`📋 Room info - socket rooms:`, [...socket.rooms]);
      console.log(`📋 Target room exists:`, io.sockets.adapter.rooms.has(to));
      console.log(`📋 Target room size:`, io.sockets.adapter.rooms.get(to)?.size || 0);
      
      io.to(to).emit("webrtc:offer", {
        from: fromId,
        offer,
      });
      console.log(`📤 WebRTC offer sent to room ${to}`);
    });

    socket.on("webrtc:answer", ({ to, answer, from }) => {
      const fromId = from || socket.data.user?.id;
      console.log(`📞 WebRTC answer from ${fromId} to ${to}`);
      console.log(`📋 Target room exists:`, io.sockets.adapter.rooms.has(to));
      
      io.to(to).emit("webrtc:answer", {
        from: fromId,
        answer,
      });
      console.log(`📤 WebRTC answer sent to room ${to}`);
    });

    socket.on("webrtc:ice-candidate", ({ to, candidate, from }) => {
      const fromId = from || socket.data.user?.id;
      console.log(`📞 ICE candidate from ${fromId} to ${to}`);
      
      io.to(to).emit("webrtc:ice-candidate", {
        from: fromId,
        candidate,
      });
      console.log(`📤 ICE candidate sent to room ${to}`);
    });

    // ✅ User registration / join rooms
    socket.on("join", (userId) => {
      if (userId) {
        socket.join(userId);
        console.log(`🏠 User ${userId} joined room (socket: ${socket.id})`);
        console.log(`📋 Room ${userId} now has ${io.sockets.adapter.rooms.get(userId)?.size || 0} members`);
      }
    });

    socket.on("register", (data) => {
      const userId = data?.userId || data;
      if (userId) {
        socket.join(userId);
        console.log(`📝 User ${userId} registered to room (socket: ${socket.id})`);
      }
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
