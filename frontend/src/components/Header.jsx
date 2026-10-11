import React from 'react';
import { Layers, Server, Cpu } from 'lucide-react';

export default function Header({ backendStatus, isChecking }) {
  return (
    <header className="header">
      <div className="container header-content">
        <div className="logo-group">
          <div className="docker-icon-badge">
            <Layers size={24} />
          </div>
          <div className="title-group">
            <h1>D.Y. Patil Hackathon</h1>
            <p>Full-Stack Containerized Application</p>
          </div>
        </div>

        <div className="header-badges">
          <div className="badge badge-docker">
            <Cpu size={14} />
            <span>Docker Ready</span>
          </div>

          <div className={`badge ${backendStatus === 'healthy' ? 'badge-online' : 'badge-offline'}`}>
            <span className="pulse-dot"></span>
            <span>
              {isChecking ? 'Checking API...' : backendStatus === 'healthy' ? 'API Online' : 'API Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
