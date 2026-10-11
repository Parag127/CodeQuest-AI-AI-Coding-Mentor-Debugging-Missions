import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import MarqueeStrip from './components/MarqueeStrip';
import MissionsSection from './components/MissionsSection';
import InteractiveJourney from './components/InteractiveJourney';
import BentoGrid from './components/BentoGrid';
import StatsSection from './components/StatsSection';
import CallToAction from './components/CallToAction';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import LoginPage from './pages/LoginPage';
import PracticePage from './pages/PracticePage';
import { getApiBase } from './config/api';

const API_BASE = getApiBase();

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('debugmate_theme') || 'dark';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('debugmate_user');
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
    // Check if redirected from Google OAuth flow
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('google_auth') === 'success') {
        const userParam = urlParams.get('user');
        if (userParam) {
          try {
            const parsedUser = JSON.parse(decodeURIComponent(userParam));
            setCurrentUser(parsedUser);
            localStorage.setItem('debugmate_user', JSON.stringify(parsedUser));
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            console.warn('Failed to parse Google user parameter:', e);
          }
        }
      }
    }

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
  const [isChecking, setIsChecking] = useState(true);
  const [latency, setLatency] = useState(null);

  // Sync theme with document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('debugmate_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('debugmate_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('debugmate_user');
  };

  // Health and System Info Fetcher
  const fetchHealthAndInfo = useCallback(async () => {
    setIsChecking(true);
    const startTime = performance.now();
    const base = getApiBase();
    try {
      const healthRes = await fetch(`${base}/api/health`);
      const healthType = healthRes.headers.get('content-type') || '';
      if (healthRes.ok && healthType.includes('application/json')) {
        const healthData = await healthRes.json();
        setHealth(healthData);
        const endTime = performance.now();
        setLatency(Math.round(endTime - startTime));
      } else {
        setHealth({ status: 'standby' });
      }

      const infoRes = await fetch(`${base}/api/info`);
      const infoType = infoRes.headers.get('content-type') || '';
      if (infoRes.ok && infoType.includes('application/json')) {
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
        hostname: 'debugmate-local-dev',
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

  useEffect(() => {
    fetchHealthAndInfo();

    const interval = setInterval(() => {
      fetchHealthAndInfo();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchHealthAndInfo]);

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

        {/* 4-Stage Pedagogical Workflow Journey */}
        <InteractiveJourney />

        {/* Architecture & Security Bento Grid */}
        <BentoGrid />

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
