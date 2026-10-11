# CodeQuest AI & CodeDNA — API Contract (Frontend / Backend Agreement)

This document defines the interface and agreement between the frontend client and backend microservices.

## General Rules
- Base path: `/api`.
- Request and response bodies: JSON (`Content-Type: application/json`).
- Supported language IDs: `javascript`, `java`.
- Request body limit: 100 KB; code size limit: 64 KB.
- Validates all fields and rejects unknown challenge IDs.
- **Privacy & Security:** Responses must never include hidden test inputs, expected outputs, or internal grading secrets.

---

## 1. System Health & Probes

### GET `/api/health`
Used by Docker Compose healthchecks, frontend monitors, and telemetry dashboards.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "service": "codedna-api",
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

### GET `/api/info`
Provides hardware and operating system telemetry for the container execution environment.

**Response `200 OK`**:
```json
{
  "hostname": "backend-container",
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

## 2. User Authentication & Session Endpoints

### POST `/api/auth/login`
Authenticates a learner or lead reviewer. Supports 1-click hackathon demo accounts (`learner@dypatil.edu` and `mentor@dypatil.edu`).

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

### POST `/api/auth/register`
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

## 3. Sprint Items & Telemetry CRUD

### GET `/api/items`
Fetches hackathon sprint items.

**Response `200 OK`**:
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "title": "Dockerize Backend Service",
      "category": "DevOps",
      "status": "Completed",
      "timestamp": "2026-10-11T06:30:10.073Z"
    }
  ]
}
```

### POST `/api/items`
Creates a new sprint item.

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

### DELETE `/api/items/:id`
Deletes a sprint item by numeric ID.

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Item 1 deleted successfully"
}
```

---

## 4. CodeDNA Challenges

### GET `/api/challenges`
Returns catalog of active challenges. Excludes all test cases.

**Response `200 OK`**:
```json
{
  "challenges": [
    {
      "id": "largest-number",
      "title": "Find the largest number",
      "difficulty": "easy",
      "concept": "loop_boundary",
      "languages": ["javascript", "java"]
    },
    {
      "id": "reverse-string",
      "title": "Reverse a String",
      "difficulty": "easy",
      "concept": "string_reversal",
      "languages": ["javascript", "java"]
    }
  ]
}
```

### GET `/api/challenges/:id`
Returns challenge details, starter code, and visible test cases only. Hidden test cases are strictly excluded server-side.

**Response `200 OK`**:
```json
{
  "challenge": {
    "id": "largest-number",
    "title": "Find the largest number",
    "difficulty": "easy",
    "concept": "loop_boundary",
    "description": "Debug the program so it prints the largest integer in the input array.",
    "languages": ["javascript", "java"],
    "starterCode": {
      "javascript": "const fs = require('fs');\n...",
      "java": "import java.util.Scanner;\n..."
    },
    "visibleTests": [
      {
        "id": "visible-1",
        "stdin": "4\n2 5 1 9\n",
        "expectedStdout": "9\n"
      }
    ]
  }
}
```

**Response `404 Not Found`**:
```json
{
  "error": {
    "code": "CHALLENGE_NOT_FOUND",
    "message": "Challenge 'unknown-id' not found"
  }
}
```

---

## 5. CodeDNA Submissions & Execution

### POST `/api/submissions`
Dispatches learner code to isolated execution runner (Judge0).

**Request Body**:
```json
{
  "challengeId": "largest-number",
  "language": "javascript",
  "code": "function findLargest(numbers) { ... }",
  "prediction": "The loop visits all array elements.",
  "explanation": "I think the loop ends after the last index."
}
```

**Response `200 OK`**:
```json
{
  "submissionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "failed",
  "results": [
    {
      "testId": "visible-1",
      "visibility": "visible",
      "status": "wrong_output",
      "expected": "9\n",
      "actual": "5\n"
    },
    {
      "testId": "hidden-1",
      "visibility": "hidden",
      "status": "passed"
    }
  ],
  "feedback": {
    "summary": "The loop may be stopping before it visits every element or iterating out of bounds.",
    "bugCategory": "loop_boundary",
    "hintLevelAvailable": 1
  }
}
```

**Privacy Guarantee on Hidden Tests:**
- Hidden test cases (`is_public = 0`) return only: `{ "testId": "hidden-1", "visibility": "hidden", "status": "..." }`.
- Expected/actual outputs, stdin, and stderr for hidden tests are never exposed to browser responses or AI prompts.

---

## 6. Progressive Hints & AI Explanations

### POST `/api/hints`
Requests a 3-tier progressive hint for a submission.

**Request Body**:
```json
{
  "submissionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "hintLevel": 1,
  "learnerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response `200 OK`**:
```json
{
  "hintLevel": 1,
  "hint": "The loop may be stopping before it visits every element. Look closely at the loop continuation condition.",
  "isFallback": true
}
```

### POST `/api/hints/explain-before-fix`
Provides non-evaluative pedagogical reflection before unlocking hints.

**Request Body**:
```json
{
  "submissionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "prediction": "The loop visits all items except the last",
  "explanation": "Because the index condition uses strictly less than numbers.length - 1"
}
```

**Response `200 OK`**:
```json
{
  "feedback": "Thank you for reflecting on your code. Articulating your mental model helps uncover logical assumptions.",
  "canProceedToHint": true
}
```
