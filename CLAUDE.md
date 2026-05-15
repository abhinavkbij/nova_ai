# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto-repair shop technician management webapp. Technicians log in by selecting their profile at a shop kiosk, authenticate with a 4-digit PIN, then manage their work orders (repairs), parts requests, and shift time. The app targets shop-floor use — large touch-friendly UI, minimal typing.

UX reference screenshots live in `frontend/ux_designs/`. API reference is `backend/FASTERWEB.postman_collection.json`.

## Dev Commands

### Backend (FastAPI)
```bash
source backend/.venv/bin/activate
cd backend && uvicorn app.main:app --reload
# API: http://localhost:8000  |  Docs: http://localhost:8000/docs
```

### Frontend (React + Vite)
```bash
cd frontend && npm run dev    # http://localhost:5173
cd frontend && npm run build
```

Vite proxies `/api/*` → `http://localhost:8000`, so both servers must run together in development.

## UX Design — Screens

### 1. Shop Home / Technician Selector
- Full-page technician card grid (name, role, shop name, optional email badge)
- Filters: search by name, shop dropdown (All Shops + individual shops), sort toggle
- Pagination with configurable rows-per-page and PREV/NEXT
- Grid ↔ List view toggle
- Clicking a card opens the **PIN Authentication modal** — 4-digit keypad, shows selected technician name/role/shop, Continue button

### 2. Technician Dashboard (post-login)
- **Left sidebar**: Home, Repairs, Parts, VIN Scanner (icon-only, narrow)
- **Top header**: Company Logo + active shop chip, Indirect Activity button, language selector (EN), shift status badge (e.g. "Status: Blood Drive"), user avatar
- **Blue hero banner**: greeting + technician name, role • shop, live Shift Duration counter, Started At time, Begin Shift / End Shift action button on the right
- **Two content tabs**: Repairs | Parts Inventory
- **Repairs tab**: category filter dropdown, search field, "My Repairs in My Shop" scope dropdown, Open/Closed sub-tabs, grid/list toggle, "View all" link. Empty state: illustrated folder + "No work orders currently assigned"
- **Work order card** (when populated): priority badge (LOW), parts status badge (PARTS UNASSIGNED), WO Number, WO Status code, title, asset info (make/model/VIN), Repair Code, Shop, Time Standard, Date In, Resume button
- **Parts Inventory tab**: summary row — Requested Parts / Issued Parts / Delayed Parts count cards; Active Requests / Past Requests sub-tabs; filter by status (Requested, Cancelled, Issued); part cards showing status badge, part name, Part ID, Repair Code, WO Number

### 3. Indirect Activity Modal
- Triggered by "Indirect Activity" button in the header
- Full grid of selectable activity buttons (e.g. Chain Tire Dismount/Mount, Shop Admin Meetings, Break-break, Break-Lunch, etc.)
- Select confirmation button

## API Reference (FASTERWEB Postman Collection)

Base URL stored as `{{base_url}}`. Auth is Bearer JWT in every request header (set via `access_token` collection variable).

| Group | Method | Path | Notes |
|---|---|---|---|
| ShopHome | GET | `/shops` | list all shops |
| ShopHome | GET | `/technicians?page=&pageSize=&shopId=&technicianName=&sort=` | paginated, filterable |
| TechnicianDash | GET | `/technicians/{id}` | single technician |
| TechnicianDash | GET | `/WorkOrderRepairs/technician/{id}?page=&pageSize=&sortBy=&sortOrder=` | technician's WO repairs |
| TechnicianDash | GET | `/WorkOrderRepairs/search?technicianId=&searchText=&searchValue=` | search WO repairs |
| ShiftManage | POST | `/TechnicianDetails/{id}/shift/begin?shopId=&createdUserId=` | begin shift |
| ShiftManage | GET | `/v1/Shifts/{id}/end` | end shift |
| ShiftManage | GET | `/WorkOrderRepairs/{shiftId}/CompletedRepairsCount` | shift summary |
| ShiftManage | GET | `/technicians/indirect-activity` | list indirect activity types |
| ShiftManage | GET | `/technicians/{id}/status-indicator` | current shift status |
| WorkOrderStatus | PATCH | `/workorders/{id}/status/{statusCode}` | change WO status (e.g. "A") |
| WorkOrderStatus | GET | `/LookUps/WorkOrderStatus` | status lookup values |
| WorkOrderStatus | GET | `/LookUps/RepairReasons` | repair reason lookup values |
| WorkOrderStatus | PATCH | `/WorkOrderRepairs/{id}/Reason/{reasonId}` | set repair reason |
| Tasks | GET | `/task/{id}` | get task/step detail |
| Tasks | PUT | `/task/{id}` | update step `{stepNumber, resultId, comment}` |
| Notes | GET | `/workordernotes?repairId=&searchString=` | search notes on a repair |
| Notes | POST | `/workordernotes` | add note `{id, subject, note, isDocument, isPending, createdUserID, createdTechnicianID}` |
| Parts | GET | `/parts/repair/{repairId}?pageNumber=&pageSize=` | parts for a repair |
| Parts | GET | `/parts/requested?technicianId=&isRequestActive=&pageNumber=&pageSize=` | technician's part requests |
| Parts | GET | `/parts/getpartsrequestedstatus` | part request status lookup |
| Parts | POST | `/PartList` | create part request `{repairId, partId, technicianId, requestedQty, requestPartStatusID, ...}` |
| Nova | POST | `/api/stt/transcribe` | speech-to-text (multipart, `file` + `stream`) |

## Architecture

```
technician_app/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, router registration
│   │   ├── database.py      # SQLAlchemy engine + session + Base; exports get_db
│   │   ├── models/          # ORM: Technician, Job (JobStatus/JobPriority enums here)
│   │   ├── schemas/         # Pydantic: *Create, *Update (exclude_unset), *Out (from_attributes)
│   │   └── routers/         # jobs.py, technicians.py — all prefixed /api
│   ├── FASTERWEB.postman_collection.json   # API reference
│   └── requirements.txt
└── frontend/
    ├── ux_designs/          # Reference screenshots (PNG) — match these for all UI work
    └── src/
        ├── api/             # Axios wrappers: client.js (base URL + auth), jobs.js, technicians.js
        ├── components/      # Navbar, StatusBadge, PriorityBadge
        └── pages/           # JobsPage, JobDetailPage, NewJobPage, TechniciansPage
```

### Backend conventions
- All routes registered under `/api` prefix in `main.py`; each router adds its own sub-prefix.
- `JobStatus` / `JobPriority` are `str` enums in `models/job.py` — re-used by schemas directly.
- Auto-status promotion: creating or patching a job with a `technician_id` promotes `pending → assigned`.
- Default DB is SQLite (`backend/technician_app.db`). Override with `DATABASE_URL` in `backend/.env`.

### Frontend conventions
- `src/api/client.js` is the single Axios instance; reads base URL from `VITE_API_URL` env var (falls back to `http://localhost:8000/api`).
- Tailwind CSS v4 via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed.
- React Router v6; root `/` redirects to `/jobs`.

## Environment

Copy `backend/.env.example` → `backend/.env`. Only `DATABASE_URL` is required (defaults to SQLite if omitted).
