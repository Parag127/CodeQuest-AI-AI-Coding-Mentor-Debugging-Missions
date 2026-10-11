import React, { useState } from 'react';
import { Terminal, Copy, Check, Server, Globe, ShieldCheck, Box } from 'lucide-react';

export default function DockerGuideCard() {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const commands = [
    { label: 'Production Compose Up (Detached)', cmd: 'docker compose up --build -d' },
    { label: 'Development Live Reload (Hot HMR)', cmd: 'docker compose -f docker-compose.dev.yml up --build' },
    { label: 'Real-time Container Logs Stream', cmd: 'docker compose logs -f' },
    { label: 'Tear Down & Purge Bridge Network', cmd: 'docker compose down' }
  ];

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <section className="container" style={{ padding: '60px 1.5rem 30px' }}>
      <div className="section-header">
        <div className="section-badge">
          <Terminal size={14} />
          <span>Quickstart & CLI Reference</span>
        </div>
        <h2 className="section-title">
          Orchestration Command Center
        </h2>
        <p className="section-subtitle">
          Launch and manage the multi-container stack in seconds using Docker Desktop and Compose.
        </p>
      </div>

      <div className="bento-card" style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          <div style={{ background: 'var(--bg-glass)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', marginBottom: '0.4rem' }}>
              <Globe size={16} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Frontend Client</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Port <strong>5173</strong> (Dev) &bull; Port <strong>3000</strong> (Nginx Prod)
            </p>
          </div>

          <div style={{ background: 'var(--bg-glass)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.4rem' }}>
              <Server size={16} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Express API</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Port <strong>5000</strong> &bull; Health probe on <code>/api/health</code>
            </p>
          </div>

          <div style={{ background: 'var(--bg-glass)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.4rem' }}>
              <ShieldCheck size={16} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Docker Network</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Bridge network <code>hackathon-network</code>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {commands.map((item, idx) => (
            <div 
              key={idx} 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.15rem', background: '#070a12', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', fontFamily: 'var(--font-mono)' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
                  {item.cmd}
                </span>
              </div>
              <button 
                onClick={() => handleCopy(item.cmd, idx)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}
                title="Copy command"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check size={13} color="#10b981" />
                    <span style={{ color: '#10b981' }}>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
