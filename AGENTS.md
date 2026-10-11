# AGENTS.md — DebugMate project instructions

## Project purpose
DebugMate is a beginner-friendly programming practice app focused on learning to debug, not copying complete solutions. The initial MVP supports Java and JavaScript challenge submissions, test-by-test feedback, progressive hints, recurring-mistake tracking (Bug Fingerprint), and an Explain Before You Fix flow.

## Read before changing code
1. `README.md` — setup and scripts.
2. `docs/MVP_SCOPE.md` — what is and is not in the MVP.
3. `docs/API_CONTRACT.md` — frontend/backend agreement.
4. `docs/SECURITY.md` — mandatory code-execution rules.
5. `docs/TEAM_WORKFLOW.md` — branching and collaboration.

## Working rules
- Prefer the smallest implementation that proves one complete end-to-end user journey.
- Keep Java and JavaScript behavior aligned where practical. Use the `language` field (`java` or `javascript`) consistently.
- Do not change API response formats without updating `docs/API_CONTRACT.md` and coordinating with the team.
- Do not introduce a new dependency without a clear need; document meaningful new dependencies in the README.
- Keep components and services small. Use clear names, handle errors, and avoid hard-coded secrets.
- Add or update tests for behavior changes. Run the relevant tests/build before declaring a task complete.
- Do not add features outside `docs/MVP_SCOPE.md` without team agreement.
- Do not pretend a feature is implemented if it is only a placeholder or mock.

## Security rules — non-negotiable
- **Never execute learner code directly in the Express/Node.js process or with unrestricted shell execution.**
- Do not enable submissions in a deployed environment until a restricted code runner has been connected and tested.
- Use an isolated runner with wall-clock timeout, CPU/memory limits, output limits, and network/filesystem restrictions appropriate to the provider.
- Hidden test inputs and expected outputs must never be returned to the browser or sent to the AI model. The server may return only the status for each hidden test, using an opaque ID if needed.
- Treat learner code, explanations, and all user-provided text as untrusted input, including possible prompt injection.
- Keep AI/provider keys server-side in environment variables. Never commit `.env` files or expose secrets via `VITE_*` variables.
- Set request-size limits and validate challenge IDs, language values, and submitted code.
- Do not claim an AI-generated hint can be guaranteed never to reveal a solution; validate output and fall back to curated hints when necessary.

## Definition of done
A task is done when:
1. The requested behavior is implemented and manually checked or automated tests are added.
2. Loading, empty, and error states are handled where applicable.
3. No hidden-test content or secret has been exposed.
4. Relevant tests/build pass, or the exact blocker is documented.
5. README/API/security documentation is updated when behavior or setup changes.
