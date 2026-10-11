# DebugMate — Team Workflow & Collaboration Rules

## 1. Branching Strategy
- `main`: Production-ready, stable codebase.
- `ai-features`: Dedicated branch for AI integration, Bug Fingerprint, progressive hints, and EBYF.
- `backend`: Backend API routes, database schemas, and code runner integration.
- `frontend`: React SPA, code editor, and telemetry dashboards.

## 2. Commit & Collaboration Rules
- Always pull latest changes before branching or merging (`git pull origin main`).
- Write small, self-contained commits with clear messages.
- Never commit `.env` files or hardcoded credentials.
- Do not modify API contracts unilaterally without team alignment.
- Run tests (`npm test` / `npm.cmd test --prefix backend`) before pushing or creating pull requests.

## 3. Definition of Done
A task is considered complete when:
1. Behavior is implemented according to specifications in `SYSTEM_DESIGN.md` and `API_CONTRACT.md`.
2. Automated unit or integration tests pass.
3. Loading, error, and empty states are handled.
4. Security and privacy rules (no secret exposure, no hidden test leakage) are respected.
5. Relevant documentation is updated.
