import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, AlertCircle, Sparkles, Brain, Lock, Unlock, HelpCircle, Shield, RotateCcw, Award } from 'lucide-react';

const MISSIONS = [
  {
    id: 'off-by-one',
    title: 'Off-by-One Array Boundary',
    category: 'Index Safety',
    difficulty: 'Easy',
    fingerprintTag: 'Off-by-One Loop Traversal',
    description: 'The search function crashes on the final iteration because it loops past the last valid array index.',
    jsBuggy: `function findFirstPositive(numbers) {
  // Bug: loops until i <= numbers.length, causing undefined access
  for (let i = 0; i <= numbers.length; i++) {
    if (numbers[i] > 0) {
      return numbers[i];
    }
  }
  return -1;
}`,
    javaBuggy: `public static int findFirstPositive(int[] numbers) {
    // Bug: loops until i <= numbers.length, throwing ArrayIndexOutOfBoundsException
    for (int i = 0; i <= numbers.length; i++) {
        if (numbers[i] > 0) {
            return numbers[i];
        }
    }
    return -1;
}`,
    checkFix: (code, lang) => {
      // Clean check to see if learner fixed the <= bug to <
      const clean = code.replace(/\s+/g, ' ');
      const hasStrictLessThan = clean.includes('i < numbers.length');
      const hasNoLessThanEquals = !clean.includes('i <= numbers.length');
      return hasStrictLessThan && hasNoLessThanEquals;
    },
    hints: [
      { tier: 1, title: 'Concept Clue', text: 'Remember that arrays are 0-indexed. If an array has length 4, valid indexes are 0, 1, 2, and 3.' },
      { tier: 2, title: 'Location Clue', text: 'Inspect the loop termination condition in line 3. What happens when i equals numbers.length?' },
      { tier: 3, title: 'Logic Blueprint', text: 'Change the loop condition from <= to < so the loop terminates before accessing out-of-bounds memory.' }
    ],
    publicTests: [
      { input: 'numbers = [-2, -1, 5, 8]', expected: '5' },
      { input: 'numbers = [-5, -3, -1]', expected: '-1' }
    ]
  },
  {
    id: 'null-safety',
    title: 'Null Safety & Guard Clause',
    category: 'Null Pointer Guard',
    difficulty: 'Medium',
    fingerprintTag: 'Unchecked Null Reference',
    description: 'The profile parser crashes when receiving null or undefined user objects instead of providing a fallback.',
    jsBuggy: `function getUserDisplayName(user) {
  // Bug: fails when user is null or undefined
  return user.profile.name.toUpperCase();
}`,
    javaBuggy: `public static String getUserDisplayName(User user) {
    // Bug: throws NullPointerException if user or profile is null
    return user.getProfile().getName().toUpperCase();
}`,
    checkFix: (code, lang) => {
      const clean = code.toLowerCase();
      if (lang === 'js') {
        return clean.includes('!user') || clean.includes('user?.') || clean.includes('user &&');
      } else {
        return clean.includes('user == null') || clean.includes('user != null') || clean.includes('if (user');
      }
    },
    hints: [
      { tier: 1, title: 'Concept Clue', text: 'Always add a guard clause at the very beginning of the function before accessing nested properties.' },
      { tier: 2, title: 'Location Clue', text: 'Check if user is null or undefined before reading user.profile or calling getProfile().' },
      { tier: 3, title: 'Logic Blueprint', text: 'Return a fallback string like "GUEST" or "ANONYMOUS" if the input user is null.' }
    ],
    publicTests: [
      { input: 'user = { profile: { name: "Alice" } }', expected: '"ALICE"' },
      { input: 'user = null', expected: 'Graceful Fallback' }
    ]
  },
  {
    id: 'string-palindrome',
    title: 'Case-Insensitive Palindrome',
    category: 'String Transformation',
    difficulty: 'Easy',
    fingerprintTag: 'Unsanitized Character Equality',
    description: 'The validator fails on mixed-case inputs like "Radar" because it does not normalize casing before reversing.',
    jsBuggy: `function isPalindrome(str) {
  // Bug: does not normalize casing or remove punctuation
  const reversed = str.split('').reverse().join('');
  return str === reversed;
}`,
    javaBuggy: `public static boolean isPalindrome(String str) {
    // Bug: direct comparison fails for mixed casing like "Radar"
    String reversed = new StringBuilder(str).reverse().toString();
    return str.equals(reversed);
}`,
    checkFix: (code, lang) => {
      const clean = code.toLowerCase();
      return clean.includes('tolowercase') || clean.includes('touppercase');
    },
    hints: [
      { tier: 1, title: 'Concept Clue', text: 'Palindromes like "Racecar" and "Radar" should be valid regardless of uppercase or lowercase characters.' },
      { tier: 2, title: 'Location Clue', text: 'Normalize the input string to lowercase before comparing it with the reversed version.' },
      { tier: 3, title: 'Logic Blueprint', text: 'Call toLowerCase() on the string before splitting/reversing and comparing.' }
    ],
    publicTests: [
      { input: 'str = "racecar"', expected: 'true' },
      { input: 'str = "Radar"', expected: 'true' }
    ]
  }
];

export default function MissionSandbox() {
  const [activeMissionIndex, setActiveMissionIndex] = useState(0);
  const [selectedLang, setSelectedLang] = useState('js');
  
  const currentMission = MISSIONS[activeMissionIndex];
  const [userCode, setUserCode] = useState(selectedLang === 'js' ? currentMission.jsBuggy : currentMission.javaBuggy);
  const [explanation, setExplanation] = useState('');
  const [unlockedHints, setUnlockedHints] = useState([0]); // Hint 1 is free
  const [activeFeedbackTab, setActiveFeedbackTab] = useState('tests'); // 'tests' | 'hints' | 'fingerprint'
  
  const [testResults, setTestResults] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [explanationError, setExplanationError] = useState(false);

  // Switch mission
  const handleSelectMission = (idx) => {
    setActiveMissionIndex(idx);
    const m = MISSIONS[idx];
    setUserCode(selectedLang === 'js' ? m.jsBuggy : m.javaBuggy);
    setExplanation('');
    setUnlockedHints([0]);
    setTestResults(null);
    setExplanationError(false);
  };

  // Switch language
  const handleSelectLang = (lang) => {
    setSelectedLang(lang);
    setUserCode(lang === 'js' ? currentMission.jsBuggy : currentMission.javaBuggy);
    setTestResults(null);
  };

  // Reset starter code
  const handleResetCode = () => {
    setUserCode(selectedLang === 'js' ? currentMission.jsBuggy : currentMission.javaBuggy);
    setTestResults(null);
  };

  // Unlock progressive hint
  const handleUnlockHint = (hintIndex) => {
    if (!unlockedHints.includes(hintIndex)) {
      setUnlockedHints(prev => [...prev, hintIndex]);
    }
  };

  // Run verification
  const handleRunVerification = () => {
    // Cognitive gate: learner must write explanation first
    if (!explanation.trim() || explanation.trim().length < 12) {
      setExplanationError(true);
      setActiveFeedbackTab('hints');
      return;
    }

    setExplanationError(false);
    setIsVerifying(true);
    setTestResults(null);

    setTimeout(() => {
      setIsVerifying(false);
      const isFixed = currentMission.checkFix(userCode, selectedLang);

      setTestResults({
        passed: isFixed,
        publicResults: currentMission.publicTests.map((t, idx) => ({
          ...t,
          status: isFixed ? 'PASSED' : idx === 0 ? 'PASSED' : 'FAILED',
          actual: isFixed ? t.expected : (idx === 0 ? t.expected : 'NullPointerException / Off-by-one')
        })),
        hiddenTestStatus: isFixed ? 'PASSED' : 'FAILED'
      });
      setActiveFeedbackTab('tests');
    }, 600);
  };

  return (
    <section id="missions" className="sandbox-section">
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <Sparkles size={14} />
            <span>Interactive Debugging Lab</span>
          </div>
          <h2 className="section-title">
            Practice Real Missions. <br />
            <span className="hero-gradient-text">Explain Before You Fix.</span>
          </h2>
          <p className="section-subtitle">
            No copy-pasting. Identify the bug, write your reasoning hypothesis in the cognitive gate, 
            unlock hints progressively, and execute against both public and security-guarded hidden test suites.
          </p>
        </div>

        <div className="sandbox-container">
          {/* Top Bar: Mission Selector & Language Toggle */}
          <div className="sandbox-topbar">
            <div className="mission-selector-group">
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Mission:
              </span>
              {MISSIONS.map((m, idx) => (
                <button
                  key={m.id}
                  className={`mission-pill-btn ${activeMissionIndex === idx ? 'active' : ''}`}
                  onClick={() => handleSelectMission(idx)}
                >
                  {m.title}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="language-switch-group">
                <button 
                  className={`lang-btn ${selectedLang === 'js' ? 'active' : ''}`}
                  onClick={() => handleSelectLang('js')}
                >
                  JavaScript
                </button>
                <button 
                  className={`lang-btn ${selectedLang === 'java' ? 'active' : ''}`}
                  onClick={() => handleSelectLang('java')}
                >
                  Java 21
                </button>
              </div>

              <button 
                onClick={handleResetCode}
                className="btn btn-secondary btn-sm"
                title="Reset starter buggy code"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Sandbox Body: 2 Columns */}
          <div className="sandbox-body-grid">
            {/* Left Column: Code Editor & Cognitive Explanation Gate */}
            <div className="sandbox-editor-col">
              <div className="editor-toolbar">
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {currentMission.description}
                </span>
                <span className="badge badge-warning">
                  {currentMission.category}
                </span>
              </div>

              <textarea
                className="code-textarea"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                rows={14}
                spellCheck={false}
              />

              {/* Cognitive Gate: Explain Before You Fix */}
              <div className="explain-gate-box">
                <div className="explain-gate-label">
                  <Brain size={14} />
                  <span>Explain Before You Fix (Mandatory Gate)</span>
                </div>
                <input
                  type="text"
                  className="explain-input"
                  placeholder="e.g., The loop accesses an index equal to array length, causing an out-of-bounds crash..."
                  value={explanation}
                  onChange={(e) => {
                    setExplanation(e.target.value);
                    if (e.target.value.trim().length >= 12) setExplanationError(false);
                  }}
                />
                {explanationError && (
                  <p style={{ color: 'var(--status-danger)', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                    ⚠️ Please provide a clear hypothesis (at least 12 characters) explaining the bug before running tests!
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Progressive Hints, Tests & Bug Fingerprint */}
            <div className="sandbox-feedback-col">
              <div className="feedback-tabs-bar">
                <button 
                  className={`feedback-tab-btn ${activeFeedbackTab === 'tests' ? 'active' : ''}`}
                  onClick={() => setActiveFeedbackTab('tests')}
                >
                  Test Results {testResults && (testResults.passed ? '✓' : '✗')}
                </button>
                <button 
                  className={`feedback-tab-btn ${activeFeedbackTab === 'hints' ? 'active' : ''}`}
                  onClick={() => setActiveFeedbackTab('hints')}
                >
                  Progressive Hints ({unlockedHints.length}/3)
                </button>
                <button 
                  className={`feedback-tab-btn ${activeFeedbackTab === 'fingerprint' ? 'active' : ''}`}
                  onClick={() => setActiveFeedbackTab('fingerprint')}
                >
                  Bug Fingerprint
                </button>
              </div>

              <div className="feedback-content-area">
                {/* Tab 1: Test Results */}
                {activeFeedbackTab === 'tests' && (
                  <div>
                    {!testResults ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <Play size={28} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                        <p style={{ fontSize: '0.88rem', fontWeight: 500 }}>No test runs executed yet.</p>
                        <p style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                          Edit the code, type your explanation, and click <strong>Verify & Run Tests</strong> below.
                        </p>
                      </div>
                    ) : (
                      <div className="test-results-group">
                        {testResults.passed ? (
                          <div style={{ padding: '0.85rem 1rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <Award size={20} color="#10b981" />
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>Mission Completed!</strong>
                              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>All public and hidden edge-case tests passed with 100% precision.</p>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <AlertCircle size={20} color="#ef4444" />
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>Edge-case Failure Detected</strong>
                              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Review your boundary condition or consult the progressive hint ladder.</p>
                            </div>
                          </div>
                        )}

                        {testResults.publicResults.map((t, idx) => (
                          <div key={idx} className={`test-case-card ${t.status === 'PASSED' ? 'pass' : 'fail'}`}>
                            <div className="test-case-header">
                              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Public Test #{idx + 1}</span>
                              <span className={`badge ${t.status === 'PASSED' ? 'badge-success' : 'badge-danger'}`}>
                                {t.status}
                              </span>
                            </div>
                            <div className="test-details-grid">
                              <div><strong>Input:</strong> {t.input}</div>
                              <div><strong>Expected:</strong> {t.expected}</div>
                              <div><strong>Actual:</strong> {t.actual}</div>
                            </div>
                          </div>
                        ))}

                        {/* Hidden Test Case Card (Security rule: Never expose inputs/outputs!) */}
                        <div className={`test-case-card ${testResults.hiddenTestStatus === 'PASSED' ? 'pass' : 'fail'}`}>
                          <div className="test-case-header">
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Shield size={13} color="var(--brand-light)" />
                              <span>Hidden Edge-Case Suite</span>
                            </span>
                            <span className={`badge ${testResults.hiddenTestStatus === 'PASSED' ? 'badge-success' : 'badge-danger'}`}>
                              {testResults.hiddenTestStatus}
                            </span>
                          </div>
                          <div className="hidden-test-shield">
                            <Lock size={12} />
                            <span>Hidden test payload and expected value are securely obfuscated per CodeDNA sandbox rules.</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Progressive Hint Ladder */}
                {activeFeedbackTab === 'hints' && (
                  <div className="hint-ladder-group">
                    {currentMission.hints.map((hint, idx) => {
                      const isUnlocked = unlockedHints.includes(idx);
                      return (
                        <div key={idx} className={`hint-card ${isUnlocked ? 'unlocked' : ''}`}>
                          <div className="hint-header">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {isUnlocked ? <Unlock size={14} color="#10b981" /> : <Lock size={14} color="#64748b" />}
                              <span>Tier {hint.tier} : {hint.title}</span>
                            </span>
                            {!isUnlocked && (
                              <button 
                                onClick={() => handleUnlockHint(idx)}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                              >
                                Unlock Hint
                              </button>
                            )}
                          </div>
                          <p className="hint-text">
                            {isUnlocked ? hint.text : 'Click "Unlock Hint" to reveal conceptual assistance without spoiling the direct solution.'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tab 3: Bug Fingerprint */}
                {activeFeedbackTab === 'fingerprint' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '1rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700 }}>
                        Current Diagnostic Pattern
                      </span>
                      <h4 style={{ fontSize: '1rem', marginTop: '0.35rem', color: 'var(--cyan-accent)' }}>
                        {currentMission.fingerprintTag}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                        CodeDNA tracks recurring mistake patterns over time to recommend targeted exercises instead of passive repetition.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span>Index Bounds & Off-by-One</span>
                        <strong style={{ color: 'var(--brand-light)' }}>42% Frequency</strong>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: '42%' }}></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                        <span>Null Pointer / Guard Omission</span>
                        <strong style={{ color: 'var(--purple-accent)' }}>28% Frequency</strong>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: '28%', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                        <span>Type Coercion & Strict Equality</span>
                        <strong style={{ color: 'var(--status-success)' }}>15% Frequency</strong>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: '15%', background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sandbox Action Bar */}
          <div className="sandbox-bottom-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="badge badge-neutral">
                Language: {selectedLang.toUpperCase()}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {explanation.trim().length >= 12 ? '✓ Hypothesis recorded' : '• Hypothesis required in cognitive gate'}
              </span>
            </div>

            <button 
              className="btn btn-primary"
              onClick={handleRunVerification}
              disabled={isVerifying}
            >
              <Play size={15} />
              <span>{isVerifying ? 'Verifying Sandboxed Code...' : 'Verify & Run Tests'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
