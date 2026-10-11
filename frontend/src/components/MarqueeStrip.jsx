import React from 'react';
import { Box, Layers, Server, Shield, Cpu, Terminal, Zap, Code, Database } from 'lucide-react';

export default function MarqueeStrip() {
  const techStack = [
    { name: 'Docker Compose v2', icon: Box, color: '#38bdf8' },
    { name: 'Express REST API', icon: Server, color: '#60a5fa' },
    { name: 'Node.js 20 Alpine', icon: Terminal, color: '#10b981' },
    { name: 'Vite 5 + React 18', icon: Zap, color: '#a855f7' },
    { name: 'Nginx Reverse Proxy', icon: Layers, color: '#06b6d4' },
    { name: 'Java 21 Debug Runner', icon: Code, color: '#f59e0b' },
    { name: 'JavaScript Sandbox', icon: Code, color: '#eab308' },
    { name: 'AI Bug Fingerprint', icon: Cpu, color: '#ec4899' },
    { name: 'Non-Root Container Guard', icon: Shield, color: '#10b981' },
    { name: 'In-Memory CRUD Store', icon: Database, color: '#6366f1' },
  ];

  return (
    <section className="marquee-section">
      <div className="marquee-title">
        POWERED BY CONTAINERIZED CLOUD ARCHITECTURE & MODERN STACK
      </div>

      <div className="marquee-container">
        {/* Gradient edge masks for seamless endless scroll */}
        <div className="marquee-mask-left"></div>
        <div className="marquee-mask-right"></div>

        {/* Double-buffered marquee track */}
        <div className="marquee-track">
          {techStack.concat(techStack).map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="marquee-badge">
                <Icon size={16} style={{ color: item.color }} />
                <span>{item.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
