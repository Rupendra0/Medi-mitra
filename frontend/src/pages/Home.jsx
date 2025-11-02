import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";

import { logoutSuccess } from '../utils/authSlice';
import api from '../utils/api';
import HomeAssistant from "../components/HomeAssistant";
import AnimatedButton from "../components/AnimatedButton";
import logo from "../logo.png";
import {
  FaUserFriends,
  FaUserMd,
  FaHeartbeat,
  FaShieldAlt,
  FaClinicMedical,
  FaChartLine,
  FaRobot
} from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const numberFormatter = new Intl.NumberFormat("en-IN");

function Home() {
  const { isAuthenticated, user, authStatus } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [stats, setStats] = useState({ patients: 0, doctors: 0, successfulAppointments: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await api.apiFetch("/api/auth/logout", { method: "POST" });
      dispatch(logoutSuccess());
    } catch (err) {
      console.error("Logout failed:", err);
      dispatch(logoutSuccess());
    }
  };

  // This function decides which buttons to show
  const renderAuthButtons = () => {
    // While checking the session, show a placeholder to prevent flicker
    if (authStatus === 'loading') {
      return <div style={{ height: '52px' }} />; // Placeholder with same height as buttons
    }

    if (isAuthenticated) {
      return (
        <>
          <Link to={user?.role === 'doctor' ? '/doctor' : '/patient'}>
            <AnimatedButton variant="primary" size="large">Go to Dashboard</AnimatedButton>
          </Link>
          <AnimatedButton variant="secondary" size="large" onClick={handleLogout}>Logout</AnimatedButton>
        </>
      );
    }

    // If logged out, show login and signup buttons
    return (
      <>
        <Link to="/login">
          <AnimatedButton variant="primary" size="large">Login</AnimatedButton>
        </Link>
        <Link to="/signup">
          <AnimatedButton variant="secondary" size="large">Sign Up</AnimatedButton>
        </Link>
      </>
    );
  };

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public-stats`);
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        if (active) {
          setStats({
            patients: data.patients ?? 0,
            doctors: data.doctors ?? 0,
            successfulAppointments: data.successfulAppointments ?? 0
          });
        }
      } catch (err) {
        console.warn("Stats request failed", err);
      } finally {
        if (active) setStatsLoading(false);
      }
    };
    loadStats();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)', minHeight: '100vh' }}>
      <section 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at top, rgba(0, 129, 112, 0.15) 0%, rgba(0, 91, 65, 0.1) 50%, rgba(15, 15, 15, 0.95) 100%)' }}
      >
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-center lg:text-left space-y-8"
            >
              <h1 
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 50%, #e0f2fe 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Accessible Healthcare at Your Fingertips
              </h1>
              <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto lg:mx-0">
                Connecting rural communities with expert doctors, ensuring no one is left behind.
              </p>
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4"
                style={{ alignItems: 'center' }}
              >
                {renderAuthButtons()}
              </div>
            </motion.div>
            {/* Right Content - Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.0, delay: 0.3 }}
              className="relative flex justify-center"
            >
              <div className="relative bg-white/5 backdrop-blur-2xl rounded-3xl p-8 border border-white/10">
                <img src={logo} alt="Medi Mitra Logo" className="w-72 h-72 lg:w-80 lg:h-80 object-contain"/>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 px-8" style={{ backgroundColor: 'rgba(0, 129, 112, 0.06)' }}>
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3">
          {[ 
            { label: "Patients Registered", value: stats.patients, icon: FaUserFriends },
            { label: "Doctors Onboarded", value: stats.doctors, icon: FaUserMd },
            { label: "Successful Consultations", value: stats.successfulAppointments, icon: FaHeartbeat }
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl p-6 shadow-lg flex flex-col gap-3"
              style={{
                background: 'linear-gradient(145deg, rgba(0, 129, 112, 0.22), rgba(0, 40, 35, 0.7))',
                border: '1px solid rgba(14, 246, 204, 0.25)',
                boxShadow: '0 25px 45px rgba(0, 129, 112, 0.18)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  display: 'inline-flex',
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  background: 'rgba(14, 246, 204, 0.15)',
                  border: '1px solid rgba(14, 246, 204, 0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0EF6CC',
                  fontSize: '1.3rem'
                }}>
                  {React.createElement(item.icon)}
                </span>
                <div style={{ color: '#a2f2df', fontSize: '0.95rem', letterSpacing: '0.03em' }}>{item.label}</div>
              </div>
              <div style={{ color: '#ffffff', fontSize: '2.4rem', fontWeight: 700 }}>
                {statsLoading ? '—' : numberFormatter.format(item.value)}
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-6xl mx-auto mt-12 grid gap-6 md:grid-cols-4">
          {[ 
            {
              title: "Govt ID Onboarding",
              description: "Run secure Bharat stack KYC so villagers can register once and book visits easily.",
              icon: FaShieldAlt
            },
            {
              title: "Village Queue Desk",
              description: "ASHA workers log symptoms and schedule calls while doctors handle the live consults.",
              icon: FaClinicMedical
            },
            {
              title: "Medicine Tracker",
              description: "Daily reminders and refill alerts ensure chronic patients never miss stock.",
              icon: FaChartLine
            },
            {
              title: "AI Dialer Support",
              description: "Gemini answers symptom queries and helps the team triage calls in local languages.",
              icon: FaRobot
            }
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl p-6"
              style={{
                background: 'linear-gradient(160deg, rgba(0, 129, 112, 0.22), rgba(0, 40, 35, 0.8))',
                border: '1px solid rgba(14, 246, 204, 0.18)',
                boxShadow: '0 20px 45px rgba(0, 129, 112, 0.2)',
                minHeight: '220px'
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(14, 246, 204, 0.18)',
                border: '1px solid rgba(14, 246, 204, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0EF6CC',
                marginBottom: '1.25rem',
                fontSize: '1.25rem'
              }}>
                {React.createElement(feature.icon)}
              </div>
              <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                {feature.title}
              </div>
              <p style={{ color: 'rgba(210, 250, 242, 0.85)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-8">
        <h2 className="text-3xl font-bold text-center mb-10" style={{ color: 'var(--color-primary)' }}>
          AI Health Assistant
        </h2>
        <HomeAssistant />
      </section>
    </div>
  );
}

export default Home;
