import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import './PillNav.css';

const PillNav = ({
  logo,
  logoAlt = 'Logo',
  items = [],
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#008170',
  pillColor = '#fff',
  hoveredPillTextColor = '#fff',
  pillTextColor = '#2D3748',
  onMobileMenuClick,
  initialLoadAnimation = true
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const circleRefs = useRef([]);
  const tlRefs = useRef([]);
  const activeTweenRefs = useRef([]);
  const logoImgRef = useRef(null);
  const logoTweenRef = useRef(null);
  const hamburgerRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const navItemsRef = useRef(null);
  const logoRef = useRef(null);
  const containerRef = useRef(null);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Enhanced GSAP layout and animations
  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle, index) => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        
        // Enhanced mathematical calculation for perfect circles
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 4;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 2;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`,
          opacity: 0.8
        });

        const label = pill.querySelector('.pill-label');
        const hoverLabel = pill.querySelector('.pill-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (hoverLabel) gsap.set(hoverLabel, { y: h + 12, opacity: 0 });

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });

        // Enhanced animation sequence
        tl.to(circle, { 
          scale: 1.1, 
          xPercent: -50, 
          opacity: 1,
          duration: 0.4, 
          ease: 'power2.out'
        }, 0);

        if (label) {
          tl.to(label, { 
            y: -(h + 6), 
            duration: 0.4, 
            ease: 'power2.out' 
          }, 0);
        }

        if (hoverLabel) {
          gsap.set(hoverLabel, { y: Math.ceil(h + 20), opacity: 0 });
          tl.to(hoverLabel, { 
            y: 0, 
            opacity: 1, 
            duration: 0.4, 
            ease: 'power2.out' 
          }, 0);
        }

        tlRefs.current[index] = tl;
      });
    };

    layout();

    const onResize = () => layout();
    const resizeObserver = new ResizeObserver(onResize);
    
    if (navItemsRef.current) {
      resizeObserver.observe(navItemsRef.current);
    }

    window.addEventListener('resize', onResize);

    if (document.fonts?.ready) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    // Initial load animations
    if (initialLoadAnimation) {
      const timeline = gsap.timeline({ delay: 0.2 });

      if (logoRef.current) {
        gsap.set(logoRef.current, { scale: 0, rotation: -180 });
        timeline.to(logoRef.current, {
          scale: 1,
          rotation: 0,
          duration: 0.8,
          ease: 'back.out(1.7)'
        }, 0);
      }

      // Animate each pill individually instead of moving the whole container.
      if (navItemsRef.current) {
        const pills = Array.from(navItemsRef.current.querySelectorAll('.pill'));
        // Ensure container is visible so layout doesn't shift
        gsap.set(navItemsRef.current, { opacity: 1, y: 0 });

        if (pills.length > 0) {
          gsap.set(pills, { opacity: 0, y: -14 });
          timeline.to(pills, {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: 'power2.out',
            stagger: 0.06
          }, 0.2);
        }
      }
    }

    return () => {
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
    };
  }, [items, ease, initialLoadAnimation]);

  // Enhanced interaction handlers
  const handleEnter = useCallback((i) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  }, []);

  const handleLeave = useCallback((i) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.25,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  }, []);

  const handleLogoEnter = useCallback(() => {
    const img = logoImgRef.current;
    if (!img) return;
    
    logoTweenRef.current?.kill();
    logoTweenRef.current = gsap.to(img, {
      rotation: 360,
      scale: 1.1,
      duration: 0.6,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  }, []);

  const handleLogoLeave = useCallback(() => {
    const img = logoImgRef.current;
    if (!img) return;
    
    logoTweenRef.current?.kill();
    logoTweenRef.current = gsap.to(img, {
      rotation: 0,
      scale: 1,
      duration: 0.4,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  }, []);

  const toggleMobileMenu = useCallback(() => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);

    const hamburger = hamburgerRef.current;
    const menu = mobileMenuRef.current;

    if (hamburger) {
      if (newState) {
        hamburger.classList.add('active');
      } else {
        hamburger.classList.remove('active');
      }
    }

    if (menu) {
      if (newState) {
        menu.classList.add('active');
        gsap.fromTo(menu, 
          { 
            opacity: 0, 
            y: -10, 
            scale: 0.95,
            visibility: 'visible'
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.3,
            ease: 'power2.out'
          }
        );
      } else {
        gsap.to(menu, {
          opacity: 0,
          y: -10,
          scale: 0.95,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => {
            menu.classList.remove('active');
            gsap.set(menu, { visibility: 'hidden' });
          }
        });
      }
    }

    onMobileMenuClick?.();
  }, [isMobileMenuOpen, onMobileMenuClick]);

  // Close mobile menu on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isMobileMenuOpen && 
          mobileMenuRef.current && 
          !mobileMenuRef.current.contains(event.target) &&
          !hamburgerRef.current?.contains(event.target)) {
        toggleMobileMenu();
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isMobileMenuOpen, toggleMobileMenu]);

  const isExternalLink = (href) =>
    href?.startsWith('http://') ||
    href?.startsWith('https://') ||
    href?.startsWith('//') ||
    href?.startsWith('mailto:') ||
    href?.startsWith('tel:') ||
    href?.startsWith('#');

  const isRouterLink = (href) => href && !isExternalLink(href);

  const cssVars = {
    ['--base']: baseColor,
    ['--pill-bg']: pillColor,
    ['--hover-text']: hoveredPillTextColor,
    ['--pill-text']: pillTextColor
  };

  return (
    <div className="pill-nav-container">
      <nav 
        className={`pill-nav ${className} ${isScrolled ? 'scrolled' : ''}`} 
        aria-label="Primary Navigation" 
        style={cssVars}
        ref={containerRef}
      >
        {/* Left Zone - Logo */}
        <div className="pill-nav-left">
          {isRouterLink(items?.[0]?.href) ? (
            <Link
              className="pill-logo"
              to={items[0].href}
              aria-label="Home"
              onMouseEnter={handleLogoEnter}
              onMouseLeave={handleLogoLeave}
              onFocus={handleLogoEnter}
              onBlur={handleLogoLeave}
              ref={logoRef}
            >
              <img src={logo} alt={logoAlt} ref={logoImgRef} />
            </Link>
          ) : (
            <a
              className="pill-logo"
              href={items?.[0]?.href || '/'}
              aria-label="Home"
              onMouseEnter={handleLogoEnter}
              onMouseLeave={handleLogoLeave}
              onFocus={handleLogoEnter}
              onBlur={handleLogoLeave}
              ref={logoRef}
            >
              <img src={logo} alt={logoAlt} ref={logoImgRef} />
            </a>
          )}
        </div>

        {/* Center Zone - Navigation Pills */}
        <div className="pill-nav-center">
          <div className="pill-nav-items desktop-only" ref={navItemsRef}>
            <ul className="pill-list" role="menubar">
              {items && items.length > 0 && items.map((item, i) => (
                <li key={item.href || `item-${i}`} role="none">
                  {item.onClick ? (
                    <button
                      type="button"
                      className={`pill${activeHref === item.href ? ' is-active' : ''}`}
                      aria-label={item.ariaLabel || item.label}
                      onClick={item.onClick}
                      onMouseEnter={() => handleEnter(i)}
                      onMouseLeave={() => handleLeave(i)}
                      onFocus={() => handleEnter(i)}
                      onBlur={() => handleLeave(i)}
                      tabIndex={0}
                      style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
                    >
                      <span
                        className="hover-circle"
                        aria-hidden="true"
                        ref={el => {
                          circleRefs.current[i] = el;
                        }}
                      />
                      <span className="label-stack">
                        <span className="pill-label">{item.label}</span>
                        <span className="pill-label-hover" aria-hidden="true">
                          {item.label}
                        </span>
                      </span>
                    </button>
                  ) : isRouterLink(item.href) ? (
                    <Link
                      role="menuitem"
                      to={item.href}
                      className={`pill${activeHref === item.href ? ' is-active' : ''}`}
                      aria-label={item.ariaLabel || item.label}
                      aria-current={activeHref === item.href ? 'page' : undefined}
                      onMouseEnter={() => handleEnter(i)}
                      onMouseLeave={() => handleLeave(i)}
                      onFocus={() => handleEnter(i)}
                      onBlur={() => handleLeave(i)}
                      tabIndex={0}
                    >
                      <span
                        className="hover-circle"
                        aria-hidden="true"
                        ref={el => {
                          circleRefs.current[i] = el;
                        }}
                      />
                      <span className="label-stack">
                        <span className="pill-label">{item.label}</span>
                        <span className="pill-label-hover" aria-hidden="true">
                          {item.label}
                        </span>
                      </span>
                    </Link>
                  ) : (
                    <a
                      role="menuitem"
                      href={item.href}
                      className={`pill${activeHref === item.href ? ' is-active' : ''}`}
                      aria-label={item.ariaLabel || item.label}
                      aria-current={activeHref === item.href ? 'page' : undefined}
                      onMouseEnter={() => handleEnter(i)}
                      onMouseLeave={() => handleLeave(i)}
                      onFocus={() => handleEnter(i)}
                      onBlur={() => handleLeave(i)}
                      tabIndex={0}
                    >
                      <span
                        className="hover-circle"
                        aria-hidden="true"
                        ref={el => {
                          circleRefs.current[i] = el;
                        }}
                      />
                      <span className="label-stack">
                        <span className="pill-label">{item.label}</span>
                        <span className="pill-label-hover" aria-hidden="true">
                          {item.label}
                        </span>
                      </span>
                    </a>
                  )}
                </li>
              ))}
          </ul>
          </div>
        </div>

        {/* Right Zone - Mobile Menu */}
        <div className="pill-nav-right">
          <button
            className="mobile-menu-button mobile-only"
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            ref={hamburgerRef}
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Popover */}
      <div 
        className="mobile-menu-popover mobile-only" 
        ref={mobileMenuRef} 
        style={cssVars}
        id="mobile-menu"
        role="navigation"
        aria-label="Mobile Navigation"
      >
        <ul className="mobile-menu-list">
          {items && items.length > 0 && items.map((item, i) => (
            <li key={item.href || `mobile-item-${i}`}>
              {item.onClick ? (
                <button
                  type="button"
                  className={`mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`}
                  onClick={() => { item.onClick(); toggleMobileMenu(); }}
                  style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
                >
                  {item.label}
                </button>
              ) : isRouterLink(item.href) ? (
                <Link
                  to={item.href}
                  className={`mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`}
                  onClick={toggleMobileMenu}
                  aria-current={activeHref === item.href ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  href={item.href}
                  className={`mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`}
                  onClick={toggleMobileMenu}
                  aria-current={activeHref === item.href ? 'page' : undefined}
                >
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PillNav;