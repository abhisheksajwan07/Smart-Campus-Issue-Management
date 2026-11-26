# Campus Desk — frontend

React 18 + Vite + Tailwind CSS client for the Smart Campus Issue Management backend.

## Run it

```bash
# 1. start the backend first (from the repo root): docker compose up --build
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies `/api` and `/uploads` to `http://localhost:5000`, so the
backend's httpOnly auth cookies work without any CORS/SameSite setup.
Change the target with `VITE_PROXY_TARGET` in `.env` (see `.env.example`).

Sign in with the seeded accounts from the main README
(e.g. `admin@gbu.ac.in` / `Password@123`), or activate a student with
enrollment `23/SOBT/019`. In development the OTP is shown on screen.

## Pages

| Route | Who | Backend endpoints |
| --- | --- | --- |
| `/login` | everyone | `POST /auth/login` |
| `/activate` | students | `POST /auth/verify-enrollment`, `/auth/resend-otp`, `/auth/register-student` |
| `/` dashboard | admin/staff: analytics, open queue, live feed · student: own summary | `GET /analytics/dashboard`, `GET /complaints`, SSE `/complaints/stream` |
| `/complaints` | all (scoped by role) | `GET /complaints?status&priority&category&departmentId&search` |
| `/complaints/:id` | all; status update + AI correction for admin/staff | `GET /complaints/:id`, `PATCH /:id/status`, `PATCH /:id/override` |
| `/report` | all | `POST /upload`, `POST /complaints` |
| `/departments` | all; create for admin | `GET /departments`, `POST /departments` |
| `/roster` | admin | `GET /admin/roster`, `POST /admin/roster/bulk-upload` (CSV or JSON) |
| `/team` | admin | `POST /auth/register` |
| `/profile` | all | `GET /auth/me`, `POST /auth/logout` |

Expired access tokens are refreshed automatically via `POST /auth/refresh-token`.

## Production build

```bash
npm run build   # outputs dist/
```
Serve `dist/` behind the same domain as the API (reverse-proxy `/api` and `/uploads`),
or set `VITE_API_URL` to the API origin and run the backend with `COOKIE_SAMESITE=none` over HTTPS.
