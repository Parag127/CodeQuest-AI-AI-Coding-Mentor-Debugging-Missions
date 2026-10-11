import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Shield, Sparkles, CheckCircle2, AlertCircle, Layers, X, LogIn } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [selectedRole, setSelectedRole] = useState('learner'); // 'learner' | 'reviewer'
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    if (authMode === 'register' && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = authMode === 'login' 
        ? { email: email.trim(), password: password.trim(), role: selectedRole }
        : { name: name.trim(), email: email.trim(), password: password.trim(), role: selectedRole };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(`Welcome back, ${data.user.name}!`);
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 600);
      } else {
        setErrorMessage(data.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      console.warn('Backend offline, using fallback authentication:', err);
      // Graceful offline fallback for hackathon showcase
      const fallbackUser = {
        id: Date.now(),
        name: name.trim() || email.split('@')[0] || 'Hackathon Learner',
        email: email.trim(),
        role: selectedRole,
        avatar: (name || email).substring(0, 2).toUpperCase(),
        level: selectedRole === 'learner' ? 'Level 4 • Bug Hunter' : 'Lead Reviewer',
        xp: 1450
      };
      setSuccessMessage(`Welcome, ${fallbackUser.name}! (Offline Demo Mode)`);
      setTimeout(() => {
        onLoginSuccess(fallbackUser);
        onClose();
      }, 600);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-click Demo Logins
  const handleQuickLogin = (role) => {
    if (role === 'learner') {
      setEmail('learner@dypatil.edu');
      setPassword('password123');
      setSelectedRole('learner');
      setAuthMode('login');
    } else {
      setEmail('mentor@dypatil.edu');
      setPassword('password123');
      setSelectedRole('reviewer');
      setAuthMode('login');
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      {/* Background orbs inside overlay */}
      <div className="ambient-orb ambient-orb-1" style={{ opacity: 0.2 }}></div>
      <div className="ambient-orb ambient-orb-2" style={{ opacity: 0.15 }}></div>

      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="auth-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        {/* Brand Header */}
        <div className="auth-header">
          <div className="brand-icon-box" style={{ width: '44px', height: '44px', margin: '0 auto 0.75rem' }}>
            <Layers size={22} />
          </div>
          <h2 className="auth-title">
            {authMode === 'login' ? 'Sign In to CodeQuest' : 'Create Free Account'}
          </h2>
          <p className="auth-subtitle">
            {authMode === 'login' 
              ? 'Access your sandboxed missions, cognitive hints, and bug fingerprint.'
              : 'Join the D.Y. Patil Hackathon practice ecosystem today.'}
          </p>
        </div>

        {/* Dual Role Segmented Switcher (Skilotech reference) */}
        <div className="dual-role-bar">
          <button 
            type="button"
            className={`dual-role-btn ${selectedRole === 'learner' ? 'active' : ''}`}
            onClick={() => setSelectedRole('learner')}
          >
            <span>💻 Learner / Engineer</span>
          </button>
          <button 
            type="button"
            className={`dual-role-btn ${selectedRole === 'reviewer' ? 'active' : ''}`}
            onClick={() => setSelectedRole('reviewer')}
          >
            <span>🎓 Lead Reviewer</span>
          </button>
        </div>

        {/* 1-Click Quick Demo Login Row */}
        <div style={{ marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
            ⚡ 1-Click Quick Demo Access:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.74rem', padding: '0.4rem 0.5rem', justifyContent: 'center' }}
              onClick={() => handleQuickLogin('learner')}
            >
              <span>Demo Learner</span>
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.74rem', padding: '0.4rem 0.5rem', justifyContent: 'center' }}
              onClick={() => handleQuickLogin('reviewer')}
            >
              <span>Demo Reviewer</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="auth-alert error">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-alert success">
            <CheckCircle2 size={15} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {authMode === 'register' && (
            <div className="auth-input-group">
              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Parag Patil"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-input-group">
            <label className="auth-label">Email Address</label>
            <div className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                className="auth-input"
                placeholder="learner@dypatil.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="auth-label">Password</label>
              {authMode === 'login' && (
                <a href="#forgot" onClick={(e) => e.preventDefault()} style={{ fontSize: '0.72rem', color: 'var(--brand-light)' }}>
                  Forgot password?
                </a>
              )}
            </div>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--brand)' }}
            />
            <label htmlFor="remember" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Remember this session for 30 days
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            <span>{isLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In to CodeQuest' : 'Create Account'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Footer Toggle between Sign In & Sign Up */}
        <div className="auth-card-footer">
          {authMode === 'login' ? (
            <p>
              Don't have an account yet?{' '}
              <button 
                type="button" 
                className="auth-switch-link"
                onClick={() => { setAuthMode('register'); setErrorMessage(''); }}
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button 
                type="button" 
                className="auth-switch-link"
                onClick={() => { setAuthMode('login'); setErrorMessage(''); }}
              >
                Sign in to your account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
