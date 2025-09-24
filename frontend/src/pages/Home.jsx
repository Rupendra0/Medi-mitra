import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";

import { logoutSuccess } from '../utils/authSlice';
import api from '../utils/api';
import HomeAssistant from "../components/HomeAssistant";
import AnimatedButton from "../components/AnimatedButton";
import logo from "../logo.png";

function Home() {
  const { isAuthenticated, user, authStatus } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

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
    if (authStatus === 'loading' || authStatus === 'idle') {
      return <div style={{ height: '52px' }} />; // Placeholder with same height as buttons
    }

    // If logged in, show dashboard and logout buttons
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
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
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
