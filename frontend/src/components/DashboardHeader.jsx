import React from 'react';
import { useLanguage } from '../utils/LanguageProvider';
import { Link } from 'react-router-dom';

// This small component defines the hamburger menu icon
const HamburgerButton = ({ onClick }) => (
  <button onClick={onClick} className="hamburger-btn">
    <svg viewBox="0 0 100 80" width="25" height="25" fill="#fff">
      <rect width="100" height="15" rx="8"></rect>
      <rect y="30" width="100" height="15" rx="8"></rect>
      <rect y="60" width="100" height="15" rx="8"></rect>
    </svg>
  </button>
);

// The props are now simplified to only what's needed
export default function DashboardHeader({ title, onMenuClick, onRefresh, quickActions = [], currentUser, subtitle }) {
  const { lang, setLang } = useLanguage();

  const smallBtn = {
    padding: '6px 8px',
    marginLeft: 6,
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12
  };

  return (
    <header className="dashboard-header" style={{ position: 'relative' }}>
      {/* Left Section */}
      <div className="header-left">
        <HamburgerButton onClick={onMenuClick} />
        <Link to="/" className="back-button">← Home</Link>
      </div>

      {/* Center Section - show provided title or derive from user role */}
      <div className="header-center">
        <div className="header-title">
          {title
            || (currentUser?.role === 'patient' ? 'Patient Dashboard'
              : (currentUser?.role === 'doctor' ? 'Doctor Dashboard' : 'Dashboard'))}
        </div>
        {subtitle && <div className="header-subtitle">{subtitle}</div>}
      </div>

      {/* Right Section - quick actions + refresh + language toggles */}
      <div className="header-right">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Quick action buttons */}
          {Array.isArray(quickActions) && quickActions.map((act, i) => (
            <button
              key={i}
              className={act.variant === 'primary' ? 'btn btn-primary' : (act.variant === 'outline' ? 'btn btn-outline' : 'btn btn-secondary')}
              onClick={(ev) => { ev.stopPropagation(); act.onClick && act.onClick(); }}
              style={{ marginRight: 8, padding: '6px 10px', fontSize: 12, minWidth: 120 }}
            >{act.label}</button>
          ))}

          <button style={{ ...smallBtn, fontWeight: lang === 'en' ? 700 : 500 }} onClick={() => setLang('en')}>EN</button>
          <button style={{ ...smallBtn, fontWeight: lang === 'hi' ? 700 : 500 }} onClick={() => setLang('hi')}>हिंदी</button>
          <button style={{ ...smallBtn, fontWeight: lang === 'pa' ? 700 : 500 }} onClick={() => setLang('pa')}>ਪੰਜਾਬੀ</button>
        </div>
      </div>
    </header>
  );
}
