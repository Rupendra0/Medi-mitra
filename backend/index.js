import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mainRoutes from "./routes/main.js";
import protectedRoutes from "./routes/protected.js";
import Appointment from "./models/Appointment.js";
import authRoutes from "./routes/auth.js";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import initSocket from "./services/socket.js";
import Ragroutes from "./routes/ragRoutes.js";
import os from "os";   // ✅ Added to detect IPv4

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medimitra';
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB", mongoose.connection.name))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("⚠️ Server will continue without MongoDB connection");
  });

// ✅ CORS config - Allow frontend development server
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
}));

app.use(bodyParser.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", mainRoutes);
app.use("/api", protectedRoutes);
app.use("/api", Ragroutes);

// Gemini agent
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.get("/", (req, res) => {
  res.status(200).json({
    "message": "Hey from backend of Medi-mitra",
    "ServerHealth": "Excellent"
  });
});

app.post("/api/gemini-agent", async (req, res) => {
  const { query } = req.body;
  const prompt = `
You are a simple healthcare assistant for rural patients in Nabha, Punjab.
- Respond in the same language as the query (English, Hindi, Punjabi).
- Reply short, clear, and friendly.
- Use Markdown with these sections:
  1. Possible Causes
  2. Basic Precautions
  3. Simple Home/Traditional Remedies
  4. Common OTC Medicines
  5. When to See a Doctor
  6. Serious Warning Signs

Patient says: "${query}"
`;
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response.text();
    res.json({ reply: response });
  } catch {
    res.status(500).json({ reply: "AI से जवाब नहीं मिला। कृपया बाद में प्रयास करें।" });
  }
});

// ✅ Socket.io setup
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
});
app.set("io", io);

// Init sockets
initSocket(io);

// Appointment completion
app.post("/api/appointments/complete", async (req, res) => {
  const { appointmentId } = req.body;
  try {
    const appointment = await Appointment.findByIdAndUpdate(appointmentId, { status: "completed" });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    io.to(appointment.doctor.toString()).emit("queue:update", { appointmentId });
    res.status(200).json({ message: "Appointment marked as completed" });
  } catch {
    res.status(500).json({ message: "Failed to mark appointment as completed" });
  }
});

// ✅ Get system IPv4 automatically
function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
});
