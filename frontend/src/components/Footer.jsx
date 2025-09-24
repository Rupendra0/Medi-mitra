import React from "react";
import logo from "../logo.png";

function Footer() {
  return (
    <footer style={{ 
      backgroundColor: 'var(--color-footer-bg)', 
      color: 'var(--color-footer-text)',
      padding: '3rem 2rem 2rem',
      marginTop: 'auto'
    }}>
      <div style={{ 
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Brand Section */}
        <div>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <img 
              src={logo} 
              alt="Medi Mitra Logo" 
              style={{ 
                height: '98px', 
                width: 'auto',
                filter: 'brightness(0) saturate(100%) invert(69%) sepia(36%) saturate(2394%) hue-rotate(130deg) brightness(101%) contrast(96%)'
              }} 
            />
            <h3 style={{ 
              fontSize: '1.25rem',
              fontWeight: '700',
              color: 'var(--color-footer-text)',
              margin: 0
            }}>
              Medi Mitra
            </h3>
          </div>
          <p style={{ 
            color: 'var(--color-footer-text)',
            opacity: 0.9,
            lineHeight: 1.6,
            margin: 0
          }}>
            Connecting rural communities with quality healthcare through innovative telemedicine solutions.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={{ 
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--color-footer-text)',
            marginBottom: '1rem'
          }}>
            Quick Links
          </h4>
          <ul style={{ 
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <a href="/" style={{ 
                color: 'var(--color-footer-link)',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}>
                Home
              </a>
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <a href="/login" style={{ 
                color: 'var(--color-footer-link)',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}>
                Patient Login
              </a>
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <a href="/doctor" style={{ 
                color: 'var(--color-footer-link)',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}>
                Doctor Portal
              </a>
            </li>
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h4 style={{ 
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--color-footer-text)',
            marginBottom: '1rem'
          }}>
            Contact
          </h4>
          <div style={{ color: 'var(--color-footer-text)', opacity: 0.9 }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>📍 Nabha, Punjab, India</p>
            <p style={{ margin: '0 0 0.5rem 0' }}>📞 +91 12345 67890</p>
            <p style={{ margin: 0 }}>✉️ support@medimitra.com</p>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div style={{ 
        borderTop: '1px solid var(--color-medium-shade)',
        paddingTop: '1.5rem',
        textAlign: 'center'
      }}>
        <p style={{ 
          color: 'var(--color-footer-text)',
          opacity: 0.8,
          margin: 0,
          fontSize: '0.875rem'
        }}>
          © 2025 Medi Mitra. All rights reserved. | Empowering rural healthcare through technology.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
