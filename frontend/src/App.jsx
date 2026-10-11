import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import DockerStatusCard from './components/DockerStatusCard';
import ApiTester from './components/ApiTester';
import DockerGuideCard from './components/DockerGuideCard';
import { Layers, CheckCircle2, Shield, Rocket } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [health, setHealth] = useState(null);
  const [info, setInfo] = useState(null);
  const [items, setItems] = useState([]);
  const [isChecking, setIsChecking] = useState(true);
  const [latency, setLatency] = useState(null);

  const fetchHealthAndInfo = useCallback(async () => {
    setIsChecking(true);
    const startTime = performance.now();
    try {
      // Direct call or proxied call
      const healthRes = await fetch(`${API_BASE}/api/health`);
      const healthData = await healthRes.json();
      setHealth(healthData);

      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));

      const infoRes = await fetch(`${API_BASE}/api/info`);
      const infoData = await infoRes.json();
      setInfo(infoData);
    } catch (err) {
      console.warn('Backend unavailable or starting:', err);
      setHealth({ status: 'offline' });
      setLatency(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/items`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (err) {
      console.warn('Error fetching items:', err);
    }
  }, []);

  useEffect(() => {
    fetchHealthAndInfo();
    fetchItems();

    const interval = setInterval(() => {
      fetchHealthAndInfo();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchHealthAndInfo, fetchItems]);

  const handleAddItem = async (title, category) => {
    try {
      const res = await fetch(`${API_BASE}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, status: 'Active' })
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => [data.data, ...prev]);
      }
    } catch (err) {
      console.error('Error adding item:', err);
      // Optimistic local add if backend offline
      setItems(prev => [{ id: Date.now(), title, category, status: 'Local (Offline)' }, ...prev]);
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      await fetch(`${API_BASE}/api/items/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Error deleting item:', err);
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  return (
    <>
      <Header backendStatus={health?.status} isChecking={isChecking} />

      <main className="container" style={{ flex: 1, paddingBottom: '3rem' }}>
        <section className="hero-section">
          <div className="hero-pill">
            <Rocket size={14} />
            <span>Hackathon Boilerplate Ready</span>
          </div>

          <h2 className="hero-title">
            Containerized <span className="hero-gradient-text">Full-Stack Architecture</span>
          </h2>

          <p className="hero-subtitle">
            Engineered for rapid deployment. Fully orchestrated with Node.js Express backend, 
            Vite React frontend, and Docker Compose networking.
          </p>

          <div className="grid-3" style={{ textAlign: 'left' }}>
            <div className="card arch-card">
              <div className="arch-header">
                <div className="arch-icon backend">
                  <Layers size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem' }}>Express Backend</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Node.js 20 Alpine</p>
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Lightweight container with non-root security, health check probes, CORS configuration, and REST API routes.
              </p>
            </div>

            <div className="card arch-card">
              <div className="arch-header">
                <div className="arch-icon frontend">
                  <Rocket size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem' }}>Vite React Frontend</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Multi-stage / Nginx</p>
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Production-optimized multi-stage build served via Nginx or live hot-reload in development mode.
              </p>
            </div>

            <div className="card arch-card">
              <div className="arch-header">
                <div className="arch-icon compose">
                  <Shield size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem' }}>Docker Compose</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Internal Bridge Network</p>
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Unified service orchestration with dependency management, automated healthchecks, and volume bindings.
              </p>
            </div>
          </div>
        </section>

        <section className="grid-2">
          <DockerStatusCard 
            health={health} 
            info={info} 
            isChecking={isChecking} 
            onRefresh={fetchHealthAndInfo} 
          />

          <ApiTester 
            items={items} 
            onAddItem={handleAddItem} 
            onDeleteItem={handleDeleteItem} 
            latency={latency} 
          />
        </section>

        <section>
          <DockerGuideCard />
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <p>© 2026 D.Y. Patil Hackathon | Dockerized Full-Stack Starter</p>
        </div>
      </footer>
    </>
  );
}
