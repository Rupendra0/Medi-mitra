import React, { useState, useRef } from "react";
import { useEffect } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import ReactMarkdown from "react-markdown";
import AnimatedButton from "./AnimatedButton";
import logo from "../logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function HomeAssistant() {
  const [user, setUser] = useState(null);
  React.useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, { credentials: "include" })
      .then(res => res.json())
      .then(data => setUser(data.user))
      .catch(() => setUser(null));
    const handleUserUpdated = () => {
      fetch(`${API_URL}/api/auth/me`, { credentials: "include" })
        .then(res => res.json())
        .then(data => setUser(data.user))
        .catch(() => setUser(null));
    };
    window.addEventListener("user-updated", handleUserUpdated);
    return () => {
      window.removeEventListener("user-updated", handleUserUpdated);
    };
  }, []);
  // Socket.io and WebRTC setup
  const [socket, setSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Connect to Socket.io server
    const s = io(API_URL);
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  // Start video call (basic demo)
  const startVideoCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      const p = new Peer({ initiator: true, trickle: false, stream });
      setPeer(p);
      p.on("signal", data => {
        socket.emit("webrtc-signal", data);
      });
      socket.on("webrtc-signal", signal => {
        p.signal(signal);
      });
      p.on("stream", remote => {
        setRemoteStream(remote);
        if (videoRef.current) {
          videoRef.current.srcObject = remote;
        }
      });
    } catch (err) {
      alert("Could not start video call: " + err.message);
    }
  };
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cardRef = useRef(null);

  // For spotlight effect
  const [mousePos, setMousePos] = useState({ x: "50%", y: "50%" });

  const handleMouseMove = (e) => {
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x: `${x}%`, y: `${y}%` });
    cardRef.current.style.setProperty("--mouse-x", `${x}%`);
    cardRef.current.style.setProperty("--mouse-y", `${y}%`);
  };

  const handleMouseLeave = () => {
    setMousePos({ x: "50%", y: "50%" });
    cardRef.current.style.setProperty("--mouse-x", "50%");
    cardRef.current.style.setProperty("--mouse-y", "50%");
  };

  const handleSubmit = async () => {
    if (!query.trim()) {
      setError("कृपया अपने लक्षण बताएं / Please describe your symptoms.");
      return;
    }
    setLoading(true);
    setError("");
    setResponse("");
    try {
      const res = await fetch(`${API_URL}/api/gemini-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setResponse(data.reply || "AI से कोई उत्तर प्राप्त नहीं हुआ।");
    } catch (err) {
      setError("कुछ गलत हो गया है। कृपया फिर से प्रयास करें।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="max-w-2xl mx-auto"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(0, 129, 112, 0.15) 0%, rgba(0, 91, 65, 0.1) 50%, rgba(15, 15, 15, 0.95) 100%)",
        borderRadius: "1.5rem",
        border: "1.5px solid rgba(0, 129, 112, 0.4)",
        boxShadow: "0 20px 40px rgba(0,129,112,0.18)",
        overflow: "hidden",
        padding: "2rem",
        transition: "all 0.3s ease",
        position: "relative",
        cursor: "pointer",
        "--mouse-x": mousePos.x,
        "--mouse-y": mousePos.y,
        "--spotlight-color": "rgba(0, 129, 112, 0.3)",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Spotlight effect */}
      <div
        style={{
          content: "''",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: "1.5rem",
          pointerEvents: "none",
          opacity: 1,
          zIndex: 1,
          transition: "opacity 0.5s ease",
          background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), var(--spotlight-color, rgba(0,129,112,0.3)), transparent 80%)`,
        }}
      />
      <div className="relative z-10">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4 gap-3">
            <img
              src={logo}
              alt="Medi Mitra Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain"
              style={{
                filter:
                  "brightness(0) saturate(100%) invert(69%) sepia(36%) saturate(2394%) hue-rotate(130deg) brightness(101%) contrast(96%)",
                flexShrink: 0,
              }}
              loading="lazy"
            />
            <h2
              className="text-2xl sm:text-3xl md:text-3xl font-bold"
              style={{ color: "#fff" }}
            >
              AI Health Assistant
            </h2>
          </div>
          <p style={{ color: "#e0f7f3", marginBottom: "2rem" }}>
            Ask me anything about your health concerns, symptoms, or get medical
            advice.
          </p>
        </div>

        <div className="space-y-4">
          {/* Video call button removed for all roles */}
          {remoteStream && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: '100%', borderRadius: '1rem', marginBottom: '1rem', border: '2px solid #0ef6cc' }}
            />
          )}
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe your symptoms in detail... (हिंदी में भी लिख सकते हैं)"
            rows="4"
            className="w-full p-4 rounded-lg border-2 resize-none transition-all duration-200"
            style={{
              backgroundColor: "rgba(35,45,63,0.8)",
              borderColor: "#0ef6cc55",
              color: "#e0f7f3",
            }}
          />

          {error && (
            <div
              className="p-3 rounded-lg"
              style={{
                backgroundColor: "#2d1a1a",
                color: "#ffb4b4",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{ display: "flex", justifyContent: "center", width: "100%" }}
          >
            <AnimatedButton
              onClick={handleSubmit}
              disabled={loading}
              variant="primary"
              size="large"
            >
              {loading ? (
                <>
                  Processing...
                </>
              ) : (
                <>
                  <span role="img" aria-label="search">
                    
                  </span>
                  Analyze Symptoms
                </>
              )}
            </AnimatedButton>
          </div>

          {response && (
            <div
              className="mt-6 p-4 rounded-lg"
              style={{
                backgroundColor: "rgba(35,45,63,0.8)",
                color: "#b8fff7",
                border: "1px solid #0ef6cc55",
                boxShadow: "0 0 12px #0ef6cc33",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                  fontWeight: "600",
                }}
              >
                <span>🩺</span>
                <strong>AI Health Analysis:</strong>
              </div>
              <div
                style={{
                  lineHeight: 1.6,
                  fontSize: "0.95rem",
                }}
              >
                <ReactMarkdown>{response}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
