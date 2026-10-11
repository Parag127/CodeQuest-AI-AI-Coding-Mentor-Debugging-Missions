import React, { useState } from 'react';
import { Rocket, ShieldCheck, Play, CheckCircle2, AlertCircle, Sparkles, Brain, ArrowRight, Code } from 'lucide-react';

export default function HeroSection({ onStartMission, onExploreDocker }) {
  const [activeLang, setActiveLang] = useState('js');
  const [isRunningSim, setIsRunningSim] = useState(false);
  const [testRunCompleted, setTestRunCompleted] = useState(false);

  const jsSnippet = `// Mission: Fix off-by-one traversal
function findTargetPair(arr, target) {
  let seen = new Map();
  for (let i = 0; i <= arr.length; i++) { // 🚨 Off-by-one bug
    let diff = target - arr[i];
    if (seen.has(diff)) {
      return [seen.get(diff), i];
    }
    seen.set(arr[i], i);
  }
  return null;
}`;

  const javaSnippet = `// Mission: Fix off-by-one traversal
public static int[] findTargetPair(int[] arr, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i <= arr.length; i++) { // 🚨 Array index bug
        int diff = target - arr[i];
        if (seen.containsKey(diff)) {
            return new int[]{seen.get(diff), i};
        }
        seen.put(arr[i], i);
    }
    return null;
}`;

  const handleSimulateRun = () => {
    setIsRunningSim(true);
    setTestRunCompleted(false);
    setTimeout(() => {
      setIsRunningSim(false);
      setTestRunCompleted(true);
    }, 900);
  };

  return (
    <section id="hero" className="hero-section">
      {/* Background Typographic Watermark (Skilotech signature) */}
      <div className="hero-watermark">
        DEBUGMATE
      </div>

      <div className="container">
        {/* Chapter Label Divider */}
        <div className="chapter-label">
          <div className="chapter-line"></div>
          <span className="chapter-text">Chapter 01 : The Next-Gen Debugging Ecosystem</span>
          <div className="chapter-line"></div>
        </div>

        <div className="hero-grid">
          {/* Left Text Column */}
          <div className="hero-text-side">
            <div className="hero-pill-badge">
              <Sparkles size={14} className="hero-pill-sparkle" />
              <span>D.Y. Patil Hackathon 2026 • AI Mentor & Sandbox</span>
            </div>

            <h1 className="hero-title">
              Crack Complex Bugs. <br />
              <span className="hero-gradient-text">Master System Architecture.</span>
            </h1>

            <p className="hero-subtitle">
              Engineered for learners to develop real-world problem-solving intuition. 
              Submit Java & JavaScript challenges with progressive hints that never spoil answers, 
              mandatory cognitive explanations, and isolated Docker container telemetry.
            </p>

            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={onStartMission}>
                <span>Start Debugging Mission</span>
                <Rocket size={18} />
              </button>

              <button className="btn btn-secondary btn-lg" onClick={onExploreDocker}>
                <span>Docker Architecture</span>
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Social Trust Proof (Skilotech reference) */}
            <div className="hero-trust-bar">
              <div className="trust-avatars">
                <div className="trust-avatar">DY</div>
                <div className="trust-avatar">JS</div>
                <div className="trust-avatar">JV</div>
                <div className="trust-avatar">AI</div>
              </div>
              <p className="trust-text">
                Proven practice pipeline for <span className="trust-highlight">1,250+ Engineers</span> & student hackathon teams.
              </p>
            </div>
          </div>

          {/* Right Visual Side: Interactive IDE Frame + Floating AI Tooltip */}
          <div className="hero-visual-side">
            <div className="editor-frame">
              {/* macOS Window Title Bar */}
              <div className="editor-header">
                <div className="editor-dots">
                  <span className="editor-dot dot-red"></span>
                  <span className="editor-dot dot-yellow"></span>
                  <span className="editor-dot dot-green"></span>
                </div>

                <div className="editor-tab-pill">
                  <Code size={13} style={{ color: 'var(--brand-light)' }} />
                  <span>{activeLang === 'js' ? 'TwoSumMission.js' : 'TwoSumMission.java'}</span>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    onClick={() => setActiveLang('js')} 
                    className={`editor-lang-badge ${activeLang === 'js' ? 'active' : ''}`}
                    style={{ background: activeLang === 'js' ? 'var(--brand)' : 'transparent', color: activeLang === 'js' ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer' }}
                  >
                    JS
                  </button>
                  <button 
                    onClick={() => setActiveLang('java')} 
                    className={`editor-lang-badge ${activeLang === 'java' ? 'active' : ''}`}
                    style={{ background: activeLang === 'java' ? 'var(--brand)' : 'transparent', color: activeLang === 'java' ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer' }}
                  >
                    JAVA
                  </button>
                </div>
              </div>

              {/* Code Editor Body */}
              <div className="editor-body">
                <div className="editor-lines">
                  1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9<br />10<br />11
                </div>
                <pre className="editor-code">
                  <code>{activeLang === 'js' ? jsSnippet : javaSnippet}</code>
                  <span className="editor-cursor"></span>
                </pre>
              </div>

              {/* Interactive Output Drawer */}
              <div className="editor-output-drawer">
                <div className="output-header">
                  <span>Diagnostic Test Runner</span>
                  <button 
                    onClick={handleSimulateRun}
                    disabled={isRunningSim}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}
                  >
                    <Play size={11} />
                    <span>{isRunningSim ? 'Analyzing...' : 'Run Test'}</span>
                  </button>
                </div>

                {isRunningSim ? (
                  <div className="output-line" style={{ color: 'var(--text-secondary)' }}>
                    <span>Executing sandboxed test suite...</span>
                  </div>
                ) : testRunCompleted ? (
                  <>
                    <div className="output-line fail">
                      <AlertCircle size={13} />
                      <span>Test 1 Failed: ArrayIndexOutOfBoundsException at i = 4 (Off-by-one)</span>
                    </div>
                    <div className="output-line pass">
                      <CheckCircle2 size={13} />
                      <span>Security Sandbox: Direct shell injection blocked safely</span>
                    </div>
                  </>
                ) : (
                  <div className="output-line" style={{ color: 'var(--text-muted)' }}>
                    <span>Ready for analysis. Click "Run Test" to evaluate error boundary.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Floating AI Mentor Tooltip (Skilotech reference) */}
            <div className="ai-tooltip-card">
              <div className="ai-tooltip-header">
                <Brain size={14} />
                <span>AI Mentor • Bug Fingerprint</span>
              </div>
              <p className="ai-tooltip-body">
                <strong>Off-by-One Traversal Pattern:</strong> The loop bounds <code>i &lt;= arr.length</code> exceed index limits. 
                Hint: Arrays are 0-indexed in both Java and JS.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
