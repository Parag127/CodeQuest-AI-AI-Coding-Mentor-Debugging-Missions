import React, { useState } from 'react';
import { Activity, Server, Clock, HardDrive, RefreshCw, Box, Database, Plus, Trash2, Zap, Shield, Globe, Layers, Cpu, CheckCircle2 } from 'lucide-react';

export default function ShowcaseBrowser({ 
  health, 
  info, 
  isChecking, 
  onRefreshTelemetry, 
  items, 
  onAddItem, 
  onDeleteItem, 
  latency 
}) {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'crud' | 'topology' | 'security'
  const [newTitle, setNewTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('DevOps');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    await onAddItem(newTitle.trim(), selectedCategory);
    setNewTitle('');
    setIsSubmitting(false);
  };

  const filteredItems = filterCategory === 'All' 
    ? items 
    : items.filter(item => (item.category || 'General').toLowerCase() === filterCategory.toLowerCase());

  return (
    <section id="showcase" className="browser-showcase-section">
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <Activity size={14} />
            <span>Interactive System Console</span>
          </div>
          <h2 className="section-title">
            Containerized Telemetry & <br />
            <span className="hero-gradient-text">Live REST API Control</span>
          </h2>
          <p className="section-subtitle">
            Inspect container telemetry probes in real-time, execute live REST CRUD operations against the Express backend, 
            and visualize the internal Docker bridge network.
          </p>
        </div>

        {/* Tab Strip Switcher (Skilotech reference) */}
        <div className="showcase-tab-strip">
          <button 
            className={`tab-strip-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            <Activity size={16} />
            <span>Health & Telemetry</span>
          </button>
          <button 
            className={`tab-strip-btn ${activeTab === 'crud' ? 'active' : ''}`}
            onClick={() => setActiveTab('crud')}
          >
            <Database size={16} />
            <span>REST CRUD Pipeline ({items.length})</span>
          </button>
          <button 
            className={`tab-strip-btn ${activeTab === 'topology' ? 'active' : ''}`}
            onClick={() => setActiveTab('topology')}
          >
            <Box size={16} />
            <span>Docker Bridge Topology</span>
          </button>
          <button 
            className={`tab-strip-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={16} />
            <span>Sandbox Guard Posture</span>
          </button>
        </div>

        {/* Simulated Browser Window Frame (Skilotech reference) */}
        <div className="showcase-browser-window">
          {/* Browser Chrome Header */}
          <div className="browser-chrome">
            <div className="editor-dots">
              <span className="editor-dot dot-red"></span>
              <span className="editor-dot dot-yellow"></span>
              <span className="editor-dot dot-green"></span>
            </div>

            <div className="browser-url-pill">
              <Globe size={13} style={{ color: 'var(--brand-light)' }} />
              <span>
                https://codequest.dy-patil.internal/api/{activeTab === 'telemetry' ? 'health' : activeTab === 'crud' ? 'items' : 'orchestration'}
              </span>
            </div>

            <div>
              <button 
                onClick={onRefreshTelemetry}
                disabled={isChecking}
                className="btn btn-secondary btn-sm"
                title="Refresh API probe"
                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
              >
                <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
                <span>Probe</span>
              </button>
            </div>
          </div>

          {/* Browser Body Panel */}
          <div className="browser-body">
            {/* Tab 1: Live Health & Telemetry */}
            {activeTab === 'telemetry' && (
              <div className="telemetry-grid">
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Backend Status</span>
                    <span className={`pulse-dot ${health?.status === 'healthy' ? '' : 'offline'}`}></span>
                  </div>
                  <div className="metric-card-value" style={{ color: health?.status === 'healthy' ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    {health?.status ? health.status.toUpperCase() : 'OFFLINE'}
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Active probe on <code>/api/health</code> with Docker daemon check.
                  </p>
                </div>

                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Roundtrip Latency</span>
                    <Zap size={16} style={{ color: 'var(--cyan-accent)' }} />
                  </div>
                  <div className="metric-card-value" style={{ color: 'var(--cyan-accent)' }}>
                    {latency !== null ? `${latency} ms` : 'N/A'}
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Sub-millisecond internal bridge network communication.
                  </p>
                </div>

                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Memory Heap Usage</span>
                    <HardDrive size={16} style={{ color: 'var(--purple-accent)' }} />
                  </div>
                  <div className="metric-card-value" style={{ color: 'var(--purple-accent)' }}>
                    {health?.memoryUsageMB?.heapUsed ? `${health.memoryUsageMB.heapUsed} MB` : 'N/A'}
                  </div>
                  <div className="progress-bar-wrap">
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: health?.memoryUsageMB ? `${Math.min(100, Math.round((health.memoryUsageMB.heapUsed / health.memoryUsageMB.heapTotal) * 100))}%` : '35%' 
                      }}
                    ></div>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Total Heap: {health?.memoryUsageMB?.heapTotal || 'N/A'} MB | RSS: {health?.memoryUsageMB?.rss || 'N/A'} MB
                  </p>
                </div>

                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Backend Uptime</span>
                    <Clock size={16} style={{ color: 'var(--brand-light)' }} />
                  </div>
                  <div className="metric-card-value" style={{ color: 'var(--brand-light)' }}>
                    {health?.uptimeSeconds !== undefined ? `${health.uptimeSeconds}s` : 'N/A'}
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Continuous container uptime since orchestration bootstrap.
                  </p>
                </div>

                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Execution Context</span>
                    <Box size={16} style={{ color: '#38bdf8' }} />
                  </div>
                  <div className="metric-card-value" style={{ fontSize: '1.25rem' }}>
                    {health?.isDocker ? '🐳 Docker Container' : '💻 Local Process'}
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Host ID: <code>{info?.hostname || 'N/A'}</code> ({info?.platform || 'N/A'})
                  </p>
                </div>

                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Platform Runtime</span>
                    <Cpu size={16} style={{ color: 'var(--status-warning)' }} />
                  </div>
                  <div className="metric-card-value" style={{ fontSize: '1.25rem', color: 'var(--status-warning)' }}>
                    Node {info?.nodeVersion || 'v20'}
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    CPUs: {info?.cpus || 'Multi-core'} | Free Mem: {info?.freeMemoryMB || 'N/A'} MB
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: REST CRUD Pipeline */}
            {activeTab === 'crud' && (
              <div>
                {/* Form to create new task */}
                <form onSubmit={handleCreateItem} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="input-field"
                    style={{ flex: 1, minWidth: '240px', padding: '0.65rem 1rem', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
                    placeholder="Create a new sprint task or microservice target..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ padding: '0.65rem 1rem', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="DevOps">DevOps</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Product">Product</option>
                    <option value="AI / ML">AI / ML</option>
                    <option value="Security">Security</option>
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting || !newTitle.trim()}>
                    <Plus size={16} />
                    <span>{isSubmitting ? 'Posting...' : 'Add Item'}</span>
                  </button>
                </form>

                {/* Filter Category Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Filter:</span>
                  {['All', 'DevOps', 'Infrastructure', 'Product', 'AI / ML'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`badge ${filterCategory === cat ? 'badge-brand' : 'badge-neutral'}`}
                      style={{ cursor: 'pointer', border: '1px solid var(--border-primary)' }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Items List */}
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {filteredItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No items found in this category. Add one above!
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <div 
                        key={item.id} 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.25rem', background: 'var(--bg-glass)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', transition: 'all 0.2s ease' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <span className="badge badge-brand">
                            {item.category || 'General'}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {item.status || 'Active'}
                          </span>
                        </div>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          className="btn btn-danger btn-sm"
                          title="Delete from database"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Docker Bridge Topology */}
            {activeTab === 'topology' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', width: '100%' }}>
                  <div style={{ padding: '1.5rem', background: 'var(--bg-glass)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <Globe size={22} color="#60a5fa" />
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Frontend Service</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vite / Nginx Container</span>
                      </div>
                    </div>
                    <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7, listStyle: 'none' }}>
                      <li>• Port: <strong>5173</strong> (Dev) / <strong>3000</strong> (Prod)</li>
                      <li>• Multi-stage build with Alpine runtime</li>
                      <li>• Proxies <code>/api/*</code> to backend service</li>
                    </ul>
                  </div>

                  <div style={{ padding: '1.5rem', background: 'var(--bg-glass)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <Server size={22} color="#38bdf8" />
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Backend Service</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Node 20 Express Container</span>
                      </div>
                    </div>
                    <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7, listStyle: 'none' }}>
                      <li>• Port: <strong>5000</strong></li>
                      <li>• Automated Health Check Probe</li>
                      <li>• Non-root <code>node</code> user execution</li>
                    </ul>
                  </div>

                  <div style={{ padding: '1.5rem', background: 'var(--bg-glass)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <Shield size={22} color="#10b981" />
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Internal Network</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bridge: hackathon-network</span>
                      </div>
                    </div>
                    <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7, listStyle: 'none' }}>
                      <li>• Isolated internal service discovery</li>
                      <li>• Strict CORS whitelisting</li>
                      <li>• Volume bindings for dev hot-reload</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Security Posture */}
            {activeTab === 'security' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                <div style={{ padding: '1.25rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)', marginBottom: '0.5rem' }}>
                    <CheckCircle2 size={16} />
                    <strong style={{ fontSize: '0.85rem' }}>Zero Direct Shell Execution</strong>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Learner code is never evaluated in the raw host Node process. All submissions are quarantined in restricted runners.
                  </p>
                </div>

                <div style={{ padding: '1.25rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)', marginBottom: '0.5rem' }}>
                    <CheckCircle2 size={16} />
                    <strong style={{ fontSize: '0.85rem' }}>Hidden Test Anti-Leak Protection</strong>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Hidden test inputs and expected outputs are never delivered to the client DOM or sent to third-party AI models.
                  </p>
                </div>

                <div style={{ padding: '1.25rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)', marginBottom: '0.5rem' }}>
                    <CheckCircle2 size={16} />
                    <strong style={{ fontSize: '0.85rem' }}>Wall-Clock Timeout & Memory Limits</strong>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Execution requests enforce strict wall-clock time limits (2000ms) and memory constraints to prevent runaway recursion.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
