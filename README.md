# Smart Campus Complaint Resolution & Intelligence System — Backend

> High-throughput, resilient Node.js + TypeScript backend with AI orchestration, automated department routing, SLA escalation management, human-in-the-loop override, and duplicate detection.

---

## 🏗️ Architecture & Component Flow

```
Student Portal (React) / Mobile
             │
             ▼  REST / HTTPS
┌───────────────────────────────────────────────┐
│              Express.js + TypeScript          │
│                 MAIN BACKEND                  │
│                                               │
│  ├── JWT Authentication & Role Authorization  │
│  ├── Complaint Lifecycle State Machine        │
│  ├── Resilient AI Orchestrator (with fallback)│
│  ├── Dynamic Department Routing Engine        │
│  ├── SLA & Escalation Deadline Tracker        │
│  └── Human-in-the-Loop Admin Override Tracker │
└───────┬───────────────────────────────┬───────┘
        │                               │
        ▼ (try / catch fallback)        ▼
┌───────────────────────┐       ┌───────────────────────┐
│     Python FastAPI    │       │  PostgreSQL + Drizzle │
│       ML Service      │       │                       │
│                       │       │  • Complaints & Logs  │
│  • Category Classifier│       │  • Users & Roles      │
│  • Priority Classifier│       │  • Departments        │
│  • Sentence Embeddings│       │  • 384-dim Embeddings │
│  • LLM Summarizer     │       │  • AI & Override Diff │
└───────────────────────┘       └───────────────────────┘
```

---

## 📁 Repository Structure

```
MINOR-PROJECT/
├── backend/                  # Node.js + TypeScript Express Backend
│   ├── src/
│   │   ├── config/           # Database & environment configs
│   │   ├── controllers/      # Auth, Complaint, Department, Analytics controllers
│   │   ├── db/               # Drizzle ORM schema & realistic seed script
│   │   ├── middleware/       # JWT auth, role guard, zod validation, error handler
│   │   ├── routes/           # REST API routes
│   │   ├── services/         # AI orchestrator (resilient fallback), SLA, Routing, Similarity
│   │   └── types/            # TypeScript interfaces & types
│   ├── Dockerfile            # Multi-stage production container build
│   ├── .dockerignore
│   ├── .env.example
│   └── package.json
├── docker-compose.yml        # Orchestrates Postgres (pgvector), Backend, and future ML/Frontend
├── .dockerignore
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start Options

### Option A: Run with Docker Compose (Recommended)
Spins up PostgreSQL (with pgvector pre-installed) and the Backend in isolated containers:
```bash
docker compose up --build
```
The backend will automatically wait for PostgreSQL to become healthy and start on `http://localhost:5000`.

---

### Option B: Run Locally on Host Machine

#### 1. Navigate to backend directory & install dependencies
```bash
cd backend
npm install
```

#### 2. Configure Environment (`backend/.env`)
Verify `.env` has your local PostgreSQL credentials:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_campus
JWT_SECRET=super_secret_smart_campus_jwt_key_2026
FASTAPI_URL=http://localhost:8000
USE_MOCK_AI=true
```

> **Note on `USE_MOCK_AI=true`**: The backend includes a built-in high-fidelity ML simulator. You and your frontend teammate can build and test immediately without being blocked while your ML teammate trains and serves the FastAPI model.

#### 3. Push Schema to PostgreSQL
```bash
npm run db:push
```

### 4. Seed Database with Realistic Demo Data
```bash
npm run db:seed
```
This populates:
* 5 Campus Departments (`ELEC`, `PLUMB`, `IT`, `HOSTEL`, `GEN`)
* 3 Default Users (Admin, Staff, Student)
* 6 Realistic Complaints with AI analysis, duplicate pairs, and an AI override example!

### 5. Start Development Server
```bash
npm run dev
```
Server runs at: `http://localhost:5000`  
Health check: `http://localhost:5000/api/health`

---

## 👥 Default Demo Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@campus.edu` | `Password@123` | Full access, AI override, Analytics dashboard |
| **Staff (Electrical)** | `staff.elec@campus.edu` | `Password@123` | Electrical department triage & status update |
| **Student (Aarav)** | `student@campus.edu` | `Password@123` | Submit complaints, track personal complaints |
| **Student (Priya)** | `priya@campus.edu` | `Password@123` | Submit complaints, track personal complaints |

---

## 🎯 Viva Killer Features Implemented

### 1. Human-in-the-Loop AI Override
When evaluators ask: *"What happens if the AI predicts the wrong category or priority?"*
* Every complaint stores both `predicted_*` and `final_*` fields:
  * `predicted_category` & `predicted_priority`
  * `final_category` & `final_priority`
  * `is_ai_overridden` & `override_reason` & `overridden_by_id`
* Admin/Staff can call `PATCH /api/complaints/:id/override`.
* **Automatic recalculation**: Changing category re-routes the assigned department; changing priority recalculates the SLA deadline!
* **Accuracy Metric**: The dashboard calculates `AI Acceptance Rate` live (`((total - overridden) / total) * 100`).

### 2. Graceful Fallback (Resilient Node Backend)
If the Python ML service crashes, experiences OOM, or times out:
* The complaint submission **never throws HTTP 500**.
* Handled safely via a resilient `try / catch` fallback that assigns standard defaults and schedules manual review.

### 3. Priority-Driven SLA & Escalation
* **CRITICAL**: 6-hour deadline (e.g. electrical sparks, floods)
* **HIGH**: 12-hour deadline (e.g. stopped fans, exam Wi-Fi outage)
* **MEDIUM**: 24-hour deadline (e.g. standard leakage, minor fixture)
* **LOW**: 48-hour deadline (e.g. repaint, minor squeak)
* Automatically flags overdue complaints in real-time.

### 4. Semantic Duplicate Detection
* Calculates Cosine Similarity over 384-dimensional Sentence Transformer embeddings.
* Immediately warns students and admins if a complaint is >80% similar to an existing open ticket (e.g., multiple students reporting the same fan in Room 204).

---

## 📡 API Reference Summary

### Authentication (`/api/auth`)
* `POST /api/auth/register` — Register new user
* `POST /api/auth/login` — Login & receive JWT token
* `GET /api/auth/me` — Get authenticated user details

### Complaints (`/api/complaints`)
* `POST /api/complaints` — Submit complaint (triggers AI analysis, SLA calculation, and routing)
* `GET /api/complaints` — List complaints (filter by `status`, `priority`, `category`, `search`)
* `GET /api/complaints/:id` — Full details + audit timeline + similar complaints
* `PATCH /api/complaints/:id/status` — Update status (`SUBMITTED`, `IN_PROGRESS`, `RESOLVED`, etc.)
* `PATCH /api/complaints/:id/override` — **Admin AI Override** (updates final fields, recalculates SLA & routing)

### Departments (`/api/departments`)
* `GET /api/departments` — List departments with active complaint metrics
* `POST /api/departments` — Create department (Admin only)

### Analytics (`/api/analytics`)
* `GET /api/analytics/dashboard` — KPI cards, AI Accuracy Rate, category/priority distributions, department workloads

---

## 🤝 ML Teammate Contract (`POST /analyze`)
Your Python ML teammate should implement this exact schema in FastAPI:

**Request from Node:**
```json
{
  "complaintId": "cmp_123",
  "text": "Fan in room 204 stopped working yesterday.",
  "location": "Room 204, Boys Hostel B"
}
```

**Response to Node:**
```json
{
  "category": {
    "value": "Electrical",
    "confidence": 0.94
  },
  "priority": {
    "value": "HIGH",
    "confidence": 0.89
  },
  "summary": "Ceiling fan in room 204 non-functional since yesterday.",
  "suggestedAction": "Inspect capacitor and check switchboard wiring.",
  "embedding": [0.0123, -0.0456, 0.0789, "...384 floats..."]
}
```
