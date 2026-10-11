import React from 'react';
import { Shield, Zap, Code, Lock, Server, Cpu, Layers } from 'lucide-react';

export default function BentoGrid() {
  return (
    <section id="architecture" className="bento-section">
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <Layers size={14} />
            <span>Architecture & Security</span>
          </div>
          <h2 className="section-title">
            Engineered for Resilient <br />
            <span className="hero-gradient-text">Container Isolation</span>
          </h2>
          <p className="section-subtitle">
            Built from the ground up for strict sandboxed security compliance, dual-language execution parity, 
            and zero shell leakage.
          </p>
        </div>

        <div className="bento-grid">
          {/* Bento Card 1 (Span 2) */}
          <div className="bento-card bento-span-2">
            <div>
              <div className="bento-icon-box" style={{ color: '#10b981' }}>
                <Shield size={22} />
              </div>
              <h3 className="bento-title">Zero Direct Shell Execution & Non-Root Security</h3>
              <p className="bento-desc">
                Learner code is quarantined away from the Express Node process. 
                Containers run under unprivileged <code>node</code> user accounts with strict 2000ms wall-clock timeouts, 
                memory boundaries, and disabled network access to prevent escape vulnerabilities.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="badge badge-success">Non-Root User: Node</span>
              <span className="badge badge-success">Wall-Clock Timeout: 2.0s</span>
              <span className="badge badge-success">Isolated Network Bridge</span>
            </div>
          </div>

          {/* Bento Card 2 */}
          <div className="bento-card">
            <div>
              <div className="bento-icon-box" style={{ color: '#38bdf8' }}>
                <Zap size={22} />
              </div>
              <h3 className="bento-title">Vite 5 & Nginx Multi-Stage</h3>
              <p className="bento-desc">
                Instant hot-module reload during local development, combined with an optimized multi-stage 
                Nginx production Dockerfile delivering static assets in sub-10ms response windows.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <span className="badge badge-brand">HMR Enabled &bull; Alpine Base</span>
            </div>
          </div>

          {/* Bento Card 3 */}
          <div className="bento-card">
            <div>
              <div className="bento-icon-box" style={{ color: '#f59e0b' }}>
                <Code size={22} />
              </div>
              <h3 className="bento-title">Java 21 & JavaScript Parity</h3>
              <p className="bento-desc">
                Both enterprise Java (OpenJDK 21) and modern JavaScript (ES2024) challenges share identical 
                test assertions, input schemas, and telemetry formats defined in our unified API contract.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <span className="badge badge-warning">Dual-Engine Parity</span>
            </div>
          </div>

          {/* Bento Card 4 (Span 2) */}
          <div className="bento-card bento-span-2">
            <div>
              <div className="bento-icon-box" style={{ color: '#a855f7' }}>
                <Lock size={22} />
              </div>
              <h3 className="bento-title">Anti-Leak Hidden Test Protocol</h3>
              <p className="bento-desc">
                Hidden test cases test real edge cases (overflows, empty sets, negative numbers) without ever 
                exposing expected outputs or inputs to the browser client or AI completion prompts. 
                Learners receive genuine binary evaluation without solution leakage.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="badge badge-brand">Cryptographic Opaque IDs</span>
              <span className="badge badge-brand">Zero Client Exposure</span>
              <span className="badge badge-brand">Cognitive Gate Required</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
