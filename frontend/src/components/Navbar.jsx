import React, { useState, useEffect } from 'react';
import { Layers, Moon, Sun, ArrowRight, LogIn, LogOut, User, Zap } from 'lucide-react';
import { GoogleIcon } from './GoogleAuthButton';

export default function Navbar({ 
  backendStatus, 
  isChecking, 
  latency, 
  theme, 
  onToggleTheme,
  currentUser,
  onOpenAuthModal,
  onNavigateLogin,
  onNavigateEditor,
  onLogout
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className={`island-nav ${isScrolled ? 'scrolled' : ''}`}>
      <div className="nav-inner">
        {/* Brand Group */}
        <a href="#hero" className="nav-brand" onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }}>
          <div className="brand-icon-box">
            <Layers size={20} />
          </div>
          <div>
            <span>DebugMate</span>
          </div>
        </a>

        {/* Center Nav Links */}
        <div className="nav-center-links">
          <button className="nav-link" onClick={onNavigateEditor} style={{ color: 'var(--brand-light)', fontWeight: 600 }}>
            Code Editor
          </button>
          <button className="nav-link" onClick={() => scrollToSection('missions')}>
            Missions
          </button>
          <button className="nav-link" onClick={() => scrollToSection('journey')}>
            How It Works
          </button>
          <button className="nav-link" onClick={() => scrollToSection('architecture')}>
            Architecture
          </button>
        </div>

        {/* Right Action Group */}
        <div className="nav-right-actions">
          {/* Theme Toggle Button */}
          <button 
            className="theme-toggle-btn" 
            onClick={onToggleTheme} 
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Authentication Action Group */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="user-profile-pill" title={`Logged in as ${currentUser.email}${currentUser.authProvider === 'google' ? ' (Google OAuth)' : ''}`}>
                <span className="user-profile-avatar">{currentUser.avatar || 'U'}</span>
                <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.name}
                </span>
                {currentUser.authProvider === 'google' && (
                  <span className="google-pill-badge" title="Verified Google Account">
                    <GoogleIcon size={12} />
                  </span>
                )}
                <span className="badge badge-brand" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                  {currentUser.role === 'reviewer' ? 'Mentor' : 'Lvl 4'}
                </span>
              </div>
              <button 
                onClick={onLogout}
                className="theme-toggle-btn"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onNavigateLogin || onOpenAuthModal}
              title="Sign In to DebugMate"
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
          )}

          {/* Primary Action Button */}
          <button 
            className="btn btn-primary btn-sm"
            onClick={onNavigateEditor}
          >
            <span>Code Editor</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
