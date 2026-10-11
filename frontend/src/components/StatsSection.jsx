import React from 'react';

export default function StatsSection() {
  const stats = [
    { value: '99.9%', label: 'Container Service Reliability' },
    { value: '< 5ms', label: 'Average Bridge Latency' },
    { value: '100%', label: 'Sandbox Isolation & Non-Root' },
    { value: '3-Tier', label: 'Guarded Progressive Hints' }
  ];

  return (
    <section className="stats-section">
      <div className="container">
        <div className="stats-grid">
          {stats.map((s, idx) => (
            <div key={idx} className="stat-item">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
