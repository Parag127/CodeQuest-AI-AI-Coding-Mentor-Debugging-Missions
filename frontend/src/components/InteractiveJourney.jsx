import React, { useState } from 'react';
import { Terminal, Brain, Unlock, Award, ArrowRight, ArrowLeft, CheckCircle2, Shield, Code, Sparkles } from 'lucide-react';

const JOURNEY_STEPS = [
  {
    stepNum: '01',
    label: 'Identify Bug',
    title: 'Inspect Sandboxed Test Failures',
    desc: 'Learners start with authentic broken code in either Java 21 or modern JavaScript. The test runner executes public test cases and signals hidden edge-case failures without leaking solution data.',
    tag: 'Step 01 • Diagnostics',
    visualIcon: Code,
    visualContent: {
      type: 'code',
      header: 'Broken Loop Traversal',
      detail: 'Array boundary violation at index i = arr.length'
    }
  },
  {
    stepNum: '02',
    label: 'Cognitive Gate',
    title: 'Explain Before You Fix',
    desc: 'Before any code can be re-executed, the learner must pass through the cognitive gate. Articulating their hypothesis breaks the guessing habit and builds real algorithmic reasoning.',
    tag: 'Step 02 • Reasoning Gate',
    visualIcon: Brain,
    visualContent: {
      type: 'reasoning',
      header: 'Cognitive Checkpoint',
      detail: 'Learner hypothesis: "The termination condition must be strict less-than rather than less-than-or-equal."'
    }
  },
  {
    stepNum: '03',
    label: 'Hint Ladder',
    title: '3-Tier Progressive Hints',
    desc: 'When stuck, learners escalate through three guarded hint tiers: Conceptual Direction, Location Pinpoint, and Logic Blueprint. Direct copy-paste code is strictly prohibited.',
    tag: 'Step 03 • AI Guidance',
    visualIcon: Unlock,
    visualContent: {
      type: 'hints',
      header: 'Guarded Progressive Ladder',
      detail: 'Tier 1 Concept → Tier 2 Location → Tier 3 Logic Blueprint'
    }
  },
  {
    stepNum: '04',
    label: 'Mastery Profile',
    title: 'Bug Fingerprint & Telemetry',
    desc: 'CodeDNA tracks recurring mistake tendencies across missions (Off-by-one, Null Unchecked, State Mutation). Learners build an authentic engineering profile ready for job placements.',
    tag: 'Step 04 • Continuous Mastery',
    visualIcon: Award,
    visualContent: {
      type: 'profile',
      header: 'Bug Fingerprint Radar',
      detail: '92% Boundary Accuracy • Verified Clean Execution'
    }
  }
];

export default function InteractiveJourney() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const currentStep = JOURNEY_STEPS[activeStepIndex];

  const handleNext = () => {
    setActiveStepIndex((prev) => (prev + 1) % JOURNEY_STEPS.length);
  };

  const handlePrev = () => {
    setActiveStepIndex((prev) => (prev - 1 + JOURNEY_STEPS.length) % JOURNEY_STEPS.length);
  };

  const progressPercent = Math.round(((activeStepIndex + 1) / JOURNEY_STEPS.length) * 100);

  return (
    <section id="journey" className="journey-section">
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <Sparkles size={14} />
            <span>The CodeDNA Philosophy</span>
          </div>
          <h2 className="section-title">
            The 4-Stage Debugging <br />
            <span className="hero-gradient-text">Mastery Workflow</span>
          </h2>
          <p className="section-subtitle">
            A research-backed pedagogical loop designed to transform trial-and-error coders into methodical engineers.
          </p>
        </div>

        <div className="journey-grid">
          {/* Column 1: Vertical Interactive Timeline (Skilotech reference) */}
          <div className="timeline-col">
            <div className="timeline-track-line"></div>
            <div 
              className="timeline-progress-fill" 
              style={{ height: `${(activeStepIndex / (JOURNEY_STEPS.length - 1)) * 340}px` }}
            ></div>

            {JOURNEY_STEPS.map((step, idx) => (
              <button
                key={step.stepNum}
                className={`timeline-step-btn ${activeStepIndex === idx ? 'active' : ''}`}
                onClick={() => setActiveStepIndex(idx)}
              >
                <div className="step-node">
                  {idx < activeStepIndex ? '✓' : step.stepNum}
                </div>
                <span className="step-label-text">{step.label}</span>
              </button>
            ))}
          </div>

          {/* Column 2: Dynamic Visual Showcase Card */}
          <div className="journey-visual-card">
            <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.25rem' }}>
              <div 
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: 'var(--radius-xl)', 
                  background: 'var(--accent-gradient)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#fff',
                  boxShadow: '0 8px 24px var(--brand-glow)' 
                }}
              >
                <currentStep.visualIcon size={32} />
              </div>

              <div>
                <span className="badge badge-brand" style={{ marginBottom: '0.5rem' }}>
                  {currentStep.visualContent.header}
                </span>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.4rem', color: 'var(--text-primary)' }}>
                  {currentStep.title}
                </h4>
              </div>

              <div 
                style={{ 
                  background: 'var(--bg-glass)', 
                  border: '1px solid var(--border-primary)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '1rem', 
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)'
                }}
              >
                {currentStep.visualContent.detail}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--status-success)', fontSize: '0.75rem' }}>
                <CheckCircle2 size={14} />
                <span>Verified in Java & JavaScript Environments</span>
              </div>
            </div>
          </div>

          {/* Column 3: Detailed Step Content Card */}
          <div className="journey-content-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span className="journey-step-tag">{currentStep.tag}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {progressPercent}% Complete
                </span>
              </div>

              <div className="progress-bar-wrap" style={{ marginBottom: '1.5rem' }}>
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>

              <h3 className="journey-step-title">{currentStep.title}</h3>
              <p className="journey-step-desc">{currentStep.desc}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid var(--border-primary)' }}>
              <button 
                onClick={handlePrev} 
                className="btn btn-secondary btn-sm"
                disabled={activeStepIndex === 0}
              >
                <ArrowLeft size={14} />
                <span>Prev Step</span>
              </button>

              <button 
                onClick={handleNext} 
                className="btn btn-primary btn-sm"
              >
                <span>{activeStepIndex === JOURNEY_STEPS.length - 1 ? 'Back to Start' : 'Next Step'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
