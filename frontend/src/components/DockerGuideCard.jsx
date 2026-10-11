import React, { useState } from 'react';
import { Terminal, Copy, Check, Server, Globe, ShieldCheck } from 'lucide-react';

export default function DockerGuideCard() {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const commands = [
    { label: 'Start Stack (Production / Compose)', cmd: 'docker compose up --build -d' },
    { label: 'Start Stack (Dev Mode with Live Reload)', cmd: 'docker compose -f docker-compose.dev.yml up --build' },
    { label: 'View Realtime Container Logs', cmd: 'docker compose logs -f' },
    { label: 'Stop and Clean Containers', cmd: 'docker compose down' }
  ];

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-icon" style={{ color: '#c084fc' }}>
            <Terminal size={20} />
          </div>
          <div>
            <h3>Docker Architecture & Commands</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Multi-container orchestration setup
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', marginBottom: '0.35rem' }}>
            <Globe size={16} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Frontend Container</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Vite / Nginx on port <strong>5173</strong> (or 80)
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.35rem' }}>
            <Server size={16} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Backend Container</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Node.js Express on port <strong>5000</strong>
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.35rem' }}>
            <ShieldCheck size={16} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Isolated Network</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Bridge network <code>hackathon-network</code>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {commands.map((item, idx) => (
          <div key={idx} className="code-container" style={{ margin: 0 }}>
            <div className="code-header">
              <span>{item.label}</span>
              <button 
                onClick={() => handleCopy(item.cmd, idx)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                {copiedIndex === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="code-content">{item.cmd}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
