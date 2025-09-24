import React from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logoutSuccess } from "../utils/authSlice"; // Adjust path if needed
import api from '../utils/api';

export function ProfileButton({ onClick }) {
  return (
    <button
      style={{
        cursor: "pointer",
        background: "#0ef6cc",
        color: "#222",
        border: "none",
        borderRadius: "8px",
        padding: "8px 16px",
        fontWeight: "bold",
        boxShadow: "0 2px 8px rgba(14, 246, 204, 0.5)",
        transition: "background 0.3s ease",
      }}
      onMouseEnter={(e) => (e.target.style.background = "#0cc9a8")}
      onMouseLeave={(e) => (e.target.style.background = "#0ef6cc")}
      onClick={onClick}
    >
      <span role="img" aria-label="profile"></span> Profile
    </button>
  );
}

export function LogoutButton() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogout = async () => {
    try {
      await api.apiFetch("/api/auth/logout", { method: "POST" });
      dispatch(logoutSuccess());
      navigate("/"); // Navigate to home after successful logout
    } catch (error) {
      console.error("Logout failed:", error);
      // Still force logout on frontend even if API fails
      dispatch(logoutSuccess());
      navigate("/");
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        cursor: "pointer",
        background: "#ff4d4f",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        padding: "8px 16px",
        fontWeight: "bold",
        boxShadow: "0 2px 8px rgba(255, 77, 79, 0.5)",
        transition: "background 0.3s ease",
      }}
      onMouseEnter={(e) => (e.target.style.background = "#d9363e")}
      onMouseLeave={(e) => (e.target.style.background = "#ff4d4f")}
    >
      Logout
    </button>
  );
}

export function LanguageSwitcher({ languages, current, onChange }) {
  return (
    <div className="lang-switcher">
      {languages && languages.map(lang => (
        <button
          key={lang.code}
          className={current === lang.code ? "active-lang" : ""}
          onClick={() => onChange(lang.code)}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}

export function ButtonBar({ languages, currentLanguage, onLanguageChange, onProfileClick }) {
  return (
    <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
      <LanguageSwitcher languages={languages} current={currentLanguage} onChange={onLanguageChange} />
      <ProfileButton onClick={onProfileClick} />
      <LogoutButton />
    </div>
  );
}
