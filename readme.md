# 🚀 CodeQuest AI & CodeDNA — AI Debugging Missions & Containerized Telemetry

A production-grade, containerized full-stack application built for the **D.Y. Patil Hackathon 2026**. Features an Express.js REST API backend, a Vite + React frontend styled after **Skilotech's modern engineering platform** (floating island navbar, ambient mesh glows, interactive macOS IDE, and live browser console), and a complete **CodeDNA** debugging lab with Java/JS parity, progressive hints, and cognitive explanation gates.

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    User([Browser Client]) -->|Port 3000 / 80| Frontend[Frontend Container<br/>Vite / Nginx SPA<br/>Skilotech-Inspired UI]
    User -->|Port 5000| Backend[Backend Container<br/>Node.js 20 Express API<br/>Health & Telemetry]
    Frontend -->|Reverse Proxy /api/*| Backend
    
    subgraph Docker Network: hackathon-network
        Frontend
        Backend
    end
```

### Services Summary

| Service | Technology | Port (Host : Container) | Purpose |
| :--- | :--- | :--- | :--- |
| **`frontend`** | React 18 + Vite + Nginx | `3000:80` (Prod) / `5173:5173` (Dev) | Skilotech-Inspired Debugging Sandbox & Telemetry Dashboard |
| **`backend`** | Node.js 20 Alpine + Express | `5000:5000` | REST API, Health Probes & Demo CRUD Endpoints |

---

## 🚀 Quickstart with Docker

### Prerequisites
Make sure **Docker Desktop** is installed and running on your system ([Download Docker Desktop](https://www.docker.com/products/docker-desktop/)).

### 1. Run Production Stack (Orchestrated)
Build and launch all containers in detached mode:
```bash
docker compose up --build -d
```
- **Frontend App**: Open [http://localhost:3000](http://localhost:3000)
- **Backend API**: Open [http://localhost:5000](http://localhost:5000)
- **Health Check**: Open [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 2. Run Development Stack (Hot-Reload Enabled)
Mounts source code into containers so edits immediately reload without rebuilding:
```bash
docker compose -f docker-compose.dev.yml up --build
```
- **Frontend with Vite HMR**: Open [http://localhost:5173](http://localhost:5173)
- **Backend with Nodemon**: Open [http://localhost:5000](http://localhost:5000)

### 3. View Logs & Stop Stack
```bash
# Stream logs from all services
docker compose logs -f

# Stream logs from backend only
docker compose logs -f backend

# Stop all containers and clean network
docker compose down
```

---

## 💻 Running Locally (Without Docker)

You can run both the frontend and backend directly on your host machine using Node.js:

### 1. Install Dependencies
```bash
npm install
npm run install:all
```

### 2. Start Both Services Together (Recommended)
Run both backend and frontend concurrently in a single terminal:
```bash
npm run dev
```
- **Frontend App**: Open [http://localhost:5173](http://localhost:5173)
- **Backend API**: Running at [http://localhost:5000](http://localhost:5000)
- **Health Check**: Open [http://localhost:5000/api/health](http://localhost:5000/api/health)

*(Optional)* Or run them independently in separate terminals:
- **Terminal 1 (Backend)**: `npm run dev:backend`
- **Terminal 2 (Frontend)**: `npm run dev:frontend`

---

## 🛡️ Docker Integration Highlights

### 1. Backend Container ([`backend/Dockerfile`](file:///backend/Dockerfile))
- **Base Image**: `node:20-alpine` (lightweight, minimal attack surface).
- **Security**: Runs under unprivileged `node` user instead of root.
- **Layer Caching**: Copies `package.json` first to avoid re-installing dependencies on code changes.
- **Healthcheck**: Automated Docker health probe against `/api/health`.

### 2. Frontend Container ([`frontend/Dockerfile`](file:///frontend/Dockerfile))
- **Multi-Stage Build**:
  - **Stage 1 (Builder)**: Compiles React app with Vite.
  - **Stage 2 (Runner)**: Serves static assets via high-performance `nginx:alpine` image.
- **SPA Routing & Reverse Proxy**: [`frontend/nginx.conf`](file:///frontend/nginx.conf) routes client-side pages and proxies `/api/*` requests seamlessly to the backend container.

### 3. Docker Compose Orchestration ([`docker-compose.yml`](file:///docker-compose.yml))
- Isolated bridge network (`hackathon-network`).
- Health check dependency: `frontend` waits until `backend` reports healthy before starting.
- Standardized environment variables via `.env.example`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | API status and route index |
| `GET` | `/api/health` | Container health, uptime, and memory usage metrics |
| `GET` | `/api/info` | Hostname, container mode, OS architecture, and CPU count |
| `GET` | `/api/items` | Retrieve list of demo hackathon items |
| `POST` | `/api/items` | Add a new item (`{ "title": "...", "category": "..." }`) |
| `DELETE` | `/api/items/:id` | Delete an item by ID |

---

## 📂 Project Directory Structure

```text
.
├── .dockerignore              # Global Docker ignore rules
├── .gitignore                # Git ignore rules
├── .env.example              # Environment variables template
├── docker-compose.yml        # Production Docker Compose orchestration
├── docker-compose.dev.yml    # Development Docker Compose with live reloading
├── package.json              # Root orchestration scripts
├── readme.md                 # Project documentation
│
├── backend/                  # Express.js REST API
│   ├── .dockerignore
│   ├── .env.example
│   ├── Dockerfile            # Production Alpine image
│   ├── Dockerfile.dev        # Development hot-reload image
│   ├── package.json
│   └── src/
│       └── index.js          # Server entrypoint & API routes
│
└── frontend/                 # Vite + React Client
    ├── .dockerignore
    ├── .env.example
    ├── Dockerfile            # Multi-stage production build (Nginx)
    ├── Dockerfile.dev        # Development HMR container
    ├── nginx.conf            # Nginx reverse proxy & SPA config
    ├── package.json
    ├── vite.config.js        # Vite config with Docker polling & proxy
    ├── index.html
    └── src/
        ├── App.jsx           # Main UI dashboard
        ├── main.jsx          # React DOM entrypoint
        ├── index.css         # Dark-mode glassmorphic styling
        └── components/
            ├── Header.jsx
            ├── DockerStatusCard.jsx
            ├── ApiTester.jsx
            └── DockerGuideCard.jsx
```