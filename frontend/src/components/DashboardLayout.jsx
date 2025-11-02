import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../utils/LanguageProvider';
import DashboardHeader from './DashboardHeader';

export default function DashboardLayout({
  title,
  subtitle,
  currentUser,
  sidebarItems = [],
  activeKey,
  onSelect,
  onRefresh,
  quickActions = [],
  children
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // This function ensures the sidebar closes when a menu item is clicked
  const handleSelectItem = (key) => {
    onSelect(key);
    setIsSidebarOpen(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#111'
      }}
    >
      <DashboardHeader
        title={title}
        subtitle={subtitle}
        currentUser={currentUser}
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} // Pass the toggle function
        onRefresh={onRefresh || children?.props?.onRefresh}
        quickActions={quickActions}
      />
      
      <div
        className="dashboard-content" // This class is for the mobile layout in CSS
        style={{
          flex: 1,
          display: 'flex',
          padding: '0.5rem',
          gap: '0.5rem',
          overflow: 'hidden',
          minHeight: 0
        }}
      >
        {/* Backdrop for mobile to close the menu by clicking outside */}
        {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

        {/* Sidebar */}
        <aside className={`simple-sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-top-actions">
            <SidebarHomeButton />
          </div>
          <nav style={{ flex: 1 }}>
            <div className="sidebar-user-info">
              <h4>{currentUser?.name}</h4>
              <p>{currentUser?.uniqueId}</p>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sidebarItems.map(item => (
                <li key={item.key}>
                  <button
                    className={`simple-sidebar-btn${activeKey === item.key ? ' active' : ''}`}
                    onClick={() => handleSelectItem(item.key)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {/* Action buttons appear at the bottom of the mobile menu */}
          <div className="sidebar-actions">
            <SidebarLang />
          </div>
        </aside>

        {/* Main Panel */}
        <main
          className="simple-main" // This class is for the mobile layout in CSS
          style={{
            flex: 1,
            padding: '0.75rem',
            background: '#1a1a1a',
            borderRadius: '12px',
            overflowY: 'auto',
            minHeight: 0,
            minWidth: 0
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLang() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="sidebar-lang">
      <button type="button" className={`sidebar-lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => setLang('en')}>
        EN
      </button>
      <button type="button" className={`sidebar-lang-btn${lang === 'hi' ? ' active' : ''}`} onClick={() => setLang('hi')}>
        हिंदी
      </button>
      <button type="button" className={`sidebar-lang-btn${lang === 'pa' ? ' active' : ''}`} onClick={() => setLang('pa')}>
        ਪੰਜਾਬੀ
      </button>
    </div>
  );
}

function SidebarHomeButton() {
  const navigate = useNavigate();
  return (
    <button type="button" className="sidebar-home-btn" onClick={() => navigate('/')}>Home</button>
  );
}
