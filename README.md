# Smart Campus Issue Management & Intelligence System

> Production-ready campus issue resolution platform with AI classification, automated department routing, SLA escalation management, human-in-the-loop override, semantic duplicate detection, and real-time Server-Sent Events (SSE).

---

## 🏗️ System Architecture & Component Flow

```
React Frontend (Vite, port 5173)
             │
             ▼  REST / SSE (httpOnly Cookies, port 5000)
┌─────────────────────────────────────────────────────────────┐
│                 Express.js + TypeScript                     │
│                       MAIN BACKEND                          │
│                                                             │
│  ├── GBU CSMS / Samarth Enrollment Verification             │
│  ├── httpOnly Cookie JWT Auth & Redis Session Revocation    │
│  ├── Brute-Force Login Guard & Redis Rate Limiting          │
│  ├── Complaint Lifecycle State Machine                      │
│  ├── Resilient AI Orchestrator (try/catch Fallback)         │
│  ├── Dynamic Department Routing Engine                      │
│  ├── Priority SLA Engine (6h / 12h / 24h / 48h)             │
│  ├── Human-in-the-Loop Admin Override Tracker               │
│  ├── Semantic Duplicate Search (pgvector 384-dim Cosine)    │
│  ├── Real-time Server-Sent Events (SSE) Broadcaster         │
│  └── Local Multer Image Evidence Uploads (/uploads)         │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       ┌───────┴────────────────────────┐      │
       ▼ (try / catch fallback)         ▼      ▼
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│   Python FastAPI (8000)  │    │   PostgreSQL (Drizzle)   │    │      Redis (6379)        │
│   • Priority Classifier  │    │   • Users & GBU Roster   │    │   • 60s OTP Cooldown     │
│   • Category Triage      │    │   • Complaints & Logs    │    │   • Brute-Force Lockout  │
│   • all-MiniLM-L6-v2     │    │   • pgvector Extension   │    │   • Refresh Token Store  │
│   • 384-dim Embeddings   │    │   • Audit Timeline       │    │   • Token Blacklist      │
└──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
```

---

## 📁 Repository Structure

```
MINOR-PROJECT/
├── backend/                  # Node.js + TypeScript Express Backend
│   ├── drizzle/              # Generated Drizzle database migrations
│   ├── src/
│   │   ├── config/           # Database, Redis, and environment configs
│   │   ├── controllers/      # Auth, Complaint, Department, Analytics, Roster controllers
│   │   ├── db/               # Drizzle schema (PostgreSQL + pgvector) and seed data
│   │   ├── middleware/       # JWT cookie auth, role guards, zod validation, rate limiters
│   │   ├── routes/           # REST endpoints (auth, complaints, admin, departments, etc.)
│   │   ├── scripts/          # Calibrate similarity threshold & benchmark tools
│   │   ├── services/         # AI orchestrator, SLA, Routing, Similarity, SSE, Email, OTP
│   │   └── types/            # TypeScript interfaces & types
│   ├── uploads/              # Local disk storage for complaint photos
│   ├── Dockerfile            # Multi-stage production container build
│   ├── package.json
│   └── tsconfig.json
├── ml-service/               # Python FastAPI microservice (Scikit-Learn + SBERT)
│   ├── training/             # Model training pipelines, datasets, evaluation reports
│   ├── main.py               # Exposes POST /analyze, POST /predict, and GET /health
│   ├── model.pkl             # Trained Logistic Regression priority model (93.6% acc)
│   ├── category_model.pkl    # Trained Logistic Regression category model
│   └── vectorizer.pkl        # TF-IDF n-gram vectorizer
├── docker-compose.yml        # Orchestrates Postgres (pgvector), Redis, Backend, & FastAPI
├── smart-campus.postman_collection.json # Ready-to-import Postman test collection
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start Options

### Option A: Run Everything with Docker Compose (Recommended)

Spins up PostgreSQL (`pgvector`), Redis, Node.js Backend, and FastAPI ML service in containers:
```bash
docker compose up --build
```
* **Backend API**: `http://localhost:5000`
* **Health Check**: `http://localhost:5000/api/health`
* **FastAPI Docs**: `http://localhost:8000/docs`

---

### Option B: Run Locally on Host Machine

#### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

#### 2. Configure Environment (`backend/.env` or `backend/.env.local`)
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_campus
REDIS_URL=redis://localhost:6379

JWT_SECRET=super_secret_smart_campus_jwt_key_2026
JWT_ACCESS_SECRET=smart-campus-jwt-access-secret-2026
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=smart-campus-jwt-refresh-secret-2026
JWT_REFRESH_EXPIRES_IN=7d

FASTAPI_URL=http://localhost:8000
USE_MOCK_AI=false
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

> **Note on `USE_MOCK_AI`**: If set to `true`, the backend simulates AI classification without requiring FastAPI.

#### 3. Push Database Schema & Seed Data
```bash
npm run db:push     # Creates PostgreSQL tables & pgvector index
npm run db:seed     # Seeds GBU departments, student roster, & demo complaints
```

#### 4. Start Development Server
```bash
npm run dev
```

---

## 👥 Verified Test Credentials

| Role | Email / Enrollment | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@gbu.ac.in` | `Password@123` | Full access, AI override, Analytics, Roster management |
| **Staff (Electrical)** | `staff.elec@gbu.ac.in` | `Password@123` | Electrical department triage & status management |
| **Student (Abhishek)** | `abhishek.sajwan@gbu.ac.in` (`22/ICS/045`) | `Password@123` | School of ICT, Birsa Munda Hostel (B-204) |
| **Student (Priya)** | `priya.patel@gbu.ac.in` (`23/SOE/034`) | `Password@123` | School of Engineering, Mahamaya Hostel (C-302) |

> 💡 **Demo Student Enrollment for Testing:**
> * **Enrollment No:** `23/SOBT/019` (Rohan Verma, School of Biotechnology, Birsa Munda B-110)
> * **Default Dev OTP:** `123456` (or check terminal log)
> * Use this enrollment number to test the GBU student verification and onboarding workflow.

---

## ⚡ Core Technical Features & Architecture

### 1. GBU CSMS / Samarth Enrollment Verification (Zero Fake Accounts)
* Students do not register with arbitrary emails.
* Verification connects to the `gbu_student_roster` table (mirroring GBU ERP / Samarth eGov):
  1. Student enters GBU Enrollment No (`22/ICS/045`).
  2. Backend looks up student profile and sends an OTP to their official university email.
  3. 60-second cooldown is enforced via Redis.
  4. Upon OTP validation, their account is created and pre-linked to their school and hostel.

### 2. Secure httpOnly Cookie Authentication (XSS-Immune)
* Access tokens are issued inside `httpOnly` secure cookies.
* JavaScript cannot access the cookie, preventing XSS token-theft attacks.
* The browser automatically attaches cookies to every request (`credentials: true`).
* Backwards compatible: fallback support for `Authorization: Bearer <token>` in Postman and mobile clients.
* Refresh tokens are tracked in Redis and revoked upon logout with an instant blacklist.

### 3. Human-in-the-Loop AI Override
To prevent incorrect automated actions when machine learning models misclassify an issue:
* Every complaint stores both `predicted_*` (AI history) and `final_*` (Human triage) fields:
  * `predicted_category` & `predicted_priority`
  * `final_category` & `final_priority`
  * `is_ai_overridden` & `override_reason` & `overridden_by_id`
* Admin/Staff can call `PATCH /api/complaints/:id/override`.
* **Automatic recalculation**: Changing category re-routes the assigned department; changing priority recalculates the SLA deadline!
* **Live KPI Metric**: Analytics dashboard displays `AI Acceptance Rate` (`((total - overridden) / total) * 100`).

### 4. Resilient AI Fallback (Zero HTTP 500)
* If the FastAPI service is slow, offline, or out-of-memory, the Node backend catches errors gracefully.
* Applies sensible campus defaults and queues tickets for staff review without dropping user submissions.

### 5. Priority-Driven SLA & Escalation
* **CRITICAL**: 6-hour deadline (e.g. electrical sparks, major pipe bursts)
* **HIGH**: 12-hour deadline (e.g. non-working fans in summer, LMS outages)
* **MEDIUM**: 24-hour deadline (e.g. leaking faucet, door latch repair)
* **LOW**: 48-hour deadline (e.g. cosmetic paint, minor noise)
* Automatically flags overdue tickets in real-time.

### 6. Semantic Duplicate Detection via `pgvector`
* Uses Sentence-Transformers **`all-MiniLM-L6-v2`** to generate 384-dimensional normalized vector embeddings.
* Calculates Cosine Similarity directly in PostgreSQL using `pgvector`.
* Flags duplicate complaints with >80% similarity (e.g. multiple students complaining about the same corridor light).

### 7. Real-time Server-Sent Events (SSE)
* Uses unidirectional SSE via `GET /api/complaints/stream` instead of heavy WebSockets.
* Live dashboard updates when tickets are submitted, overridden, or resolved.

---

## 🤖 ML Microservice Architecture & Performance

| Parameter | Specification |
| :--- | :--- |
| **Embedding Model** | `all-MiniLM-L6-v2` (Sentence-Transformers, 384 dimensions) |
| **Category Prediction** | Custom Logistic Regression + TF-IDF n-grams (1,2) with domain keyword rules for electrical/plumbing safety |
| **Priority Prediction** | Custom Logistic Regression classifier (`model.pkl`) predicting HIGH, MEDIUM, LOW |
| **Training Dataset** | 1,250 curated campus complaints across 9 categories with noise filtering (`clean_train_final.csv`) |
| **Model Accuracy** | **93.6% Priority Accuracy** (93.6% Macro F1), **~99.7% Category Accuracy** evaluated via 80/20 train-test split |

---

## 📡 API Reference Summary

### Authentication (`/api/auth`)
* `POST /api/auth/verify-enrollment` — Verifies GBU enrollment, returns profile, sends OTP
* `POST /api/auth/resend-otp` — Resends OTP (with 60-second Redis cooldown)
* `POST /api/auth/register-student` — Validates OTP, activates student account, sets `httpOnly` cookie
* `POST /api/auth/register` — Standard registration for Admin / Staff
* `POST /api/auth/login` — Authenticates credentials, sets `httpOnly` cookie & issues token
* `POST /api/auth/refresh-token` — Rotates access & refresh tokens
* `POST /api/auth/logout` — Revokes Redis session, blacklists token, clears cookies
* `GET /api/auth/me` — Fetches current user profile & campus allocation

### Complaints (`/api/complaints`)
* `POST /api/complaints` — Submit complaint (AI analysis, duplicate check, SLA calculation, auto-routing)
* `GET /api/complaints` — List complaints with multi-criteria filtering (`status`, `priority`, `category`, `search`)
* `GET /api/complaints/:id` — Complaint details, audit timeline, and duplicate matches
* `GET /api/complaints/stream` — **Real-Time SSE Stream** broadcasting live updates
* `PATCH /api/complaints/:id/status` — Update ticket progress (`SUBMITTED`, `IN_PROGRESS`, `RESOLVED`, etc.)
* `PATCH /api/complaints/:id/override` — **Admin AI Override** (updates final fields, recalculates SLA & routing)

### File Uploads (`/api/upload`)
* `POST /api/upload` — Upload complaint photo evidence (Multer multipart form-data). Stored locally at `backend/uploads/`.

### Departments (`/api/departments`)
* `GET /api/departments` — List departments with active ticket loads
* `POST /api/departments` — Create department (Admin only)

### Analytics (`/api/analytics`)
* `GET /api/analytics/dashboard` — KPI cards, AI Accuracy Rate, category/priority distributions, department workloads

### Admin & CSMS Roster (`/api/admin`)
* `POST /api/admin/roster/bulk-upload` — Import student batches from CSMS / Samarth registry
* `GET /api/admin/roster` — Search and inspect student roster records
