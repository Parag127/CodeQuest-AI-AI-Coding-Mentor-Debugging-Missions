# API Contract — CodeQuest AI & CodeDNA

Base URL: `http://localhost:5000` (Direct) or `/api/*` (via Frontend Reverse Proxy)

All request bodies and responses use `application/json`.
Request payload limit: 100 KB (`express.json({ limit: '100kb' })`).

---

## 1. System Health & Container Diagnostics

### `GET /api/health`
Used by Docker Compose healthcheck probes, Kubernetes probes, and the frontend telemetry monitor.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-11T06:30:18.028Z",
  "uptimeSeconds": 142,
  "environment": "development",
  "isDocker": true,
  "memoryUsageMB": {
    "rss": 63,
    "heapTotal": 13,
    "heapUsed": 10
  }
}
```

---

### `GET /api/info`
Provides hardware, architecture, and container execution telemetry.

**Response `200 OK`**:
```json
{
  "hostname": "backend-container-id",
  "platform": "linux",
  "arch": "x64",
  "nodeVersion": "v20.18.0",
  "isDocker": true,
  "port": 5000,
  "cpus": 4,
  "totalMemoryMB": 16384,
  "freeMemoryMB": 8192
}
```

---

## 2. User Authentication & Sessions

### `POST /api/auth/login`
Authenticates a learner or reviewer. Supports 1-click hackathon demo accounts (`learner@dypatil.edu` and `mentor@dypatil.edu`).

**Request Body**:
```json
{
  "email": "learner@dypatil.edu",
  "password": "password123",
  "role": "learner"
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "token": "MTpsZWFybmVyQGR5cGF0aWwuZWR1OjE3OTE3MDIyMjAxODM=",
  "user": {
    "id": 1,
    "name": "Hackathon Learner",
    "email": "learner@dypatil.edu",
    "role": "learner",
    "avatar": "HL",
    "level": "Level 4 • Bug Hunter",
    "xp": 1420
  }
}
```

---

### `POST /api/auth/register`
Registers a new learner or reviewer account.

**Request Body**:
```json
{
  "name": "Parag Patil",
  "email": "parag@dypatil.edu",
  "password": "securePassword123",
  "role": "learner"
}
```

**Response `201 Created`**:
```json
{
  "success": true,
  "token": "MTc5MTcwMjIyOTM0MDpwYXJhZ0BkeXBhdGlsLmVkdToxNzkxNzAyMjI5MzQw",
  "user": {
    "id": 1791702229340,
    "name": "Parag Patil",
    "email": "parag@dypatil.edu",
    "role": "learner",
    "avatar": "PA",
    "level": "Level 1 • Junior Debugger",
    "xp": 0
  }
}
```

---

## 3. Sprint Items & Microservice CRUD

### `GET /api/items`
Fetches all demo tasks and sprint items.

**Response `200 OK`**:
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": 1,
      "title": "Dockerize Backend Service",
      "category": "DevOps",
      "status": "Completed",
      "timestamp": "2026-10-11T05:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/items`
Creates a new sprint task item.

**Request Body**:
```json
{
  "title": "Deploy Sandboxed Java Runner",
  "category": "Infrastructure",
  "status": "In Progress"
}
```

**Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": 1773297010073,
    "title": "Deploy Sandboxed Java Runner",
    "category": "Infrastructure",
    "status": "In Progress",
    "timestamp": "2026-10-11T06:35:00.000Z"
  }
}
```

---

### `DELETE /api/items/:id`
Deletes an item by numeric ID.

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Item 1 deleted successfully"
}
```

---

## 4. Challenge Endpoints

### `GET /api/challenges`
Returns a list of all active coding challenges. Hidden test cases are strictly excluded.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "sum-array",
      "title": "Sum of Array Elements",
      "description": "Write a function that calculates and returns the sum...",
      "difficulty": "beginner",
      "languages": ["javascript", "java"]
    }
  ]
}
```

---

### `GET /api/challenges/:id`
Returns challenge details and public test cases only. Hidden test inputs and expected outputs are never returned.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "sum-array",
    "title": "Sum of Array Elements",
    "description": "Write a function...",
    "difficulty": "beginner",
    "languages": ["javascript", "java"],
    "hintFallbacks": {
      "1": "Think about how you initialize your sum accumulator...",
      "2": "Pay close attention to your loop initialization...",
      "3": "Make sure your loop index starts at 0..."
    },
    "publicTestCases": [
      {
        "id": "sa-pub-1",
        "stdin": "[1, 2, 3, 4]",
        "expected_output": "10"
      }
    ]
  }
}
```

---

## 5. Submission Endpoints

### `POST /api/submissions`
Submits code for evaluation. Evaluates tests, classifies Bug Fingerprints, and masks hidden test details.

**Request Body**:
```json
{
  "challengeId": "sum-array",
  "language": "javascript",
  "code": "function sumArray(arr) { ... }",
  "learnerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation**:
- `challengeId`: must exist.
- `language`: must be `"java"` or `"javascript"`.
- `code`: string, max 64 KB (65,536 bytes).
- `learnerId`: non-empty string / UUID.

**Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "submissionId": "sub-1718000000-abc12",
    "passCount": 1,
    "failCount": 1,
    "totalTests": 2,
    "testResults": [
      {
        "testCaseId": "sa-pub-1",
        "isPublic": true,
        "status": "passed",
        "stdout": "10",
        "stderr": "",
        "timeMs": 15,
        "memoryKb": 1024
      },
      {
        "testCaseId": "sa-hid-1",
        "isPublic": false,
        "status": "wrong_output",
        "stdout": null,
        "stderr": null,
        "timeMs": null,
        "memoryKb": null
      }
    ],
    "bugFingerprints": ["loop_boundary"]
  }
}
```

---

## 6. AI Submission Feedback Endpoint

### `POST /api/ai/feedback`
Generates structured diagnostic feedback after a learner submits code, analyzing the likely cause of failure and recommending the next debugging step.

**Request Body**:
```json
{
  "code": "function sumArray(arr) { ... }",
  "language": "javascript",
  "challengeTitle": "Sum of Array Elements",
  "challengeDescription": "Calculate and return the sum of all elements.",
  "executionResults": {
    "status": "wrong_output",
    "passCount": 1,
    "failCount": 1,
    "totalTests": 2,
    "testResults": [
      {
        "testCaseId": "pub-1",
        "isPublic": true,
        "status": "passed",
        "stdout": "10",
        "stdin": "[1, 2, 3, 4]",
        "expected_output": "10"
      },
      {
        "testCaseId": "hid-1",
        "isPublic": false,
        "status": "wrong_output",
        "stdout": null,
        "stdin": "SECRET_TEST",
        "expected_output": "SECRET_OUT"
      }
    ]
  }
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "executionStatus": "wrong_output",
    "passCount": 1,
    "failCount": 1,
    "totalTests": 2,
    "summary": "Your code completed execution, but the output did not match what was expected.",
    "likelyIssue": "The calculation logic or edge case handling differs from the expected problem behavior.",
    "nextStep": "Walk through your algorithm line by line with a small sample input and check your boundary cases.",
    "isFallback": false
  }
}
```

---

## 7. Explain Before You Fix (EBYF) Endpoints

### `POST /api/explain-before-fix/question`
Generates a short, targeted question prompting the learner to predict a value, explain a condition, or identify the likely cause before unlocking hints.

**Request Body**:
```json
{
  "submissionId": "sub-1718000000-abc12",
  "learnerId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "for(let i=0; i<=arr.length; i++) sum+=arr[i];",
  "language": "javascript",
  "challengeId": "sum-array"
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "questionId": "ebyf-q-1718000000-abc12",
    "submissionId": "sub-1718000000-abc12",
    "question": "Look closely at your loop stopping condition: what is the value of your loop index on the final iteration, and does it exceed the array bounds?",
    "questionType": "explain_condition",
    "context": "For public input [1, 2, 3], expected output is 6. Check whether your loop index reaches array.length.",
    "isFallback": false
  }
}
```

---

### `GET /api/explain-before-fix/question`
Fetches or generates the EBYF question for a submission.

**Query Parameters**:
- `submissionId` (string, required)
- `learnerId` (string, required)

---

### `POST /api/explain-before-fix`
Evaluates the learner's explanation against the known concept and authoritative execution result. Accepts reasonable alternative explanations.

**Request Body**:
```json
{
  "submissionId": "sub-1718000000-abc12",
  "learnerId": "550e8400-e29b-41d4-a716-446655440000",
  "explanation": "I believe the loop index i goes one past the end because it uses <= arr.length",
  "predictedVariable": "i",
  "predictedValue": "arr.length"
}
```

**Validation & Safety Rules**:
- `explanation`: string, minimum 5 characters, maximum 4000 characters.
- `submissionId` and `learnerId`: required strings.
- `code` (if passed): maximum 64 KB.
- Hidden tests are strictly protected: no hidden tests or expected outputs are exposed to AI or learner.
- Evaluates pedagogical understanding without requiring an exact sentence match.
- If AI is unavailable or fails, returns a rule-based fallback evaluation.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "feedback": "Spot-on reflection! You accurately identified that the loop boundary condition causes an off-by-one or out-of-bounds error. Check your loop comparison operator against the array length.",
    "evaluation": "correct",
    "understoodCorrectly": "You accurately recognized that the loop boundary or index traversal is causing an out-of-bounds or off-by-one issue.",
    "toReconsider": "Check whether switching your loop comparison from <= to < or adjusting your stopping index resolves the issue.",
    "canProceedToHint": true,
    "isFallback": false
  }
}
```

---

### `GET /api/explain-before-fix/status/:learnerId/:submissionId`
Returns whether the learner has completed the EBYF reflection step.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "hasCompletedEbyf": true,
    "record": { ... }
  }
}
```

---

## 8. AI Hint Endpoints

### `POST /api/hints`
Requests a progressive hint (Level 1, 2, or 3) for a submission or code attempt.

**Progressive Hint Levels**:
- **Level 1 (Conceptual nudge)**: Ask a guiding question pointing to the concept or boundary conditions. No code or line references.
- **Level 2 (Logic / loop / index pointer)**: Direct attention to the relevant logic, condition, loop, index, or edge case without writing solution code.
- **Level 3 (Targeted debugging direction)**: Specific debugging direction pinpointing the problematic condition, expression, or comparison without giving away full code.

**Request Body (Using `submissionId`)**:
```json
{
  "submissionId": "sub-1718000000-abc12",
  "hintLevel": 1,
  "learnerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Request Body (Direct / Interactive with code payload)**:
```json
{
  "submissionId": "sub-optional-id",
  "code": "function sumArray(arr) { ... }",
  "language": "javascript",
  "challengeTitle": "Sum of Array Elements",
  "challengeDescription": "Calculate and return the sum of all elements.",
  "publicExamples": [
    { "input": "[1, 2, 3]", "output": "6" }
  ],
  "executionSummary": {
    "status": "wrong_output",
    "passCount": 1,
    "failCount": 1,
    "totalTests": 2
  },
  "hintLevel": 1,
  "learnerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation & Safety Rules**:
- `hintLevel`: integer, must be `1`, `2`, or `3`.
- `code` payload limit: maximum 64 KB (`413 Payload Too Large` returned if exceeded).
- `learnerId`: required string.
- Level progression: learners cannot skip levels (cannot request 2 before 1, or 3 before 2) based on authoritative server-side history.
- Repeated requests for an already unlocked level are returned idempotently with `"isRepeated": true` without inflating hint counts.
- Hidden test data protection: hidden test inputs and expected outputs are strictly filtered out and never sent to Gemini.
- Solution-leaking safety: output is screened for raw markdown code blocks (` ``` `) and answer-revealing phrases. If detected, a safe pedagogical static fallback is returned.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "hintLevel": 1,
    "hint": "Think about how your loop bounds interact with zero-indexed array lengths.",
    "isFallback": false,
    "isRepeated": false
  }
}
```

---

## 9. Adaptive Challenge Recommendation Endpoints

### `GET /api/recommendations/:learnerId`
Recommends an existing challenge from the catalog based on the learner's recent results, skill topics, recurring Bug Fingerprints, and difficulty progression.

**Query Parameters**:
- `currentChallengeId` (string, optional): Current challenge ID to avoid immediate repetition.
- `allowReview` (boolean, optional): If `true`, permits recommending already completed challenges for review when all challenges are solved.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "challenge": {
      "id": "reverse-string",
      "title": "Reverse a String",
      "description": "Write a function that returns the reverse of a given string. Return an empty string if the input is empty.",
      "difficulty": "beginner",
      "skills": ["strings", "loops", "indexing"],
      "targetedPatterns": ["loop_boundary", "wrong_index", "empty_input"],
      "languages": ["javascript", "java"]
    },
    "reason": "Recommended to help you master loop boundary conditions and eliminate off-by-one errors based on your recent attempts.",
    "strategy": "repeated_mistake_remediation",
    "learnerId": "550e8400-e29b-41d4-a716-446655440000",
    "catalogCompleted": false
  }
}
```

**Strategies**:
- `new_learner_default`: Foundational beginner challenge for learners with missing or zero-attempt history.
- `repeated_mistake_remediation`: Targets an unsolved challenge addressing the learner's top recurring bug pattern.
- `difficulty_progression`: Advances learner to next difficulty tier (e.g. beginner to intermediate) after solving prerequisites.
- `skill_expansion`: Recommends an unsolved challenge in current tier to expand into new skill topics.
- `intentional_review`: Recommends challenge with highest hints/attempts when all challenges are solved and `allowReview` is enabled.
- `catalog_completed`: Returned when all catalog challenges are solved and `allowReview` is disabled.

---

### `POST /api/recommendations`
Supports recommendation generation via request body payload.

**Request Body**:
```json
{
  "learnerId": "550e8400-e29b-41d4-a716-446655440000",
  "currentChallengeId": "sum-array",
  "allowReview": false
}
```

---

## 10. Learning Progress Endpoint

### `GET /api/progress/:learnerId`
Returns learning telemetry, attempt counts, and frequency of recurring bug patterns.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "learnerId": "550e8400-e29b-41d4-a716-446655440000",
    "challenges": [
      {
        "challengeId": "sum-array",
        "title": "Sum of Array Elements",
        "difficulty": "beginner",
        "attempts": 3,
        "hintsUsed": 1,
        "bestPassCount": 4,
        "totalTests": 5,
        "solved": false,
        "lastAttemptAt": "2026-10-11T12:00:00.000Z"
      }
    ],
    "recurringMistakes": [
      { "patternKey": "loop_boundary", "count": 2 },
      { "patternKey": "wrong_index", "count": 1 }
    ]
  }
}
```

---

## 11. AI Health & Connectivity Endpoint

### `GET /api/ai/health`
Verifies Gemini service readiness and live response capability without exposing keys or credentials.

**Response `200 OK` (Configured & Healthy)**:
```json
{
  "success": true,
  "service": "gemini",
  "status": "healthy",
  "model": "gemini-1.5-flash",
  "latencyMs": 142
}
```

**Response `503 Service Unavailable` (Unconfigured)**:
```json
{
  "success": false,
  "service": "gemini",
  "status": "unconfigured",
  "error": "GEMINI_API_KEY is not configured"
}
```

**Response `502 Bad Gateway` (Upstream API Failure / Timeout)**:
```json
{
  "success": false,
  "service": "gemini",
  "status": "error",
  "error": "Gemini API call failed"
}
```
