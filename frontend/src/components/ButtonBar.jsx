import React from 'react';
import { Link } from 'react-router-dom';

const HamburgerButton = ({ onClick }) => (
  <button onClick={onClick} className="hamburger-btn">
    <svg viewBox="0 0 100 80" width="25" height="25" fill="#fff">
      <rect width="100" height="15" rx="8"></rect>
      <rect y="30" width="100" height="15" rx="8"></rect>
      <rect y="60" width="100" height="15" rx="8"></rect>
    </svg>
  </button>
);

export default function DashboardHeader({ title, onMenuClick }) {
  return (
    <header className="dashboard-header">
      {/* Left Section: Hamburger and Back Button */}
      <div className="header-left">
        <HamburgerButton onClick={onMenuClick} />
        <Link to="/" className="back-button">← Home</Link>
      </div>

      {/* Center Section: Title */}
      <div className="header-center">
        <div className="header-title">{title || 'Dashboard'}</div>
      </div>

      {/* Right Section: Kept for balance, but empty on mobile */}
      <div className="header-right"></div>
    </header>
  );
}
