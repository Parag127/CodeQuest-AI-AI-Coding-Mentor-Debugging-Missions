import React from 'react';
import { Layers, GitBranch, Globe, ExternalLink, Heart, ShieldCheck } from 'lucide-react';

export default function Footer({ backendStatus, onNavigateLogin }) {
  return (
    <footer className="footer-section">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Column */}
          <div className="footer-brand-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: 800, fontSize: '1.15rem' }}>
              <div className="brand-icon-box" style={{ width: '32px', height: '32px' }}>
                <Layers size={18} />
              </div>
              <span>CodeQuest <span style={{ color: 'var(--brand-light)' }}>AI</span></span>
            </div>

            <p className="footer-tagline">
              An AI-assisted debugging practice environment and containerized microservice suite 
              engineered for D.Y. Patil Hackathon 2026.
            </p>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="theme-toggle-btn" title="GitHub">
                <GitBranch size={16} />
              </a>
              <a href="#hero" className="theme-toggle-btn" title="Platform Portal">
                <Globe size={16} />
              </a>
              <a href="#architecture" className="theme-toggle-btn" title="Architecture Docs">
                <ExternalLink size={16} />
              </a>
            </div>
          </div>

          {/* Missions & Practice */}
          <div>
            <h4 className="footer-col-title">Debugging Missions</h4>
            <ul className="footer-links-list">
              <li className="footer-link-item"><a href="#missions">Off-by-One Traversal</a></li>
              <li className="footer-link-item"><a href="#missions">Null Safety Guards</a></li>
              <li className="footer-link-item"><a href="#missions">Case-Insensitive Palindromes</a></li>
              <li className="footer-link-item"><a href="#missions">Explain Before You Fix</a></li>
              <li className="footer-link-item"><a href="#missions">Bug Fingerprint Profiler</a></li>
            </ul>
          </div>

          {/* System & Architecture */}
          <div>
            <h4 className="footer-col-title">Architecture</h4>
            <ul className="footer-links-list">
              <li className="footer-link-item"><a href="#showcase">Express REST API Health</a></li>
              <li className="footer-link-item"><a href="#showcase">Vite + React 18 SPA</a></li>
              <li className="footer-link-item"><a href="#showcase">Docker Compose Bridge</a></li>
              <li className="footer-link-item"><a href="#architecture">Non-Root Sandbox Security</a></li>
              <li className="footer-link-item"><a href="#architecture">Hidden Test Guard</a></li>
            </ul>
          </div>

          {/* Hackathon Docs */}
          <div>
            <h4 className="footer-col-title">Hackathon Docs</h4>
            <ul className="footer-links-list">
              <li className="footer-link-item"><a href="#hero">D.Y. Patil Hackathon 2026</a></li>
              <li className="footer-link-item"><a href="#showcase">API Contract (/api/items)</a></li>
              <li className="footer-link-item">
                <button 
                  onClick={onNavigateLogin} 
                  style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', padding: 0, cursor: 'pointer' }}
                >
                  Authentication & Login Portal
                </button>
              </li>
              <li className="footer-link-item"><a href="#journey">4-Stage Learning Journey</a></li>
              <li className="footer-link-item"><a href="#architecture">Security & Quota Protocol</a></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="footer-bottom-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>&copy; {new Date().getFullYear()} CodeQuest AI &bull; D.Y. Patil Hackathon Starter.</span>
            <span style={{ color: 'var(--text-muted)' }}>All rights reserved.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
              <span className={`pulse-dot ${backendStatus === 'healthy' ? '' : 'offline'}`}></span>
              <span>Backend {backendStatus === 'healthy' ? 'Operational' : 'Offline'}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--status-success)' }}>
              <ShieldCheck size={14} />
              <span>Container Secure</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
