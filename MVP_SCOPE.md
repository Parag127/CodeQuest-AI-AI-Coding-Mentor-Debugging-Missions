# MVP Scope — CodeQuest AI & CodeDNA

## 1. Overview
CodeQuest AI (CodeDNA) is a beginner-friendly programming practice platform focused on learning to **debug**, rather than copying pre-generated AI solutions. The initial MVP supports Java and JavaScript challenge submissions, test-by-test feedback, progressive hints, recurring mistake tracking (Bug Fingerprint), an Explain Before You Fix flow, and adaptive recommendations.

## 2. Supported Languages (MVP)
- **JavaScript** (Node.js 18+ / ES Modules)
- **Java** (OpenJDK 17 / 21)

---

## 3. Core Features in MVP

### Frontend Experience
1. **Interactive Navigation & Themes**: Floating glass island navigation bar with live operational probe indicator and dual theme support (Cyber Dark & Canvas Light).
2. **Hero & Pedagogical Journey**: Interactive 4-stage pedagogical journey and typographic showcase.
3. **CodeDNA Debugging Mission Sandbox**:
   - Curated debugging challenges with Java & JavaScript parity.
   - "Explain Before You Fix" cognitive hypothesis gate.
   - 3-tier progressive hint ladder (Conceptual Nudge -> Location/Logic -> Debugging Direction).
   - Safe test evaluation: public tests + obfuscated hidden edge-case tests.
   - Bug Fingerprint profiling & mistake pattern tracking.
4. **Interactive Browser Showcase**: Multi-tab telemetry, CRUD manager, and Docker topology.

### Backend & AI Architecture
1. **Challenge Browsing & Catalog**:
   - Curated challenges (`sum-array`, `reverse-string`, `filter-positive`) with difficulty levels and skill mappings.
   - Public test cases viewable by learner; hidden test cases strictly encapsulated server-side.
2. **Safe Code Execution & Evaluation**:
   - Authoritative test results with per-test verdicts (Passed, Wrong Output, Compile Error, Runtime Error, Timeout).
   - Opaque status reporting for hidden tests (no private inputs or outputs exposed).
3. **AI-Powered Progressive Hints (Gemini API)**:
   - 3 sequential tiers: Conceptual nudge (Level 1), Logic pointer (Level 2), Targeted direction (Level 3).
   - Anti-skipping enforcement and anti-leak output validation blocking markdown code fences and solution phrases.
   - Transparent fallback to curated static hints if Gemini is unconfigured or unavailable.
4. **Explain Before You Fix (EBYF)**:
   - Formulates targeted questions prompting learners to predict values or explain conditions before receiving hints.
   - Evaluates learner explanations and hypotheses with constructive pedagogical feedback.
5. **Bug Fingerprint (Recurring Mistake Classifier)**:
   - Deterministic classification for `loop_boundary`, `wrong_condition`, `wrong_index`, `empty_input`, and `unknown`.
6. **Adaptive Challenge Recommendations**:
   - Recommends existing challenges based on recent results, skill topics, repeated bug fingerprints, and difficulty progression.
7. **Progress Tracking**:
   - Tracks learner attempts, hints used, solve status, and recurring mistake frequencies via `learnerId`.

---

## 4. Out of Scope for MVP (Future Roadmap)
- Multi-tenant enterprise SSO (session/localStorage UUID and demo auth used in MVP).
- Persistent PostgreSQL/Redis clustering (in-memory SQLite/store used in MVP).
- Arbitrary untrusted bytecode execution outside sandbox limits.
- Learner-created challenge authoring and community marketplace.
- Real-time multiplayer or live chat.
