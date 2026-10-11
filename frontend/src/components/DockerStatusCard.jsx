import React from 'react';
import { Activity, Server, Clock, HardDrive, RefreshCw, Box } from 'lucide-react';

export default function DockerStatusCard({ health, info, isChecking, onRefresh }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-icon" style={{ color: '#38bdf8' }}>
            <Activity size={20} />
          </div>
          <div>
            <h3>Backend Container Status</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Live telemetry via Express API
            </span>
          </div>
        </div>

        <button 
          className="btn btn-secondary btn-sm" 
          onClick={onRefresh}
          disabled={isChecking}
          title="Refresh metrics"
        >
          <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="metric-row">
        <span className="metric-label">Health Status</span>
        <span className="metric-value" style={{ color: health?.status === 'healthy' ? '#10b981' : '#f43f5e' }}>
          {health?.status ? health.status.toUpperCase() : 'DISCONNECTED'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Environment</span>
        <span className="metric-value">
          {health?.environment || 'N/A'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Container Mode</span>
        <span className="metric-value" style={{ color: '#38bdf8' }}>
          {health?.isDocker ? '🐳 Inside Docker Container' : '💻 Local Host Process'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Host / Container ID</span>
        <span className="metric-value">
          {info?.hostname || 'Unknown'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Platform / Arch</span>
        <span className="metric-value">
          {info?.platform ? `${info.platform} (${info.arch})` : 'N/A'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Memory Heap Used</span>
        <span className="metric-value">
          {health?.memoryUsageMB?.heapUsed ? `${health.memoryUsageMB.heapUsed} MB` : 'N/A'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Backend Uptime</span>
        <span className="metric-value">
          {health?.uptimeSeconds !== undefined ? `${health.uptimeSeconds} seconds` : 'N/A'}
        </span>
      </div>
    </div>
  );
}
