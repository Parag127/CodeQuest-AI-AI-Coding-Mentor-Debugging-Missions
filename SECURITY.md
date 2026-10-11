# Security Policy & Execution Rules — DebugMate

## Mandatory Security Rules (Non-Negotiable)

### 1. Untrusted Code Isolation Boundary
- **Never execute learner code directly in the Node.js / Express process or with unrestricted host shell execution.**
- Untrusted code submissions must be evaluated strictly inside isolated sandboxes (e.g., Judge0 CE or gVisor container) with strict resource bounds:
  - CPU limit: 5 seconds
  - Wall-clock time limit: 10 seconds (default 2000ms per test execution)
  - Memory limit: 128 MB (131,072 KB)
  - Process/thread limit: 30 processes
  - Output limit: 2,048 KB
  - Network: completely disabled (`enable_network: false`, no egress)

### 2. Protection of Hidden Test Cases
- Hidden test inputs (`stdin`) and expected outputs must **NEVER** be returned to the browser client or included in prompts sent to third-party AI models.
- When reporting hidden test outcomes, the server returns only the status (e.g., `passed`, `wrong_output`) and an opaque ID. Fields `stdout`, `stderr`, `timeMs`, and `memoryKb` are strictly nulled out.

### 3. Gemini API Security & Prompt Injection Defense
- `GEMINI_API_KEY` is loaded exclusively from backend environment variables (`process.env.GEMINI_API_KEY`).
- Secrets must never be committed to git, exposed in client bundles, or exposed via `VITE_*` variables.
- All learner code and explanations are treated as untrusted input, wrapped in delimiter tags with explicit system instructions to ignore prompt injection:
  ```
  <UNTRUSTED_LEARNER_CODE>
  ...
  </UNTRUSTED_LEARNER_CODE>
  ```
- System prompts explicitly direct Gemini to ignore any instructions embedded in learner code.

### 4. AI Hint Output Validation & Anti-Leak Safeguards
All AI outputs are validated server-side before delivery to learners:
- Disallowed content: markdown code blocks (```` ``` ````), direct fixes, or solution phrases (`"the correct code"`, `"here is the fix"`, `"the answer is"`).
- Word count bounds: 10 to 300 words for hints; 5 to 100 words for reflection feedback.
- If validation fails or Gemini encounters errors/timeouts, the server transparently falls back to curated static hints and marks `isFallback: true`.

### 5. Request Hardening & Container Privileges
- Body size limiter: `express.json({ limit: '100kb' })`.
- Code payload limiter: submissions reject code strings exceeding 64 KB (65,536 bytes) with `HTTP 413`.
- Parameter sanitization: validation on language (`'java' | 'javascript'`), learner IDs, and hint levels (`1..3`).
- Production backend containers run under the unprivileged `node` user instead of root.

