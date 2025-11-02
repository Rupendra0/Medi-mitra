import React, { useState } from 'react';
import { useLanguage } from '../utils/LanguageProvider';
import DashboardHeader from './DashboardHeader';
import ButtonBar from './ButtonBar'; // This will be used in the sidebar for mobile

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
          overflow: 'hidden'
        }}
      >
        {/* Backdrop for mobile to close the menu by clicking outside */}
        {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

        {/* Sidebar */}
        <aside className={`simple-sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
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
            <ButtonBar />
            <div style={{ marginTop: 10 }}>
              <SidebarLang />
            </div>
          </div>
        </aside>

        {/* Main Panel */}
        <main
          className="simple-main" // This class is for the mobile layout in CSS
          style={{
            flex: 1,
            padding: '0.5rem',
            background: '#1a1a1a',
            borderRadius: '8px',
            overflowY: 'auto',
            overflowX: 'hidden',
            height: '100%'
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
  const style = { padding: '6px 8px', borderRadius: 6, marginRight: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#fff', cursor: 'pointer' };
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button style={{ ...style, fontWeight: lang === 'en' ? 700 : 500 }} onClick={() => setLang('en')}>EN</button>
      <button style={{ ...style, fontWeight: lang === 'hi' ? 700 : 500 }} onClick={() => setLang('hi')}>हिंदी</button>
      <button style={{ ...style, fontWeight: lang === 'pa' ? 700 : 500 }} onClick={() => setLang('pa')}>ਪੰਜਾਬੀ</button>
    </div>
  );
}
