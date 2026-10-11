# CodeDNA — MVP Scope Document

## 1. Executive Summary
CodeDNA is an educational coding platform that helps beginner programmers learn how to debug rather than simply giving away solutions. The MVP focuses on Java and JavaScript code challenges, progressive 3-level hinting with Gemini API, Explain Before You Fix (EBYF) reflection, and recurring mistake tracking via Bug Fingerprint.

## 2. Supported Languages (MVP)
- **JavaScript** (Node.js 18 / ES Modules)
- **Java** (OpenJDK 17)

## 3. Core Features in MVP
1. **Challenge Browsing**:
   - Access seed coding challenges (beginner-friendly array and algorithmic tasks).
   - Public test cases viewable by learner; hidden test cases strictly encapsulated server-side.
2. **Safe Code Execution & Test Evaluation**:
   - Isolated execution with time and memory resource limits.
   - Per-test feedback (Passed, Wrong Output, Compilation Error, Runtime Error, Timeout).
   - Opaque status reporting for hidden tests (no stdout/stderr or hidden test data sent to client or AI).
3. **AI-Powered Progressive Hints (Gemini API)**:
   - Level 1: General conceptual guidance.
   - Level 2: Specific clues on logic/boundaries without code.
   - Level 3: Targeted pointers to specific expressions/operators.
   - Hard output validation to prevent solution or code leaking.
   - Automatic fallback to static curated hints if Gemini is offline or fails validation.
4. **Explain Before You Fix (EBYF)**:
   - Mandatory hypothesis submission before receiving Level 1 hint on a failed submission.
   - 1-2 sentence non-evaluative AI feedback acknowledging reasoning without giving verdicts.
5. **Bug Fingerprint (Recurring Mistake Classifier)**:
   - Rule-based detection of:
     - `off_by_one`: Output differs from expected by +/- 1 unit.
     - `loop_condition`: Boundary comparisons such as `<= arr.length`.
     - `array_index_error`: Index out of bounds in Java or JS.
     - `empty_input_unhandled`: Fails on empty arrays, strings, or zero values.
     - `null_dereference`: Null pointer or undefined property access.
6. **Progress Tracking**:
   - Anonymous learner session via `learnerId` UUID.
   - Attempt counts, hints used, solve status, and frequency counts for recurring mistake patterns.

## 4. Out of Scope for MVP
- User authentication, passwords, or persistent account management (session/localStorage UUID used).
- Full Judge0 CE local cluster orchestration in standard dev (RapidAPI hosted / simulated fallback supported).
- Multi-file projects, third-party libraries, or languages other than Java and JavaScript.
- Learner-created challenges.
- Real-time multiplayer or live chat.
- Mobile native application.
