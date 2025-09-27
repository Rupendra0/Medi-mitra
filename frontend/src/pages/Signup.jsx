import React, { useState, useRef } from "react";
import { io } from "socket.io-client";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../utils/authSlice';
import AnimatedButton from "../components/AnimatedButton";
import logo from "../logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Signup = () => {
  // Spotlight effect
  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: "50%", y: "50%" });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "patient",
    age: '',
    gender: '',
    bloodGroup: '',
    address: '',
    emergencyContact: '',
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Handle spotlight effect
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

  // Handle form change
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Handle signup
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError("An account with this email or phone already exists.");
        return;
      }
      if (!res.ok) throw new Error(data.message || "Signup failed");

      // Store token for shared socket client and persistence
      window.__AUTH_TOKEN = data.token;
      localStorage.setItem('authToken', data.token);

      // Update redux auth state immediately so overview shows data without refresh
      try {
        dispatch(loginSuccess({ user: data.user }));
      } catch (e) {
        // ignore if redux not available
      }

      // After signup → connect socket.io
      const socket = io(API_URL, { 
        withCredentials: true,
        auth: { token: data.token }
      });
      socket.emit("register", {
        userId: data.user?._id,
        role: data.user?.role,
      });

  window.dispatchEvent(new Event("user-updated"));
  // If patient, go to patient dashboard overview directly
  if (data.user?.role === 'patient') navigate('/patient');
  else navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen relative 
                 bg-[radial-gradient(ellipse_at_top,_rgba(0,129,112,0.15)_0%,_rgba(0,91,65,0.1)_50%,_rgba(15,15,15,0.95)_100%)]"
    >
      {/* Back to Home */}
      <Link
        to="/"
        className="absolute top-4 left-4 flex items-center gap-2 px-6 py-2 rounded-full 
                   text-base font-bold transition-all duration-300 shadow-md hover:shadow-lg
                   bg-gradient-to-r from-teal-400 to-emerald-400 text-[#01332a]
                   font-inter tracking-wide"
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

      {/* Signup Card */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full max-w-md"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(0, 129, 112, 0.15) 0%, rgba(0, 91, 65, 0.1) 50%, rgba(15, 15, 15, 0.95) 100%)',
          borderRadius: '1.5rem',
          border: '1.5px solid rgba(0, 129, 112, 0.4)',
          boxShadow: '0 20px 40px rgba(0,129,112,0.18)',
          overflow: 'hidden',
          padding: '2rem',
          position: 'relative',
          minHeight: '590px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* Spotlight overlay */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at var(--mouse-x,50%) var(--mouse-y,50%), var(--spotlight-color), transparent 80%)`,
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center rounded-full mb-4"
              style={{
                backgroundColor: '#0ef6cc22',
                width: '80px',
                height: '80px',
                margin: '0 auto',
                overflow: 'hidden',
              }}
            >
              <img
                src={logo}
                alt="Medi Mitra Logo"
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)',
                  display: 'block',
                }}
              />
            </div>

            <h2 className="text-3xl font-bold mb-2" style={{ color: '#0ef6cc' }}>Join Medi Mitra</h2>
            <p className="text-sm" style={{ color: '#b8fff7' }}>Create your account to access healthcare services</p>
          </div>

          {/* Form */}
          <form className="space-y-3" onSubmit={handleSubmit}>
            {/* Name */}
            <InputField
              label="Full Name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />

            {/* Email */}
            <InputField
              label="Email Address"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />

            {/* Phone */}
            <InputField
              label="Phone Number"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
              required
            />

            {/* Password */}
            <InputField
              label="Password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Create a strong password"
              required
            />

            {/* Role */}
            <div>
              <label className="block text-sm font-medium mb-2 text-teal-100/80">
                I am a:
              </label>
              <div className="flex gap-6">
                {["patient", "doctor"].map((role) => (
                  <label
                    key={role}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={form.role === role}
                      onChange={handleChange}
                      className="accent-teal-400"
                    />
                    <span className="text-sm text-teal-100">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Specialization */}
            {form.role === "doctor" && (
              <SelectField
                label="Specialization"
                name="specialization"
                value={form.specialization || ""}
                onChange={handleChange}
                placeholder="Specialization"
                options={[
                  "General Physician",
                  "Neurologist",
                  "Cardiologist",
                  "Gynecologist",
                  "Pediatrician",
                  "Orthopedic Surgeon",
                  "Dermatologist",
                  "Psychiatrist",
                  "Radiologist",
                  "Oncologist",
                  "ENT Specialist",
                  "Urologist",
                  "Anesthesiologist",
                  "Endocrinologist",
                  "Gastroenterologist",
                  "Nephrologist",
                  "Pulmonologist",
                  "Rheumatologist",
                  "Immunologist",
                  "Hematologist",
                  "Ophthalmologist",
                  "Pathologist",
                  "Plastic Surgeon",
                  "Vascular Surgeon",
                  "Infectious Disease Specialist",
                  "Allergist",
                  "Sports Medicine Specialist",
                  "Critical Care Specialist",
                  "Nuclear Medicine Specialist",
                  "Occupational Medicine Specialist",
                  "Rehabilitation Medicine Specialist",
                  "Sleep Medicine Specialist",
                  "Pain Management Specialist",
                ]}
                required
              />
            )}

            {/* Patient optional fields */}
            {form.role === 'patient' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Age"
                    type="number"
                    name="age"
                    value={form.age || ''}
                    onChange={handleChange}
                    placeholder="Optional"
                  />

                  <SelectField
                    label="Gender"
                    name="gender"
                    value={form.gender || ''}
                    onChange={handleChange}
                    options={["Male", "Female", "Other"]}
                    placeholder="Select gender"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Blood Group"
                    type="text"
                    name="bloodGroup"
                    value={form.bloodGroup || ''}
                    onChange={handleChange}
                    placeholder="Optional e.g. A+"
                  />

                  <InputField
                    label="Emergency Contact"
                    type="tel"
                    name="emergencyContact"
                    value={form.emergencyContact || ''}
                    onChange={handleChange}
                    placeholder="Optional phone"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-teal-100/80">Address</label>
                  <textarea
                    name="address"
                    value={form.address || ''}
                    onChange={handleChange}
                    placeholder="Optional"
                    className="w-full max-w-full p-3 rounded-lg border-2 border-teal-400/30 bg-slate-800/70 text-teal-50 placeholder-gray-400 focus:border-teal-400 transition-all duration-200 resize-none box-border"
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-900/40 text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-center">
              <AnimatedButton
                type="submit"
                variant="primary"
                size="full"
                disabled={loading}
              >
                <span>🎉</span>
                {loading ? "Creating..." : "Create Account"}
              </AnimatedButton>
            </div>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-teal-100/80 mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-teal-300 font-medium hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

/* 🔹 Small Reusable Input Component */
const InputField = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-2 text-teal-100/80">
      {label}
    </label>
    <input
      {...props}
      className="w-full max-w-full box-border p-3 rounded-lg border-2 border-teal-400/30 bg-slate-800/70 
                 text-teal-50 placeholder-gray-400 focus:border-teal-400 
                 transition-all duration-200"
    />
  </div>
);

/* 🔹 Small Reusable Select Component */
const SelectField = ({ label, options, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-2 text-teal-100/80">
      {label}
    </label>
    <select
      {...props}
      className="w-full max-w-full box-border p-3 rounded-lg border-2 border-teal-400/30 bg-slate-800/70 
                 text-teal-50 focus:border-teal-400 transition-all duration-200"
    >
      <option value="">{props.placeholder || `Select ${label}`}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

export default Signup;
