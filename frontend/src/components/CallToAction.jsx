import React from 'react';
import { Rocket, GitBranch, ArrowRight, Sparkles } from 'lucide-react';

export default function CallToAction({ onStartMission }) {
  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-box">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-full)', background: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.3)', color: 'var(--brand-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '1.25rem' }}>
            <Sparkles size={13} />
            <span>D.Y. Patil Hackathon Prototype</span>
          </div>

          <h2 className="cta-title">
            Ready to Debug Like a <br />
            <span className="hero-gradient-text">Production Engineer?</span>
          </h2>

          <p className="cta-desc">
            Stop relying on AI code generation to solve what you don't understand. 
            Test your intuition against real-world debugging challenges, build your cognitive fingerprint, 
            and deploy containerized services with confidence.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={onStartMission}>
              <span>Start Debugging Mission</span>
              <Rocket size={18} />
            </button>

            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-secondary btn-lg"
            >
              <GitBranch size={18} />
              <span>Explore GitHub Repo</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
