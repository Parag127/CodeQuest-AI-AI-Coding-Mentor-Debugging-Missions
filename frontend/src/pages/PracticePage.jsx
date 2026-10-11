import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ArrowLeft,
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  Brain, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Award, 
  Clock, 
  RefreshCw, 
  ArrowRight, 
  Lightbulb, 
  Terminal,
  Compass,
  Layers,
  Sun,
  Moon,
  ChevronDown,
  Code2,
  FileCode,
  Shield,
  HelpCircle,
  Zap,
  Check
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Fallback seed challenges in case the server is starting or offline
const FALLBACK_CHALLENGES = [
  {
    id: 'largest-number',
    title: 'Find the largest number',
    difficulty: 'easy',
    concept: 'loop_boundary',
    description: 'Debug the program so it prints the largest integer in the input array. Pay close attention to loop termination boundaries.',
    languages: ['javascript', 'java'],
    starterCode: {
      javascript: `const fs = require('fs');

function findLargest(numbers) {
  // Buggy implementation: loops until numbers.length - 1 with < boundary, missing the last item
  let max = numbers[0];
  for (let i = 1; i < numbers.length - 1; i++) {
    if (numbers[i] > max) {
      max = numbers[i];
    }
  }
  return max;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input.length > 0) {
  const lines = input.split('\\n');
  const numbers = (lines[1] || lines[0]).trim().split(/\\s+/).map(Number);
  console.log(findLargest(numbers));
}`,
      java: `import java.util.Scanner;

public class Main {
    public static int findLargest(int[] numbers) {
        // Buggy implementation: loops until numbers.length - 1 with < boundary, missing the last item
        int max = numbers[0];
        for (let i = 1; i < numbers.length - 1; i++) {
            if (numbers[i] > max) {
                max = numbers[i];
            }
        }
        return max;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int n = scanner.nextInt();
            int[] numbers = new int[n];
            for (int i = 0; i < n; i++) {
                numbers[i] = scanner.nextInt();
            }
            System.out.println(findLargest(numbers));
        }
    }
}`
    },
    visibleTests: [
      { id: 'visible-1', stdin: '4\\n2 5 1 9\\n', expectedStdout: '9\\n' },
      { id: 'visible-2', stdin: '3\\n10 20 30\\n', expectedStdout: '30\\n' },
      { id: 'visible-3', stdin: '1\\n42\\n', expectedStdout: '42\\n' }
    ]
  },
  {
    id: 'reverse-string',
    title: 'Reverse a String',
    difficulty: 'easy',
    concept: 'string_reversal',
    description: 'Write a program that reads a string from standard input and prints the reversed string to standard output.',
    languages: ['javascript', 'java'],
    starterCode: {
      javascript: `const fs = require('fs');

function solution(str) {
  // TODO: Return the reversed string
  return str;
}

const input = fs.readFileSync(0, 'utf-8').trim();
console.log(solution(input));`,
      java: `import java.util.Scanner;

public class Main {
    public static String solution(String str) {
        // TODO: Return the reversed string
        return str;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextLine()) {
            String input = scanner.nextLine();
            System.out.println(solution(input));
        }
    }
}`
    },
    visibleTests: [
      { id: 'tc-rev-1', stdin: 'hello\\n', expectedStdout: 'olleh\\n' },
      { id: 'tc-rev-2', stdin: 'world\\n', expectedStdout: 'dlrow\\n' },
      { id: 'tc-rev-3', stdin: 'CodeDNA\\n', expectedStdout: 'ANDedoC\\n' }
    ]
  },
  {
    id: 'sum-positive',
    title: 'Sum Positive Numbers',
    difficulty: 'easy',
    concept: 'array_conditions',
    description: 'Debug the program so it sums only positive integers (> 0). If empty or no positives, print 0.',
    languages: ['javascript', 'java'],
    starterCode: {
      javascript: `const fs = require('fs');

function sumPositive(numbers) {
  // Buggy implementation: crashes on empty array and adds all numbers instead of only positive ones
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (!input) {
  console.log(0);
} else {
  const lines = input.split('\\n');
  const count = parseInt(lines[0], 10);
  if (count === 0 || !lines[1]) {
    console.log(0);
  } else {
    const numbers = lines[1].trim().split(/\\s+/).map(Number);
    console.log(sumPositive(numbers));
  }
}`,
      java: `import java.util.Scanner;

public class Main {
    public static int sumPositive(int[] numbers) {
        // Buggy implementation: adds all numbers instead of only positive ones (> 0)
        int total = 0;
        for (let i = 0; i < numbers.length; i++) {
            total += numbers[i];
        }
        return total;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int n = scanner.nextInt();
            int[] numbers = new int[n];
            for (int i = 0; i < n; i++) {
                numbers[i] = scanner.nextInt();
            }
            System.out.println(sumPositive(numbers));
        } else {
            System.out.println(0);
        }
    }
}`
    },
    visibleTests: [
      { id: 'tc-pos-1', stdin: '4\\n1 2 3 4\\n', expectedStdout: '10\\n' },
      { id: 'tc-pos-2', stdin: '3\\n-1 5 2\\n', expectedStdout: '7\\n' }
    ]
  }
];

export default function PracticePage({
  currentUser,
  onNavigateHome,
  theme,
  onToggleTheme,
  backendStatus,
  latency,
  initialChallengeId
}) {
  const activeLearnerId = currentUser?.id ? String(currentUser.id) : 'learner-demo-1';

  // Catalog & Challenge State
  const [challenges, setChallenges] = useState(FALLBACK_CHALLENGES);
  const [activeChallengeId, setActiveChallengeId] = useState(() => initialChallengeId || FALLBACK_CHALLENGES[0].id);
  const [currentChallenge, setCurrentChallenge] = useState(() => {
    return FALLBACK_CHALLENGES.find(c => c.id === (initialChallengeId || FALLBACK_CHALLENGES[0].id)) || FALLBACK_CHALLENGES[0];
  });
  const [selectedLang, setSelectedLang] = useState('javascript'); // 'javascript' | 'java'

  // Preserved User Code Cache by [challengeId_lang] to prevent losing user edits
  const [codeCache, setCodeCache] = useState(() => {
    const initialKey = `${initialChallengeId || FALLBACK_CHALLENGES[0].id}_javascript`;
    const defaultCode = FALLBACK_CHALLENGES[0].starterCode.javascript;
    return { [initialKey]: defaultCode };
  });

  const [userCode, setUserCode] = useState(() => {
    return currentChallenge?.starterCode?.javascript || '';
  });

  // Cognitive Gate & EBYF State
  const [explanation, setExplanation] = useState('');
  const [predictedVariable, setPredictedVariable] = useState('');
  const [predictedValue, setPredictedValue] = useState('');
  const [ebyfQuestion, setEbyfQuestion] = useState(null);
  const [ebyfFeedback, setEbyfFeedback] = useState(null);
  const [isEbyfSubmitting, setIsEbyfSubmitting] = useState(false);
  const [explanationError, setExplanationError] = useState(false);
  const [isEbyfOpen, setIsEbyfOpen] = useState(true);

  // Progressive Hints State
  const [unlockedHints, setUnlockedHints] = useState({}); // { 1: { text, isFallback }, ... }
  const [isHintLoading, setIsHintLoading] = useState(false);

  // Execution & Submissions State
  const [lastSubmissionId, setLastSubmissionId] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFeedbackTab, setActiveFeedbackTab] = useState('tests'); // 'tests' | 'hints' | 'ebyf' | 'fingerprint' | 'adaptive'
  
  // Progress & Adaptive Recommendation State
  const [learnerProgress, setLearnerProgress] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [isChallengesDropdownOpen, setIsChallengesDropdownOpen] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState('editor'); // 'editor' | 'description'

  const textareaRef = useRef(null);

  // Helper to extract starter code
  const getStarterCode = (challengeObj, lang) => {
    if (!challengeObj?.starterCode) return '';
    return challengeObj.starterCode[lang] || challengeObj.starterCode[lang === 'javascript' ? 'javascript' : 'java'] || '';
  };

  // Keep userCode in sync with codeCache
  const handleCodeChange = (newCode) => {
    setUserCode(newCode);
    const key = `${activeChallengeId}_${selectedLang}`;
    setCodeCache(prev => ({
      ...prev,
      [key]: newCode
    }));
  };

  // 1. Fetch Challenge Catalog
  const fetchChallengesCatalog = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/challenges`);
      if (res.ok) {
        const json = await res.json();
        const catalogList = json.challenges || json.data || [];
        if (Array.isArray(catalogList) && catalogList.length > 0) {
          setChallenges(catalogList);
        }
      }
    } catch (err) {
      console.warn('[PracticePage] Using offline catalog fallback:', err.message);
    }
  }, []);

  // 2. Load Single Challenge Details
  const loadChallengeDetails = useCallback(async (challengeId, lang) => {
    setApiError(null);
    let detail = null;

    try {
      const res = await fetch(`${API_BASE}/api/challenges/${challengeId}`);
      if (res.ok) {
        const json = await res.json();
        detail = json.challenge || json.data;
      }
    } catch (err) {
      console.warn(`[PracticePage] Detail fallback for ${challengeId}:`, err.message);
    }

    if (!detail) {
      detail = FALLBACK_CHALLENGES.find(c => c.id === challengeId) || FALLBACK_CHALLENGES[0];
    }

    setCurrentChallenge(detail);

    // Check codeCache first to avoid wiping learner's in-progress solution
    const key = `${challengeId}_${lang}`;
    setCodeCache(prev => {
      if (prev[key] !== undefined) {
        setUserCode(prev[key]);
        return prev;
      }
      const starter = getStarterCode(detail, lang);
      setUserCode(starter);
      return { ...prev, [key]: starter };
    });

    return detail;
  }, []);

  // 3. Fetch EBYF Question for Current Challenge
  const fetchEbyfQuestion = useCallback(async (challengeId, subId = null) => {
    try {
      const res = await fetch(`${API_BASE}/api/explain-before-fix/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          learnerId: activeLearnerId,
          language: selectedLang,
          submissionId: subId
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setEbyfQuestion(json.data);
        }
      }
    } catch (err) {
      setEbyfQuestion({
        question: 'Identify the exact boundary condition or state where this logic deviates from expected behavior.',
        questionType: 'explain_condition'
      });
    }
  }, [activeLearnerId, selectedLang]);

  // 4. Fetch Adaptive Recommendation
  const fetchRecommendation = useCallback(async (currentId) => {
    try {
      const res = await fetch(`${API_BASE}/api/recommendations/${activeLearnerId}?currentChallengeId=${currentId || activeChallengeId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setRecommendation(json.data);
        }
      }
    } catch (err) {
      console.warn('[PracticePage] Recommendation standby:', err.message);
    }
  }, [activeLearnerId, activeChallengeId]);

  // 5. Fetch Learner Progress & Telemetry
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/progress/${activeLearnerId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setLearnerProgress(json.data);
        }
      }
    } catch (err) {
      console.warn('[PracticePage] Progress telemetry standby:', err.message);
    }
  }, [activeLearnerId]);

  // Mount effect
  useEffect(() => {
    fetchChallengesCatalog();
    loadChallengeDetails(activeChallengeId, selectedLang);
    fetchEbyfQuestion(activeChallengeId);
    fetchRecommendation(activeChallengeId);
    fetchProgress();
  }, [fetchChallengesCatalog]);

  // Switch challenge handler
  const handleSelectChallenge = async (challengeId) => {
    setActiveChallengeId(challengeId);
    setIsChallengesDropdownOpen(false);
    setTestResults(null);
    setLastSubmissionId(null);
    setUnlockedHints({});
    setExplanation('');
    setPredictedVariable('');
    setPredictedValue('');
    setEbyfFeedback(null);
    setExplanationError(false);
    setApiError(null);

    await loadChallengeDetails(challengeId, selectedLang);
    fetchEbyfQuestion(challengeId);
    fetchRecommendation(challengeId);
  };

  // Switch language handler
  const handleSelectLang = (lang) => {
    if (lang === selectedLang) return;
    setSelectedLang(lang);
    setTestResults(null);
    setExplanationError(false);

    const key = `${activeChallengeId}_${lang}`;
    if (codeCache[key] !== undefined) {
      setUserCode(codeCache[key]);
    } else {
      const starter = getStarterCode(currentChallenge, lang);
      setUserCode(starter);
      setCodeCache(prev => ({ ...prev, [key]: starter }));
    }
  };

  // Reset starter code handler
  const handleResetCode = () => {
    if (window.confirm('Reset code to initial challenge template? Any changes will be discarded.')) {
      const freshCode = getStarterCode(currentChallenge, selectedLang);
      setUserCode(freshCode);
      const key = `${activeChallengeId}_${selectedLang}`;
      setCodeCache(prev => ({ ...prev, [key]: freshCode }));
      setTestResults(null);
      setExplanationError(false);
    }
  };

  // Handle Keyboard Navigation & Smart Auto-Indentation in Code Editor
  const handleKeyDown = (e) => {
    // 1. Ctrl+Enter or Cmd+Enter to execute tests / submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmitCode();
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    // 2. Auto-indentation when pressing Enter
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = userCode;

      // Extract current line up to the cursor
      const lineUpToCursor = val.substring(0, start).split('\n').pop() || '';
      const indentMatch = lineUpToCursor.match(/^([ \t]*)/);
      let indent = indentMatch ? indentMatch[1] : '';

      // Check if line before cursor ends with an opening brace/bracket/colon
      const trimmedLine = lineUpToCursor.trim();
      const opensBlock = /[\{\[\(:]$/.test(trimmedLine);
      if (opensBlock) {
        indent += '  '; // Indent by 2 spaces for the new block
      }

      // Check if next character right after cursor is a closing brace/bracket/parenthesis
      const nextChar = val.charAt(start);
      const isBraceSplit = opensBlock && (
        (trimmedLine.endsWith('{') && nextChar === '}') ||
        (trimmedLine.endsWith('[') && nextChar === ']') ||
        (trimmedLine.endsWith('(') && nextChar === ')')
      );

      if (isBraceSplit) {
        // Expand {|} to:
        // {
        //   |
        // }
        const prevIndent = indentMatch ? indentMatch[1] : '';
        const insertText = '\n' + indent + '\n' + prevIndent;
        const updated = val.substring(0, start) + insertText + val.substring(end);
        handleCodeChange(updated);
        const cursorPosition = start + 1 + indent.length;
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursorPosition;
        }, 0);
      } else {
        const insertText = '\n' + indent;
        const updated = val.substring(0, start) + insertText + val.substring(end);
        handleCodeChange(updated);
        const cursorPosition = start + insertText.length;
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursorPosition;
        }, 0);
      }
      return;
    }

    // 3. Tab key: Indent with 2 spaces (multi-line support for Tab and Shift+Tab)
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = userCode;

      if (start === end) {
        // Single cursor: insert 2 spaces
        const updated = val.substring(0, start) + '  ' + val.substring(end);
        handleCodeChange(updated);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      } else {
        // Multi-line selection: indent or un-indent entire blocks
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = val.indexOf('\n', end);
        const endPos = lineEnd === -1 ? val.length : lineEnd;
        const selectedText = val.substring(lineStart, endPos);

        if (e.shiftKey) {
          // Shift+Tab: Remove up to 2 leading spaces
          const lines = selectedText.split('\n').map(l => l.replace(/^ {1,2}/, ''));
          const replacement = lines.join('\n');
          const updated = val.substring(0, lineStart) + replacement + val.substring(endPos);
          handleCodeChange(updated);
          setTimeout(() => {
            textarea.selectionStart = lineStart;
            textarea.selectionEnd = lineStart + replacement.length;
          }, 0);
        } else {
          // Tab: Add 2 leading spaces to each line
          const lines = selectedText.split('\n').map(l => '  ' + l);
          const replacement = lines.join('\n');
          const updated = val.substring(0, lineStart) + replacement + val.substring(endPos);
          handleCodeChange(updated);
          setTimeout(() => {
            textarea.selectionStart = lineStart;
            textarea.selectionEnd = lineStart + replacement.length;
          }, 0);
        }
      }
      return;
    }

    // 4. Backspace: If right after an even indentation (e.g., 2 spaces), delete the 2-space tab cleanly
    if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end && start >= 2) {
        const val = userCode;
        const char1 = val.charAt(start - 1);
        const char2 = val.charAt(start - 2);
        const lineUpToCursor = val.substring(0, start).split('\n').pop() || '';
        // If the line up to cursor consists only of spaces and ends with '  '
        if (char1 === ' ' && char2 === ' ' && /^\s+$/.test(lineUpToCursor)) {
          e.preventDefault();
          const updated = val.substring(0, start - 2) + val.substring(start);
          handleCodeChange(updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start - 2;
          }, 0);
        }
      }
    }
  };

  // Submit Code for Evaluation
  const handleSubmitCode = async () => {
    setApiError(null);
    setExplanationError(false);

    if (!userCode.trim()) {
      setApiError('Submitted code cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setActiveFeedbackTab('tests');

    try {
      const res = await fetch(`${API_BASE}/api/submissions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Learner-Id': activeLearnerId
        },
        body: JSON.stringify({
          challengeId: activeChallengeId,
          language: selectedLang,
          code: userCode,
          explanation: explanation.trim() || undefined,
          learnerId: activeLearnerId
        })
      });

      const data = await res.json();

      if (res.ok) {
        const payload = data.data || data;
        setTestResults(payload);
        setLastSubmissionId(payload.submissionId);

        // Refresh learner telemetry and adaptive recommendation
        fetchProgress();
        fetchRecommendation(activeChallengeId);

        if (payload.status === 'failed') {
          fetchEbyfQuestion(activeChallengeId, payload.submissionId);
        }
      } else {
        const errMsg = data.error?.message || data.error || 'Submission failed. Please check your runner service.';
        setApiError(errMsg);
      }
    } catch (err) {
      console.error('[PracticePage] Submission error:', err);
      setApiError('Unable to reach backend execution runner. Confirm that backend is listening on port 5000.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit EBYF Explanation
  const handleSubmitExplanation = async (e) => {
    if (e) e.preventDefault();
    if (!explanation.trim() || explanation.trim().length < 5) {
      setExplanationError(true);
      return;
    }

    setExplanationError(false);
    setIsEbyfSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch(`${API_BASE}/api/explain-before-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: lastSubmissionId || undefined,
          learnerId: activeLearnerId,
          explanation: explanation.trim(),
          predictedVariable: predictedVariable.trim() || undefined,
          predictedValue: predictedValue.trim() || undefined,
          challengeId: activeChallengeId,
          code: userCode,
          language: selectedLang
        })
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setEbyfFeedback(json.data);
        setActiveFeedbackTab('ebyf');
      } else {
        setApiError(json.error || 'Unable to evaluate reflection at this time.');
      }
    } catch (err) {
      console.warn('[PracticePage] EBYF submission error:', err);
      setApiError('Explanation service currently unavailable. Please verify network connectivity.');
    } finally {
      setIsEbyfSubmitting(false);
    }
  };

  // Unlock Progressive Hint
  const handleUnlockHint = async (level) => {
    setIsHintLoading(true);
    setApiError(null);

    try {
      const res = await fetch(`${API_BASE}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: lastSubmissionId || undefined,
          hintLevel: level,
          learnerId: activeLearnerId,
          challengeId: activeChallengeId,
          code: userCode,
          language: selectedLang
        })
      });

      const json = await res.json();
      if (res.ok) {
        const hintData = json.data || json;
        setUnlockedHints(prev => ({
          ...prev,
          [level]: {
            text: hintData.hint,
            isFallback: Boolean(hintData.isFallback)
          }
        }));
        setActiveFeedbackTab('hints');
      } else {
        setApiError(json.error || `Failed to unlock Level ${level} hint.`);
      }
    } catch (err) {
      setApiError(`Hint service error: ensure backend API is running.`);
    } finally {
      setIsHintLoading(false);
    }
  };

  // Helper to format test status badges
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'passed':
        return <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle2 size={12} /> Passed</span>;
      case 'wrong_output':
        return <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}><AlertCircle size={12} /> Wrong Output</span>;
      case 'compile_error':
        return <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}><Terminal size={12} /> Compile Error</span>;
      case 'runtime_error':
        return <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.4)' }}><XCircle size={12} /> Runtime Error</span>;
      case 'timeout':
        return <span className="badge badge-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}><Clock size={12} /> Timeout</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const lineCount = userCode.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 15) }, (_, i) => i + 1);

  const hasCompileError = Boolean(
    testResults?.results?.some(t => t.status === 'compile_error') || 
    testResults?.fingerprint?.category === 'syntax_error' ||
    testResults?.status === 'compile_error'
  );
  const compileErrorText = testResults?.results?.find(t => t.stderr)?.stderr || 
    (hasCompileError && testResults?.fingerprint?.evidence ? testResults.fingerprint.evidence : null);

  return (
    <div className="practice-page-root">
      {/* 1. Dedicated IDE Navigation Bar */}
      <header className="practice-ide-navbar">
        <div className="practice-nav-left">
          <button 
            onClick={onNavigateHome} 
            className="practice-back-btn"
            title="Return to Home Dashboard"
          >
            <ArrowLeft size={16} />
            <span>Home</span>
          </button>

          <div className="practice-divider-v"></div>

          {/* Challenge Selector Dropdown */}
          <div className="practice-challenge-dropdown-wrapper">
            <button 
              className="practice-challenge-select-btn"
              onClick={() => setIsChallengesDropdownOpen(!isChallengesDropdownOpen)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mission
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentChallenge?.title || 'Select Mission'}
                </span>
              </div>
              <ChevronDown size={15} style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }} />
            </button>

            {isChallengesDropdownOpen && (
              <div className="practice-challenge-menu">
                <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Select Practice Challenge
                </div>
                {challenges.map(c => (
                  <div 
                    key={c.id} 
                    className={`practice-challenge-item ${activeChallengeId === c.id ? 'active' : ''}`}
                    onClick={() => handleSelectChallenge(c.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.82rem' }}>{c.title}</strong>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                        {c.concept?.replace(/_/g, ' ') || c.difficulty}
                      </span>
                    </div>
                    {activeChallengeId === c.id && <Check size={14} color="var(--brand-light)" style={{ marginTop: '0.25rem' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <span className="badge badge-brand" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {currentChallenge?.concept?.replace(/_/g, ' ') || 'Practice'}
          </span>
        </div>

        {/* Center / Right IDE Actions */}
        <div className="practice-nav-right">
          {/* Language Switcher */}
          <div className="practice-lang-toggle">
            <button 
              className={`practice-lang-btn ${selectedLang === 'javascript' ? 'active' : ''}`}
              onClick={() => handleSelectLang('javascript')}
            >
              JavaScript
            </button>
            <button 
              className={`practice-lang-btn ${selectedLang === 'java' ? 'active' : ''}`}
              onClick={() => handleSelectLang('java')}
            >
              Java 21
            </button>
          </div>

          {/* Reset Code */}
          <button 
            onClick={handleResetCode} 
            className="btn btn-secondary btn-sm"
            title="Reset to starter template"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          {/* Quick Run Tests CTA */}
          <button 
            onClick={handleSubmitCode}
            disabled={isSubmitting}
            className="btn btn-secondary btn-sm"
            title="Run test suite against visible test cases"
          >
            {isSubmitting ? <RefreshCw size={13} className="spin" /> : <Play size={13} />}
            <span>Run Tests</span>
          </button>

          {/* Dedicated Submit Solution CTA */}
          <button 
            onClick={handleSubmitCode}
            disabled={isSubmitting}
            className="btn btn-submit btn-sm"
            style={{ fontWeight: 700 }}
            title="Submit code for full evaluation & Bug Fingerprint recording (Ctrl + Enter)"
          >
            {isSubmitting ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />}
            <span>Submit</span>
            <span style={{ fontSize: '0.62rem', opacity: 0.85, background: 'rgba(0,0,0,0.25)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
              Ctrl+↵
            </span>
          </button>

          <div className="practice-divider-v"></div>

          {/* Health Pill */}
          <div className="nav-status-pill" style={{ padding: '0.25rem 0.6rem' }} title={`Backend status: ${backendStatus}`}>
            <span className={`pulse-dot ${backendStatus === 'healthy' ? '' : 'offline'}`}></span>
            <span style={{ fontSize: '0.72rem' }}>{backendStatus === 'healthy' ? 'Online' : 'Standby'}</span>
            {latency && <span style={{ fontSize: '0.68rem', color: 'var(--cyan-accent)' }}>{latency}ms</span>}
          </div>

          {/* Theme Toggle */}
          <button 
            className="theme-toggle-btn" 
            onClick={onToggleTheme}
            style={{ width: '32px', height: '32px' }}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {apiError && (
        <div className="practice-alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} color="#ef4444" />
            <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>{apiError}</span>
          </div>
          <button 
            onClick={() => setApiError(null)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Main 2-Column Split Workspace */}
      <div className="practice-workspace-grid">
        {/* LEFT COLUMN: Problem Overview, Code Editor, Cognitive Gate */}
        <section className="practice-left-pane">
          {/* Left Pane Tab Bar */}
          <div className="practice-pane-tabs">
            <button 
              className={`practice-pane-tab ${activeLeftTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveLeftTab('editor')}
            >
              <FileCode size={14} />
              <span>{selectedLang === 'javascript' ? 'solution.js' : 'Main.java'}</span>
            </button>
            <button 
              className={`practice-pane-tab ${activeLeftTab === 'description' ? 'active' : ''}`}
              onClick={() => setActiveLeftTab('description')}
            >
              <HelpCircle size={14} />
              <span>Problem Description</span>
            </button>
          </div>

          {/* Description View (Collapsible Tab) */}
          {activeLeftTab === 'description' && (
            <div className="practice-description-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {currentChallenge?.title}
              </h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                {currentChallenge?.description}
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  Target Concept
                </span>
                <p style={{ fontSize: '0.82rem', color: 'var(--cyan-accent)', fontFamily: 'var(--font-mono)' }}>
                  {currentChallenge?.concept}
                </p>
              </div>

              {Array.isArray(currentChallenge?.visibleTests) && currentChallenge.visibleTests.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                    Example Test Cases
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {currentChallenge.visibleTests.map((vt, i) => (
                      <div key={i} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>
                        <div><strong>Input:</strong> <span style={{ color: '#94a3b8' }}>{JSON.stringify(vt.stdin)}</span></div>
                        <div><strong>Expected:</strong> <span style={{ color: '#a7f3d0' }}>{JSON.stringify(vt.expectedStdout)}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Code Editor View */}
          <div className="practice-editor-container" style={{ display: activeLeftTab === 'editor' ? 'flex' : 'none' }}>
            <div className="practice-editor-subbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                <Code2 size={13} />
                <span>{currentChallenge?.description || 'Inspect algorithm logic and resolve defects.'}</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Lines: {lineCount}
              </span>
            </div>

            {/* Line Numbers + Textarea */}
            <div className="practice-code-area-wrapper">
              <div className="practice-line-numbers">
                {lineNumbers.map(n => (
                  <span key={n}>{n}</span>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                className="practice-code-textarea"
                value={userCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                placeholder="Enter or debug your solution here..."
              />
            </div>

            {/* Bottom Editor Action Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.85rem',
              borderTop: '1px solid var(--border-primary)',
              background: 'rgba(15, 23, 42, 0.45)',
              borderBottomLeftRadius: 'var(--radius-md)',
              borderBottomRightRadius: 'var(--radius-md)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Shortcuts: <kbd style={{ padding: '0.1rem 0.3rem', background: 'var(--bg-glass)', borderRadius: '3px', border: '1px solid var(--border-primary)' }}>Tab</kbd> indent &bull; <kbd style={{ padding: '0.1rem 0.3rem', background: 'var(--bg-glass)', borderRadius: '3px', border: '1px solid var(--border-primary)' }}>Ctrl+Enter</kbd> submit</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={handleResetCode} 
                  className="btn btn-secondary btn-sm"
                  title="Reset to starter template"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
                <button 
                  onClick={handleSubmitCode}
                  disabled={isSubmitting}
                  className="btn btn-secondary btn-sm"
                  title="Run test suite against visible test cases"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                >
                  {isSubmitting ? <RefreshCw size={12} className="spin" /> : <Play size={12} />}
                  <span>Run Tests</span>
                </button>
                <button 
                  onClick={handleSubmitCode}
                  disabled={isSubmitting}
                  className="btn btn-submit btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', fontWeight: 700 }}
                  title="Submit code for full evaluation & Bug Fingerprint recording"
                >
                  {isSubmitting ? <RefreshCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                  <span>Submit Code</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cognitive Gate: Explain Before You Fix */}
          <div className="practice-cognitive-gate">
            <div 
              className="practice-gate-header"
              onClick={() => setIsEbyfOpen(!isEbyfOpen)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Brain size={15} color="var(--status-warning)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Explain Before You Fix (Cognitive Gate)
                </span>
                {explanation.trim().length >= 5 && (
                  <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                    Hypothesis Ready
                  </span>
                )}
              </div>
              <ChevronDown 
                size={14} 
                style={{ transform: isEbyfOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} 
              />
            </div>

            {isEbyfOpen && (
              <div className="practice-gate-content">
                {ebyfQuestion && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.45 }}>
                    <strong>Prompt:</strong> {ebyfQuestion.question}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="explain-input"
                    placeholder="e.g. The loop termination condition i < numbers.length - 1 misses the last element..."
                    value={explanation}
                    onChange={(e) => {
                      setExplanation(e.target.value);
                      if (e.target.value.trim().length >= 5) setExplanationError(false);
                    }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleSubmitExplanation}
                    disabled={isEbyfSubmitting || explanation.trim().length < 5}
                    title="Submit hypothesis for AI review"
                  >
                    {isEbyfSubmitting ? <RefreshCw size={12} className="spin" /> : <Lightbulb size={13} />}
                    <span>Reflect</span>
                  </button>
                </div>

                {explanationError && (
                  <p style={{ color: 'var(--status-danger)', fontSize: '0.74rem', marginTop: '0.35rem' }}>
                    ⚠️ Please provide an explanation (at least 5 characters) before requesting evaluation!
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Interactive Feedback, Hints, EBYF & Diagnostics */}
        <section className="practice-right-pane">
          {/* Feedback Tabs Bar */}
          <div className="practice-feedback-tabs">
            <button 
              className={`practice-tab-btn ${activeFeedbackTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveFeedbackTab('tests')}
            >
              Tests {testResults && (testResults.status === 'passed' ? '✓' : '✗')}
            </button>
            <button 
              className={`practice-tab-btn ${activeFeedbackTab === 'hints' ? 'active' : ''}`}
              onClick={() => setActiveFeedbackTab('hints')}
            >
              Hints ({Object.keys(unlockedHints).length}/3)
            </button>
            <button 
              className={`practice-tab-btn ${activeFeedbackTab === 'ebyf' ? 'active' : ''}`}
              onClick={() => setActiveFeedbackTab('ebyf')}
            >
              Reasoning {ebyfFeedback && '✓'}
            </button>
            <button 
              className={`practice-tab-btn ${activeFeedbackTab === 'fingerprint' ? 'active' : ''}`}
              onClick={() => setActiveFeedbackTab('fingerprint')}
            >
              Bug Fingerprint
            </button>
            <button 
              className={`practice-tab-btn ${activeFeedbackTab === 'adaptive' ? 'active' : ''}`}
              onClick={() => setActiveFeedbackTab('adaptive')}
            >
              Adaptive Plan
            </button>
          </div>

          <div className="practice-tab-body">
            {/* TAB 1: Test Results */}
            {activeFeedbackTab === 'tests' && (
              <div>
                {!testResults ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                    <Play size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>Ready to evaluate your code.</p>
                    <p style={{ fontSize: '0.78rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                      Press <strong>Verify & Run Tests</strong> (or <kbd>Ctrl+Enter</kbd>) to execute against isolated sandbox runners.
                    </p>
                  </div>
                ) : (
                  <div className="test-results-group">
                    {/* Status summary banner */}
                    {hasCompileError ? (
                      <div className="practice-result-banner fail">
                        <Terminal size={22} color="#ef4444" />
                        <div>
                          <strong style={{ fontSize: '0.86rem', color: '#ef4444' }}>Syntax / Compilation Error Detected</strong>
                          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {testResults.feedback?.summary || 'The program has syntax or compilation defects that prevented execution. Inspect the diagnostic log below.'}
                          </p>
                        </div>
                      </div>
                    ) : testResults.status === 'passed' ? (
                      <div className="practice-result-banner pass">
                        <Award size={22} color="#10b981" />
                        <div>
                          <strong style={{ fontSize: '0.86rem', color: '#10b981' }}>Mission Completed!</strong>
                          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            All public and hidden edge-case tests passed with 100% precision.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="practice-result-banner fail">
                        <AlertCircle size={22} color="#ef4444" />
                        <div>
                          <strong style={{ fontSize: '0.86rem', color: '#ef4444' }}>
                            {testResults.results?.some(t => t.status === 'runtime_error')
                              ? 'Runtime Error Encountered'
                              : (testResults.results?.some(t => t.status === 'timeout') ? 'Execution Timed Out' : 'Execution Failure Detected')}
                          </strong>
                          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {testResults.feedback?.summary || 'Review your boundary conditions or consult the progressive hint ladder.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Individual Test Cards */}
                    {Array.isArray(testResults.results) && testResults.results.map((t, idx) => {
                      const isHidden = t.visibility === 'hidden';

                      if (isHidden) {
                        return (
                          <div key={idx} className={`test-case-card ${t.status === 'passed' ? 'pass' : 'fail'}`}>
                            <div className="test-case-header">
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Shield size={13} color="var(--brand-light)" />
                                <span>Hidden Test Suite ({t.testId})</span>
                              </span>
                              {renderStatusBadge(t.status)}
                            </div>
                            <div className="hidden-test-shield">
                              <Lock size={12} />
                              <span>Hidden inputs & expected values are securely obfuscated per CodeDNA sandbox rules.</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className={`test-case-card ${t.status === 'passed' ? 'pass' : 'fail'}`}>
                          <div className="test-case-header">
                            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                              Public Test #{idx + 1} ({t.testId})
                            </span>
                            {renderStatusBadge(t.status)}
                          </div>
                          <div className="test-details-grid">
                            {t.expected !== undefined && <div><strong>Expected:</strong> <span style={{ color: '#a7f3d0' }}>{t.expected}</span></div>}
                            {t.actual !== undefined && <div><strong>Actual:</strong> <span style={{ color: t.status === 'passed' ? '#a7f3d0' : '#fca5a5' }}>{t.actual || '(no stdout)'}</span></div>}
                          </div>
                          {t.stderr && (
                            <div className="practice-terminal-error-box">
                              <div className="terminal-error-title">
                                <Terminal size={12} color="#ef4444" />
                                <span>{t.status === 'compile_error' ? 'Compiler & Syntax Diagnostic Log' : 'Runtime Trace'}</span>
                              </div>
                              <pre className="terminal-error-text">{t.stderr}</pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Progressive Hints */}
            {activeFeedbackTab === 'hints' && (
              <div className="hint-ladder-group">
                {[1, 2, 3].map((tier) => {
                  const hintObj = unlockedHints[tier];
                  const isUnlocked = Boolean(hintObj);
                  const tierTitles = {
                    1: 'Conceptual Nudge',
                    2: 'Logic & Index Pointer',
                    3: 'Targeted Debugging Direction'
                  };

                  return (
                    <div key={tier} className={`hint-card ${isUnlocked ? 'unlocked' : ''}`}>
                      <div className="hint-header">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isUnlocked ? <Unlock size={14} color="#10b981" /> : <Lock size={14} color="#64748b" />}
                          <span>Level {tier} : {tierTitles[tier]}</span>
                          {isUnlocked && hintObj.isFallback && (
                            <span className="badge badge-neutral" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>Curated</span>
                          )}
                          {isUnlocked && !hintObj.isFallback && (
                            <span className="badge badge-brand" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>AI Powered</span>
                          )}
                        </span>
                        {!isUnlocked && (
                          <button 
                            onClick={() => handleUnlockHint(tier)}
                            disabled={isHintLoading}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                          >
                            {isHintLoading ? 'Loading...' : `Unlock Level ${tier}`}
                          </button>
                        )}
                      </div>
                      <p className="hint-text">
                        {isUnlocked ? hintObj.text : 'Click Unlock Level to reveal progressive assistance without spoiling the direct solution.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: Reasoning Feedback (EBYF) */}
            {activeFeedbackTab === 'ebyf' && (
              <div>
                {!ebyfFeedback ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                    <Brain size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>No reasoning submitted yet.</p>
                    <p style={{ fontSize: '0.78rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                      Type your hypothesis in the cognitive gate and click <strong>Reflect</strong> to evaluate your mental model.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ 
                      padding: '1rem', 
                      background: ebyfFeedback.evaluation === 'correct' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      border: `1px solid ${ebyfFeedback.evaluation === 'correct' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      borderRadius: 'var(--radius-md)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: ebyfFeedback.evaluation === 'correct' ? '#10b981' : '#60a5fa' }}>
                          Evaluation: {ebyfFeedback.evaluation?.toUpperCase() || 'EVALUATED'}
                        </strong>
                        <span className="badge badge-brand" style={{ fontSize: '0.65rem' }}>
                          {ebyfFeedback.isFallback ? 'Pedagogical Heuristic' : 'Gemini AI Evaluator'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {ebyfFeedback.feedback}
                      </p>
                    </div>

                    {ebyfFeedback.understoodCorrectly && (
                      <div className="test-case-card pass">
                        <strong style={{ fontSize: '0.76rem', color: 'var(--status-success)' }}>What You Understood Correctly:</strong>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {ebyfFeedback.understoodCorrectly}
                        </p>
                      </div>
                    )}

                    {ebyfFeedback.toReconsider && (
                      <div className="test-case-card fail">
                        <strong style={{ fontSize: '0.76rem', color: 'var(--status-warning)' }}>Points to Reconsider:</strong>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {ebyfFeedback.toReconsider}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Bug Fingerprint */}
            {activeFeedbackTab === 'fingerprint' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Current Diagnostic Classification
                  </span>
                  <h4 style={{ fontSize: '1rem', marginTop: '0.35rem', color: hasCompileError ? '#f87171' : 'var(--cyan-accent)' }}>
                    {hasCompileError
                      ? 'SYNTAX / COMPILATION ERROR'
                      : (testResults?.fingerprint?.category 
                          ? testResults.fingerprint.category.replace(/_/g, ' ').toUpperCase()
                          : (testResults?.summary?.passed ? 'ALL VERIFICATIONS PASSED' : 'DEFECT ISOLATION IN PROGRESS'))}
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.45 }}>
                    {hasCompileError
                      ? 'The compiler encountered invalid syntax or unexpected tokens before execution. Fix the syntax defect below before analyzing algorithmic boundaries.'
                      : (testResults?.feedback?.suggestion || 'CodeDNA identifies recurring structural patterns in failure traces to optimize deliberate practice.')}
                  </p>
                  {(hasCompileError ? compileErrorText : testResults?.fingerprint?.evidence) && (
                    <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: hasCompileError ? '#fca5a5' : '#94a3b8', whiteSpace: 'pre-wrap' }}>
                      {hasCompileError ? `Compiler Diagnostic:\n${compileErrorText}` : `Evidence: ${testResults.fingerprint.evidence}`}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Recorded Mistake Frequencies (Learner Telemetry):
                  </span>

                  {learnerProgress?.recurringMistakes && learnerProgress.recurringMistakes.length > 0 ? (
                    learnerProgress.recurringMistakes.map((m, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span>{m.patternKey.replace(/_/g, ' ')}</span>
                          <strong style={{ color: 'var(--brand-light)' }}>{m.count} occurrence{m.count > 1 ? 's' : ''}</strong>
                        </div>
                        <div className="progress-bar-wrap">
                          <div className="progress-bar-fill" style={{ width: `${Math.min(100, m.count * 25)}%` }}></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span>Loop Boundary & Off-by-One</span>
                        <strong style={{ color: 'var(--brand-light)' }}>Active tracking</strong>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: '40%' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: Adaptive Plan */}
            {activeFeedbackTab === 'adaptive' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recommendation ? (
                  <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>
                        Strategy: {recommendation.strategy?.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Learner: {activeLearnerId}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      Next Recommended: {recommendation.challenge?.title || 'Reverse a String'}
                    </h4>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                      {recommendation.reason || 'Recommended based on your recurring mistake patterns to solidify fundamentals.'}
                    </p>

                    {recommendation.challenge?.id && recommendation.challenge.id !== activeChallengeId && (
                      <button
                        onClick={() => handleSelectChallenge(recommendation.challenge.id)}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <span>Switch to This Mission</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                    <Compass size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.84rem' }}>Generating adaptive recommendation...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
