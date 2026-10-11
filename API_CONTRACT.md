# API Contract — DebugMate & CodeDNA

This document defines the interface between the frontend client and the backend services.

---

## 1. System Health & Probes

### `GET /api/health`
Used by the Docker Compose healthcheck probe, Kubernetes probes, and the frontend telemetry dashboard.

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

## 2. Container & Host Specifications

### `GET /api/info`
Provides hardware and operating system telemetry for the container execution environment.

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

## 3. Sprint Items & Microservice CRUD

### `GET /api/items`
Fetches all hackathon sprint and orchestration tasks.

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
      "timestamp": "2026-10-11T06:30:10.073Z"
    }
  ]
}
```

### `POST /api/items`
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

## 4. CodeDNA Mission Submission Protocol

```json
{
  "missionId": "off-by-one",
  "language": "javascript", // or "java"
  "code": "function findFirstPositive(numbers) { ... }",
  "hypothesis": "The loop condition i <= numbers.length causes an out-of-bounds error on final index."
}
```

**Security Response Rule**:
- Public tests return `input`, `expected`, and `actual`.
- Hidden tests return **only** `{ "testId": "hidden-01", "status": "PASSED" | "FAILED" }`.
- Input and expected values for hidden tests **MUST NEVER** be returned to the client DOM.

---

## 5. User Authentication & Session Endpoints

### `POST /api/auth/login`
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
