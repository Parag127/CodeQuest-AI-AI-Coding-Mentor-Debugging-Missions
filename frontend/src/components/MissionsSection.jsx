import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Code2, ShieldCheck, Terminal, Award } from 'lucide-react';
import { getApiBase } from '../config/api';

const API_BASE = getApiBase();

const DEFAULT_MISSIONS = [
  {
    id: 'largest-number',
    title: 'Find the largest number',
    difficulty: 'easy',
    concept: 'Loop Boundary',
    languages: ['JavaScript', 'Java 21'],
    summary: 'Debug an off-by-one traversal error where the loop misses the final element in the array.'
  },
  {
    id: 'reverse-string',
    title: 'Reverse a String',
    difficulty: 'easy',
    concept: 'String Reversal',
    languages: ['JavaScript', 'Java 21'],
    summary: 'Inspect standard input buffer reads and reverse text without creating memory bottlenecks.'
  },
  {
    id: 'sum-positive',
    title: 'Sum Positive Numbers',
    difficulty: 'easy',
    concept: 'Array Conditions',
    languages: ['JavaScript', 'Java 21'],
    summary: 'Prevent runtime crashes on empty input streams and filter positive integers reliably.'
  }
];

export default function MissionsSection({ onLaunchMission }) {
  const [missions, setMissions] = useState(DEFAULT_MISSIONS);

  useEffect(() => {
    async function loadMissions() {
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/challenges`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const json = await res.json();
          const items = json.challenges || json.data || [];
          if (Array.isArray(items) && items.length > 0) {
            setMissions(items.map(m => ({
              id: m.id,
              title: m.title,
              difficulty: m.difficulty || 'easy',
              concept: (m.concept || 'Debugging').replace(/_/g, ' '),
              languages: ['JavaScript', 'Java 21'],
              summary: m.description || DEFAULT_MISSIONS.find(d => d.id === m.id)?.summary || 'Practice targeted algorithmic debugging.'
            })));
          }
        }
      } catch (err) {
        // Fallback already in place
      }
    }
    loadMissions();
  }, []);

  return (
    <section id="missions" className="missions-preview-section">
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <Sparkles size={14} />
            <span>Curated Debugging Missions</span>
          </div>
          <h2 className="section-title">
            Select Your Challenge. <br />
            <span className="hero-gradient-text">Practice in Dedicated IDE.</span>
          </h2>
          <p className="section-subtitle">
            Every mission runs in a dedicated full-screen developer workspace with progressive hints, 
            mandatory hypothesis gates, and real-time AST bug classification.
          </p>
        </div>

        <div className="missions-grid">
          {missions.map((mission, index) => (
            <div key={mission.id} className="mission-card">
              <div className="mission-card-header">
                <div className="mission-card-tag">
                  <Terminal size={13} color="var(--cyan-accent)" />
                  <span>Mission 0{index + 1}</span>
                </div>
                <span className="badge badge-warning" style={{ textTransform: 'uppercase', fontSize: '0.68rem' }}>
                  {mission.difficulty}
                </span>
              </div>

              <h3 className="mission-card-title">{mission.title}</h3>
              <p className="mission-card-desc">{mission.summary}</p>

              <div className="mission-card-meta">
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-brand" style={{ fontSize: '0.65rem' }}>
                    {mission.concept}
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                    JS & Java 21
                  </span>
                </div>
              </div>

              <button 
                className="btn btn-primary mission-card-btn"
                onClick={() => onLaunchMission(mission.id)}
              >
                <span>Launch in Code Editor</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
