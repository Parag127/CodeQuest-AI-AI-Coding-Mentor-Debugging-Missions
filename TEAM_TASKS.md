# CodeDNA — Team Task Allocation & Roadmap

## 1. Team Responsibilities

### Member 1: Frontend & User Experience
- Setup React Router with routes (`/`, `/challenge/:id`, `/progress`).
- Replace Docker demo UI with CodeDNA UI.
- Implement Monaco Editor or CodeMirror with Java and JavaScript syntax highlighting.
- Build Results Panel displaying per-test outcomes and Bug Fingerprint tags.
- Build Explain Before You Fix (EBYF) modal and Hint progression panel (Levels 1–3).
- Manage anonymous `learnerId` in `localStorage`.
- Build Progress Page with attempt metrics and recurring mistake badges.

### Member 2: Backend Core, DB & Code Runner
- SQLite schema and initialization migration.
- Challenge repository and seed data.
- Judge0 CE integration service (`judgeService.js`).
- Privacy filters for hidden test results.
- Input validation middleware and 100KB request size limits.
- Container security and Docker Compose healthcheck adjustments.

### Member 3: AI Integration & Learning Logic
- **Completed**: Gemini API service ([backend/src/services/geminiService.js](file:///backend/src/services/geminiService.js)) with prompt engineering, progressive hints (Levels 1–3), submission diagnostics feedback, EBYF feedback, output safety validation, timeout handling, and static fallbacks.
- **Completed**: Connectivity and health check endpoint (`GET /api/ai/health`).
- **Completed**: Bug Fingerprint deterministic classifier ([backend/src/services/bugFingerprint.js](file:///backend/src/services/bugFingerprint.js)) classifying 5 canonical categories (`loop_boundary`, `wrong_condition`, `wrong_index`, `empty_input`, `unknown`) with structured evidence and confidence ratings.
- **Completed**: AI submission feedback route (`POST /api/ai/feedback`) explaining causes of failure and next debugging steps without overriding test metrics.
- **Completed**: Progressive hints route (`POST /api/hints`) with sequential level enforcement (1 -> 2 -> 3), repeated request idempotency, and hidden test isolation.
- **Completed**: Explain Before You Fix flow ([backend/src/routes/explainBeforeFix.js](file:///backend/src/routes/explainBeforeFix.js)) with question generation, evaluation against known failure concepts, constructive feedback, and hint unlocking.
- **Completed**: Adaptive challenge recommendation engine ([backend/src/services/recommendationService.js](file:///backend/src/services/recommendationService.js) and [backend/src/routes/recommendations.js](file:///backend/src/routes/recommendations.js)) providing rule-based progression, mistake remediation, and beginner defaults.
- **Completed**: Learning progress & recurring mistakes route (`GET /api/progress/:learnerId`).
- **Completed**: Automated test suite with 109 passing unit and integration tests across 48 suites (mocked client, 0 network dependencies).
- **Completed**: Environment template configuration (`GEMINI_API_KEY`).

---

## 2. Milestone Checklist
- [x] Minimal Gemini Service with secret sanitization & timeout handling
- [x] Backend AI health check endpoint (`GET /api/ai/health`)
- [x] AI Submission Feedback API (`POST /api/ai/feedback`)
- [x] Progressive Hints API (Levels 1–3) with output safety validation (`POST /api/hints`)
- [x] Deterministic Bug Fingerprint classifier (`backend/src/services/bugFingerprint.js`)
- [x] Explain Before You Fix (EBYF) flow with question generation & explanation evaluation (`POST /api/explain-before-fix`)
- [x] Adaptive Challenge Recommendation API (`GET /api/recommendations/:learnerId`)
- [x] Learning Progress & Recurring Mistakes API (`GET /api/progress/:learnerId`)
- [x] Automated test suite with mocked Gemini client (109 passing tests)
- [ ] Frontend CodeDNA components integration (Member 1)
- [ ] Live Judge0 code execution runner (Member 2)
