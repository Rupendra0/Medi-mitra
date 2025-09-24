import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch } from 'react-redux';
import { io } from "socket.io-client";

import { loginSuccess } from '../utils/authSlice';
import api from '../utils/api';
import AnimatedButton from "../components/AnimatedButton";
import logo from "../logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: emailOrPhone, password }),
      });

      if (!res.ok) {
        throw new Error(res.data?.message || 'Login failed');
      }
      dispatch(loginSuccess({ user: res.data.user }));

      const socket = io(API_URL, {
        withCredentials: true,
        auth: { token: res.data.token },
      });

      socket.emit("register", {
        userId: res.data.user?._id,
        role: res.data.user?.role,
      });
      
      window.dispatchEvent(new Event("user-updated"));
      navigate("/");

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen relative"
      style={{
        background: "radial-gradient(ellipse at top, rgba(0, 129, 112, 0.15) 0%, rgba(0, 91, 65, 0.1) 50%, rgba(15, 15, 15, 0.95) 100%)",
      }}
    >
      <Link
        to="/"
        className="absolute top-4 left-4 flex items-center gap-2 px-6 py-2 rounded-full shadow-md hover:shadow-lg transition-all duration-300 text-base font-bold"
        style={{
          background: "linear-gradient(135deg, #0ef6cc 0%, #1eebc9 100%)",
          color: "#01332a",
          fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
          letterSpacing: "0.02em",
          textShadow: "0 1px 8px #0ef6cc88, 0 0 2px #fff",
          border: "none",
          outline: "none",
          boxShadow: "0 0 16px #0ef6cc88",
        }}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Home
      </Link>

      <div
        className="w-full max-w-md"
        style={{
          background: "radial-gradient(ellipse at top, rgba(0, 129, 112, 0.15) 0%, rgba(0, 91, 65, 0.1) 50%, rgba(15, 15, 15, 0.95) 100%)",
          borderRadius: "1.5rem",
          border: "1.5px solid rgba(0, 129, 112, 0.4)",
          boxShadow: "0 20px 40px rgba(0,129,112,0.18)",
          overflow: "hidden",
          padding: "2rem",
          position: "relative",
          minHeight: "590px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div className="relative z-10">
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center rounded-full mb-4"
              style={{
                backgroundColor: "#0ef6cc22",
                width: "80px",
                height: "80px",
                margin: "0 auto",
                overflow: "hidden",
              }}
            >
              <img
                src={logo}
                alt="Medi Mitra Logo"
                style={{
                  width: "120px",
                  height: "120px",
                  objectFit: "contain",
                  filter: "brightness(0) invert(1)",
                  display: "block",
                }}
              />
            </div>
            <h2
              className="text-3xl font-bold mb-2"
              style={{ color: "#0ef6cc" }}
            >
              Welcome Back
            </h2>
            <p className="text-sm" style={{ color: "#b8fff7" }}>
              Sign in to access your health dashboard
            </p>
          </div>

          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "#b8fff7" }}
            >
              Email or Phone
            </label>
            <input
              type="text"
              placeholder="Enter your email or phone"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              className="w-full p-3 rounded-lg border-2"
              style={{
                backgroundColor: "rgba(35,45,63,0.8)",
                borderColor: "#0ef6cc55",
                color: "#e0f7f3",
              }}
            />
          </div>

          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "#b8fff7" }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg border-2"
              style={{
                backgroundColor: "rgba(35,45,63,0.8)",
                borderColor: "#0ef6cc55",
                color: "#e0f7f3",
              }}
            />
          </div>

          {error && (
            <div className="mb-4 p-2 rounded-lg" style={{ backgroundColor: "#2d1a1a", color: "#ffb4b4" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <AnimatedButton
              onClick={handleLogin}
              variant="primary"
              size="full"
              disabled={loading}
            >
              <span>🔓</span>
              {loading ? "Logging in..." : "Login"}
            </AnimatedButton>
          </div>

          <div className="text-center mt-6">
            <p className="text-sm" style={{ color: "#b8fff7" }}>
              Don't have an account?{" "}
              <Link
                to="/signup"
                style={{ color: "#0ef6cc" }}
                className="font-medium hover:underline"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
