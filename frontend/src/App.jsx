import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import MarqueeStrip from './components/MarqueeStrip';
import MissionsSection from './components/MissionsSection';
import ShowcaseBrowser from './components/ShowcaseBrowser';
import InteractiveJourney from './components/InteractiveJourney';
import BentoGrid from './components/BentoGrid';
import DockerGuideCard from './components/DockerGuideCard';
import StatsSection from './components/StatsSection';
import CallToAction from './components/CallToAction';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import LoginPage from './pages/LoginPage';
import PracticePage from './pages/PracticePage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('codequest_theme') || 'dark';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('codequest_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentRoute, setCurrentRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.startsWith('/login') || hash.startsWith('#/login')) return 'login';
      if (path.startsWith('/editor') || path.startsWith('/practice') || hash.startsWith('#/editor') || hash.startsWith('#/practice')) return 'editor';
      return 'home';
    }
    return 'home';
  });

  const [selectedChallengeId, setSelectedChallengeId] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const navigateTo = (route, challengeId = null) => {
    setCurrentRoute(route);
    if (challengeId) {
      setSelectedChallengeId(challengeId);
    }
    if (route === 'login') {
      window.history.pushState({ page: 'login' }, '', '/login');
    } else if (route === 'editor') {
      window.history.pushState({ page: 'editor', challengeId }, '', '/editor');
    } else {
      window.history.pushState({ page: 'home' }, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.startsWith('/login') || hash.startsWith('#/login')) {
        setCurrentRoute('login');
      } else if (path.startsWith('/editor') || path.startsWith('/practice') || hash.startsWith('#/editor') || hash.startsWith('#/practice')) {
        setCurrentRoute('editor');
      } else {
        setCurrentRoute('home');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const [health, setHealth] = useState(null);
  const [info, setInfo] = useState(null);
  const [items, setItems] = useState([
    { id: 1, title: 'Dockerize Backend Service (Node.js 20)', category: 'DevOps', status: 'Completed' },
    { id: 2, title: 'Dockerize Frontend Client (Vite Nginx)', category: 'DevOps', status: 'Completed' },
    { id: 3, title: 'Configure Bridge Orchestration Network', category: 'Infrastructure', status: 'Completed' },
    { id: 4, title: 'Deploy CodeDNA AI Debugging Sandbox', category: 'Product', status: 'In Progress' }
  ]);
  const [isChecking, setIsChecking] = useState(true);
  const [latency, setLatency] = useState(null);

  // Sync theme with document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('codequest_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('codequest_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('codequest_user');
  };

  // Health and System Info Fetcher
  const fetchHealthAndInfo = useCallback(async () => {
    setIsChecking(true);
    const startTime = performance.now();
    try {
      const healthRes = await fetch(`${API_BASE}/api/health`);
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData);
        const endTime = performance.now();
        setLatency(Math.round(endTime - startTime));
      } else {
        setHealth({ status: 'standby' });
      }

      const infoRes = await fetch(`${API_BASE}/api/info`);
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setInfo(infoData);
      }
    } catch (err) {
      console.warn('Backend server currently in offline fallback mode:', err);
      setHealth({ 
        status: 'standby',
        environment: 'development',
        isDocker: false,
        uptimeSeconds: 120,
        memoryUsageMB: { rss: 42, heapTotal: 34, heapUsed: 19 }
      });
      setInfo({
        hostname: 'codequest-local-dev',
        platform: 'node',
        arch: 'x64',
        nodeVersion: 'v20.x',
        cpus: 4,
        totalMemoryMB: 16384,
        freeMemoryMB: 8192
      });
      setLatency(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // CRUD Items Fetcher
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/items`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setItems(data.data);
        }
      }
    } catch (err) {
      console.warn('Using local items fallback while backend connects:', err);
    }
  }, []);

  useEffect(() => {
    fetchHealthAndInfo();
    fetchItems();

    const interval = setInterval(() => {
      fetchHealthAndInfo();
    }, 12000);

    return () => clearInterval(interval);
  }, [fetchHealthAndInfo, fetchItems]);

  // Add Item to Backend CRUD
  const handleAddItem = async (title, category) => {
    try {
      const res = await fetch(`${API_BASE}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, status: 'Active' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setItems(prev => [data.data, ...prev]);
          return;
        }
      }
    } catch (err) {
      console.warn('Added item in optimistic mode:', err);
    }
    // Optimistic fallback
    const localItem = {
      id: Date.now(),
      title,
      category: category || 'General',
      status: 'Active',
      timestamp: new Date().toISOString()
    };
    setItems(prev => [localItem, ...prev]);
  };

  // Delete Item from Backend CRUD
  const handleDeleteItem = async (id) => {
    try {
      await fetch(`${API_BASE}/api/items/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Deleted item in optimistic mode:', err);
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleScrollToMissions = () => {
    const el = document.getElementById('missions');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScrollToArchitecture = () => {
    const el = document.getElementById('architecture');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // If on dedicated login page route
  if (currentRoute === 'login') {
    return (
      <LoginPage 
        onLoginSuccess={handleLoginSuccess}
        onNavigateHome={() => navigateTo('home')}
        theme={theme}
        onToggleTheme={toggleTheme}
        backendStatus={health?.status}
        latency={latency}
      />
    );
  }

  // If on dedicated full-screen Code Editor IDE page route
  if (currentRoute === 'editor') {
    return (
      <PracticePage 
        currentUser={currentUser}
        onNavigateHome={() => navigateTo('home')}
        theme={theme}
        onToggleTheme={toggleTheme}
        backendStatus={health?.status}
        latency={latency}
        initialChallengeId={selectedChallengeId}
      />
    );
  }

  return (
    <>
      {/* Ambient Floating Mesh Orbs (Skilotech reference) */}
      <div className="ambient-orb ambient-orb-1"></div>
      <div className="ambient-orb ambient-orb-2"></div>
      <div className="ambient-orb ambient-orb-3"></div>

      {/* High-tech Dot Matrix Background */}
      <div className="dot-grid-bg"></div>

      {/* Floating Island Glass Navbar with Login & Editor Triggers */}
      <Navbar 
        backendStatus={health?.status} 
        isChecking={isChecking} 
        latency={latency}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onNavigateLogin={() => navigateTo('login')}
        onNavigateEditor={() => navigateTo('editor')}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        {/* Hero Section with Typographic Watermark & macOS IDE */}
        <HeroSection 
          onStartMission={() => navigateTo('editor')} 
          onExploreDocker={handleScrollToArchitecture} 
        />

        {/* Tech Stack Infinite Marquee */}
        <MarqueeStrip />

        {/* Curated Missions Section (Links directly to Dedicated Code Editor) */}
        <MissionsSection 
          onLaunchMission={(challengeId) => navigateTo('editor', challengeId)}
        />

        {/* Browser Showcase: Live Telemetry, CRUD, Topology */}
        <ShowcaseBrowser 
          health={health} 
          info={info} 
          isChecking={isChecking} 
          onRefreshTelemetry={fetchHealthAndInfo}
          items={items}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          latency={latency}
        />

        {/* 4-Stage Pedagogical Workflow Journey */}
        <InteractiveJourney />

        {/* Architecture & Security Bento Grid */}
        <BentoGrid />

        {/* Docker Quickstart & Command Center */}
        <DockerGuideCard />

        {/* Impact Numbers & Performance Stats */}
        <StatsSection />

        {/* Call to Action Banner */}
        <CallToAction onStartMission={() => navigateTo('editor')} />
      </main>

      {/* Full Multi-Column Footer with Auth Portal Link */}
      <Footer 
        backendStatus={health?.status} 
        onNavigateLogin={() => navigateTo('login')}
        onNavigateEditor={() => navigateTo('editor')}
      />

      {/* Authentication & Login Modal (Skilotech-Inspired) */}
      <AuthModal 
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
