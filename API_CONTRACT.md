# CodeDNA — API Contract Specification

Base URL: `http://localhost:5000` (Direct) or `/api/*` (via Frontend Reverse Proxy)

All request bodies and responses use `application/json`.
Request payload limit: 100 KB (`express.json({ limit: '100kb' })`).

---

## 1. Challenge Endpoints

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

**Response `404 Not Found`**:
```json
{
  "success": false,
  "error": "Challenge not found"
}
```

---

## 2. Submission Endpoints

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
    "bugFingerprints": ["loop_condition"]
  }
}
```

---

## 3. Explain Before You Fix (EBYF) Endpoint

### `POST /api/explain-before-fix`
Allows learners to reflect on the bug hypothesis before unlocking hints.

**Request Body**:
```json
{
  "submissionId": "sub-1718000000-abc12",
  "learnerId": "550e8400-e29b-41d4-a716-446655440000",
  "explanation": "I believe the loop index goes one past the end of the array",
  "predictedVariable": "i",
  "predictedValue": "arr.length"
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "feedback": "Thinking through variable bounds on boundary conditions is a great debugging strategy.",
    "canProceedToHint": true
  }
}
```

---

## 4. AI Hint Endpoints

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

**Response `400 Bad Request` (Level Skipping Attempt)**:
```json
{
  "success": false,
  "error": "Cannot skip hint levels. Please request Level 1 first."
}
```

---

## 5. Learning Progress Endpoint

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
      { "patternKey": "loop_condition", "count": 2 },
      { "patternKey": "off_by_one", "count": 1 }
    ]
  }
}
```

---

## 6. AI Health & Connectivity Endpoint

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

---

## 7. AI Submission Feedback Endpoint

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


