import React from "react";
import { useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

import { logoutSuccess } from '../utils/authSlice';
import api from '../utils/api';
import PillNav from "./PillNav";
import logo from "../logo.png";

function Navbar() {
  const location = useLocation();
  const dispatch = useDispatch();

  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    try {
      await api.apiFetch('/api/auth/logout', { method: "POST" });
      dispatch(logoutSuccess());
    } catch (err) {
      console.error("Logout failed:", err);
      dispatch(logoutSuccess());
    }
  };
  const navItems = [{ href: "/", label: "Home" }];
  if (isAuthenticated) {
    if (user?.role === "doctor") {
      navItems.push({ href: "/doctor", label: "Doctor Dashboard" });
    } else if (user?.role === "patient") {
      navItems.push({ href: "/patient", label: "Patient Dashboard" });
    }
    navItems.push({
      href: "#logout",
      label: "Logout",
      onClick: handleLogout,
    });
  } else {
    navItems.push({ href: "/login", label: "Login" });
    navItems.push({ href: "/signup", label: "Sign Up" });
  }

  return (
    <PillNav
      logo={logo}
      logoAlt="Medi Mitra Logo"
      items={navItems}
      activeHref={location.pathname}
      className="medi-mitra-nav"
      baseColor="#008170"
      pillColor="#fff"
      hoveredPillTextColor="#fff"
      pillTextColor="#008170"
      initialLoadAnimation={true}
    />
  );
}

export default Navbar;
