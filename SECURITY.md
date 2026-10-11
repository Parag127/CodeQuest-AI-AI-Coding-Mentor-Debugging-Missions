# Security Policy & Execution Rules — CodeQuest AI

## Mandatory Security Rules (Non-Negotiable)

1. **Zero Direct Host Shell Execution**:
   - Learner code must **never** be executed directly in the Express/Node.js host process or with unrestricted shell execution (`child_process.exec`, `eval()`).
   - Untrusted code submissions must be evaluated strictly inside isolated sandboxes with wall-clock timeouts (maximum 2000ms), memory limits, and network egress disabled.

2. **Hidden Test Obfuscation**:
   - Hidden test inputs and expected values must **never** be returned to the browser client or included in prompts sent to third-party AI models.
   - The server may return only the status (`PASSED` | `FAILED`) and an opaque hash identifier (e.g. `hidden-01`).

3. **Untrusted Input Sanitation**:
   - All learner-submitted code, explanations, and strings are treated as untrusted input.
   - Express applies request-size limits (`1mb`), input validation, and sanitization to prevent prompt injection or JSON flooding.

4. **Secrets Management**:
   - Provider API keys and environment variables must remain strictly server-side.
   - Never commit `.env` files or expose credentials through `VITE_*` public variables.

5. **Container Privilege Minimization**:
   - Production backend containers run under the unprivileged `node` user instead of root.
   - File system write permissions are restricted to temporary scratch directories.
