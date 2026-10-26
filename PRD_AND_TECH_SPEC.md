# Personalized Migraine Monitor and Predictor — Product Requirements & Technical Specification

> **Update (October 2026):** this document describes the first version. Its database schema, API, probability calculation, cycle calculation and insights sections are superseded by the decision-support engine (`shared/engine/`), the per-user schema (`shared/schema.ts`) and the API in `server/routes.ts` — see README.md. The visual design and component guidance still apply.

**Version:** 1.0  
**Date:** April 2026  
**Status:** Active Development

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals and Success Metrics](#2-goals-and-success-metrics)
3. [User Personas and Use Cases](#3-user-personas-and-use-cases)
4. [Feature Requirements](#4-feature-requirements)
5. [Non-Goals (Current Version)](#5-non-goals-current-version)
6. [System Architecture](#6-system-architecture)
7. [Database Schema](#7-database-schema)
8. [API Specification](#8-api-specification)
9. [Business Logic](#9-business-logic)
10. [Frontend Architecture](#10-frontend-architecture)
11. [ML Pipeline (Scaffolded)](#11-ml-pipeline-scaffolded)
12. [Known Limitations and Future Work](#12-known-limitations-and-future-work)

---

## 1. Product Overview

Personalized Migraine Monitor and Predictor is a personal health web application that helps a single user understand and anticipate migraine episodes. The core insight driving the product is that migraines are rarely random — they correlate with hormonal cycles, sleep quality, hydration levels, and stress. By logging daily health data and tracking menstrual cycle patterns, the app calculates a daily migraine probability score and surfaces actionable insights.

The current version is a **single-user, personal-use application** with no authentication layer. A separate multi-user version is planned for a future project.

### Design Philosophy

"Clinical clarity meets personal empowerment." The interface uses calming purples, clean card layouts, and data visualizations that make health data feel approachable rather than clinical. The goal is for the user to check the dashboard each morning and understand their risk at a glance.

---

## 2. Goals and Success Metrics

### Primary Goals

- Allow the user to log daily health scores (readiness, sleep, stress) in under 60 seconds
- Surface a calibrated daily migraine probability based on those scores and cycle phase
- Make menstrual cycle data easy to enter (manual or CSV import from wearables)
- Identify patterns over time, especially correlation between cycle phases and migraines
- Lay the groundwork for a future machine learning prediction model

### Success Metrics

| Metric | Target |
|--------|--------|
| Daily health score logging time | < 60 seconds |
| Time to see today's migraine probability | < 5 seconds from page load |
| Pattern insights generated after N migraines | After 3+ migraine logs |
| Cycle correlation chart populated | After 2+ cycle entries |
| ML data export available | Immediately (data quality improves over 30-90 days) |

---

## 3. User Personas and Use Cases

### Primary User

A person who experiences recurring migraines and menstrual cycles, is comfortable with technology, and is motivated to identify personal triggers. They check the app daily, logging scores in the morning and migraines as they occur.

### Core Use Cases

1. **Morning check-in:** Open the app, enter readiness/sleep/stress scores, see today's migraine probability and any alerts
2. **Migraine logging:** After experiencing a migraine, log its severity, duration, symptoms, and any suspected triggers
3. **Period logging:** Log when a period starts and ends, manually or by importing CSV data from a wearable (Fitbit, Oura, Garmin, Clue, Flo)
4. **Daily lifestyle tracking:** Log water intake, meals, and supplements throughout the day
5. **Pattern review:** View the Analytics screen to see trends and cycle-migraine correlation over time
6. **Historical review:** Navigate to past dates on the dashboard to review what was logged

---

## 4. Feature Requirements

### 4.1 Dashboard

**Date Navigation**
- Display today's date with previous/next day navigation buttons
- Include a calendar date picker for jumping to any date
- "Today" button to return to current date quickly

**Daily Health Score Card**
- Input fields (range 0–100) with sliders for three metrics: Readiness, Sleep Quality, Stress Management
- Scores auto-save on form submission with visual confirmation (toast notification)
- One entry per date using an upsert pattern — re-submitting overwrites that day's scores
- Empty state with a prompt to add scores when no data exists for a date

**Migraine Probability Card**
- Displays a percentage (5%–95%) and a risk level label: Low / Moderate / High / Very High
- Lists contributing factors with their direction of impact (positive, negative, neutral) and numeric contribution
- Falls back to base 15% probability when no scores have been entered
- Updates immediately when health scores are saved

**Menstrual Cycle Card**
- Shows current cycle day, phase name, and days until next expected period
- Highlights high-risk PMS window (7 days before expected period)
- Empty state with link to open the period logging dialog when no cycle data exists

**Quick Action Buttons**
- Log Water — opens inline water amount input
- Log Meal — opens meal type selection
- Log Supplement — opens supplement name and dosage form
- Log Migraine — opens the full migraine logging dialog
- Log Period — opens the period logging dialog

**Insights Panel**
- Auto-generated text insights based on recent data patterns
- Up to 3 simultaneous insights covering: cycle correlation, hydration warnings, and sleep quality
- Insight types: cycle (purple), warning (amber), info (blue), success (green)

### 4.2 Period Logging Dialog

Two input modes, toggled by tab:

**Manual Entry**
- Start date picker (required)
- End date picker (optional)

**CSV Import**
- File upload accepting `.csv` files
- Parser supports common formats from: Fitbit, Oura, Garmin, Clue, Flo
- Automatically detects date columns and parses period start/end entries
- Shows a preview count of records found before confirming import

### 4.3 Migraine Logging

Full form capturing:
- Severity (1–10 numeric scale)
- Duration (minutes)
- Symptoms (multi-select checkboxes): headache, nausea, light sensitivity, sound sensitivity, aura, vomiting, neck stiffness, dizziness
- Triggers (free text)
- Notes (free text)
- Medications taken (free text; available medications include Diclofenac Sodium, Ibuprofen, Acetaminophen)

### 4.4 Daily Tracking

**Water Intake**
- Log entries in millilitres (ml)
- Daily total displayed on dashboard
- Date-filtered — shows only entries for the currently viewed date

**Meals**
- Log meal type (Breakfast, Lunch, Dinner, Snack)
- Displayed as a list on the dashboard

**Supplements**
- Log supplement name and dosage
- Date-filtered — shows only entries for the currently viewed date

### 4.5 Analytics View

**Health Trends Chart**
- Line chart showing readiness, sleep, and stress scores over the last 7 or 30 days
- Toggle between 7-day and 30-day views

**Cycle-Migraine Correlation Chart**
- Bar chart showing migraine count per cycle phase (Menstruation, Follicular, Ovulation, Luteal)
- Percentage breakdown of which phase most migraines occurred in

**Insights List**
- Same auto-generated insights as displayed on the dashboard

---

## 5. Non-Goals (Current Version)

- Multi-user support or authentication — the app is single-user and has no login
- Push notifications or reminders
- Integration with live wearable device APIs (Fitbit, Oura, Garmin) — CSV import only
- Barometric pressure or weather data ingestion
- Clinician-facing dashboards or data sharing
- Offline/PWA support
- Mobile native apps

---

## 6. System Architecture

### Overview

```
Browser (React SPA)
       │
       │  HTTP/JSON
       ▼
Express.js API Server
       │
       ├── Business Logic
       │     ├── cycleCalculator.ts
       │     ├── migraineProbabilityCalculator.ts
       │     ├── insightsGenerator.ts
       │     └── mlExport.ts
       │
       └── Drizzle ORM
              │
              ▼
       PostgreSQL (Neon Serverless)
```

### Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend framework | React 18 + TypeScript | Type safety, component reuse |
| Build tool | Vite | Fast HMR, optimized production builds |
| UI components | Shadcn UI + Radix UI | Accessible headless primitives |
| Styling | Tailwind CSS | Utility-first, design token support |
| Server state | TanStack Query v5 | Caching, cache invalidation, loading states |
| Backend framework | Express.js | Minimal, well-understood |
| ORM | Drizzle | Type-safe queries, schema-first, PostgreSQL |
| Database | PostgreSQL (Neon serverless) | Reliable, SQL, serverless-friendly |
| Charting | Recharts | Declarative React charts |
| Form handling | React Hook Form + Zod | Controlled forms with runtime validation |
| Date handling | date-fns | Reliable date arithmetic for cycle math |

### Application Entry Points

- `server/index.ts` — Express server bootstrap, registers routes
- `server/routes.ts` — All API route handlers
- `client/src/App.tsx` — React app root, state-based view routing
- `client/src/pages/Dashboard.tsx` — Primary view

### View Routing

The app uses **state-based routing** (not URL-based). `currentView` state in `App.tsx` switches between `'dashboard'` and `'analytics'`. Navigation is handled via sidebar button clicks. This is intentional for simplicity in a single-user personal app.

---

## 7. Database Schema

All tables use `varchar` primary keys with PostgreSQL's `gen_random_uuid()` default.

### `water_log`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| timestamp | timestamp | Auto-set to now() |
| amount | integer | Millilitres |

### `meal_log`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| timestamp | timestamp | Auto-set to now() |
| type | text | Breakfast, Lunch, Dinner, Snack |

### `supplement_log`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| timestamp | timestamp | Auto-set to now() |
| name | text | Supplement name |
| dosage | text | Free text dosage |

### `migraine_log`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| timestamp | timestamp | Auto-set to now() |
| severity | integer | 1–10 |
| duration | integer | Minutes |
| symptoms | text[] | Array of symptom strings |
| triggers | text | Nullable, free text |
| notes | text | Nullable, free text |
| medications | text | Nullable, free text |

### `cycle_log`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| start_date | date | Period start (required) |
| end_date | date | Period end (nullable) |
| cycle_length | integer | Nullable, computed |

### `health_metrics`

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| date | date | One row per date (upserted) |
| readiness | integer | 0–100 |
| sleep | integer | 0–100 |
| stress | integer | 0–100 |
| sleep_efficiency | integer | Nullable, for future wearable import |
| sleep_waso_minutes | integer | Nullable, for future wearable import |
| hrv_rmssd | integer | Nullable, for future wearable import |
| hrv_lf_hf_ratio | integer | Nullable, for future ML features |

### `user_profile` (ML scaffolding)

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| user_id | varchar | Default "default_user", unique |
| age | integer | Nullable |
| sex | text | Nullable |
| contraceptive_use | text | Nullable |

### `lifestyle_log` (ML scaffolding)

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| timestamp | timestamp | Auto-set to now() |
| caffeine_intake | integer | Nullable, mg |
| alcohol_intake | integer | Nullable, units |
| perceived_stress | integer | Nullable, 1–10 EMA scale |

### `migraine_predictions` (ML scaffolding)

| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| timestamp | timestamp | Auto-set to now() |
| prediction_horizon | integer | Hours ahead (24) |
| probability | real | 0.0–1.0 |
| feature_importance | text | JSON blob |
| source_snapshot | text | JSON snapshot of input data |

---

## 8. API Specification

All endpoints return `application/json`. All error responses use `{ "error": "message" }` format with appropriate HTTP status codes.

### Health Metrics

#### `GET /api/health/today`

Returns health scores for a given date.

**Query params:** `date` (optional, YYYY-MM-DD, defaults to today)

**Response (200):**
```json
{
  "readiness": 85,
  "sleep": 90,
  "stress": 75
}
```
Returns `{ "readiness": null, "sleep": null, "stress": null }` when no entry exists for that date.

---

#### `POST /api/health`

Creates or updates health metrics for a date (upsert).

**Request body:**
```json
{
  "date": "2026-04-20",
  "readiness": 85,
  "sleep": 90,
  "stress": 75
}
```

**Response (200):** The saved health metrics row.

---

#### `GET /api/health/trends`

Returns health metrics for the past N days from the database.

**Query params:** `days` (optional, integer, defaults to 7)

**Response (200):**
```json
[
  { "date": "2026-04-14", "readiness": 80, "sleep": 75, "stress": 82 },
  ...
]
```

---

### Migraine Probability

#### `GET /api/migraine-probability`

Calculates migraine probability using DB health scores and current cycle phase.

**Query params:** `date` (optional, YYYY-MM-DD, defaults to today)

**Response (200):**
```json
{
  "probability": 42,
  "riskLevel": "moderate",
  "factors": [
    { "name": "Readiness", "impact": "positive", "value": 85, "contribution": -5 },
    { "name": "Sleep Quality", "impact": "neutral", "value": 77, "contribution": 5 },
    { "name": "Stress Management", "impact": "negative", "value": 62, "contribution": 20 },
    { "name": "Cycle Phase", "impact": "negative", "value": 22, "contribution": 10 }
  ],
  "date": "2026-04-20",
  "scores": { "readiness": 85, "sleep": 77, "stress": 62 }
}
```

---

### Cycle

#### `GET /api/cycle/current`

Returns calculated cycle phase info based on all logged cycles.

**Response (200):**
```json
{
  "currentDay": 18,
  "cycleLength": 26,
  "phase": "luteal",
  "daysUntilPeriod": 8,
  "isHighRiskPMS": false
}
```
Returns `{ "currentDay": null, ... }` when no cycle data exists.

---

#### `GET /api/cycle`

Returns all cycle log entries.

---

#### `POST /api/cycle`

Logs a new cycle entry.

**Request body:**
```json
{ "startDate": "2026-04-01", "endDate": "2026-04-05" }
```

---

### Insights & Analytics

#### `GET /api/insights`

Generates pattern-based insights from the last 14 days of data.

**Response (200):**
```json
[
  {
    "type": "cycle",
    "title": "PMS Migraine Pattern Detected",
    "message": "75% of your migraines occur during the luteal phase..."
  }
]
```

---

#### `GET /api/analytics/cycle-correlation`

Returns migraine counts broken down by cycle phase.

**Response (200):**
```json
[
  { "phase": "Menstruation", "migraines": 2, "total": 8, "percentage": 25 },
  { "phase": "Follicular", "migraines": 0, "total": 8, "percentage": 0 },
  { "phase": "Ovulation", "migraines": 0, "total": 8, "percentage": 0 },
  { "phase": "Luteal", "migraines": 6, "total": 8, "percentage": 75 }
]
```

---

### Daily Logs

All log endpoints follow the same pattern. `GET` supports optional `date` query param (YYYY-MM-DD) to filter by day.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/water?date=` | List water entries for a date |
| POST | `/api/water` | Add water entry `{ amount, date }` |
| GET | `/api/supplements?date=` | List supplement entries for a date |
| POST | `/api/supplements` | Add supplement `{ name, dosage, date }` |
| GET | `/api/meals` | List all meal entries |
| POST | `/api/meals` | Add meal entry `{ type }` |
| GET | `/api/migraines` | List all migraine entries |
| POST | `/api/migraines` | Add migraine `{ severity, duration, symptoms, triggers, notes, medications }` |

---

### ML Data Export

#### `GET /api/export/ml-data`

Exports all stored data aggregated into a single ML-ready CSV file. Also writes the file to `ml/data/input_data.csv` on disk.

**Response:** `text/csv` download

---

## 9. Business Logic

### 9.1 Cycle Phase Calculation (`cycleCalculator.ts`)

**Input:** All cycle log entries from the database  
**Output:** `CyclePhaseInfo` object

**Algorithm:**
1. Filter entries to only past cycles (start date ≤ today)
2. Sort by start date descending to find the most recent cycle
3. Calculate `currentDay = daysSinceStart + 1` (1-indexed)
4. Assign phase using hardcoded thresholds:
   - Days 1–5: **Menstruation**
   - Days 6–13: **Follicular**
   - Days 14–16: **Ovulation**
   - Days 17+: **Luteal**
5. Mark `isHighRiskPMS = true` if within 7 days before expected period OR up to 3 days past expected period
6. Uses a hardcoded average cycle length of **26 days**

> **Known issue:** The 26-day cycle length is hardcoded. This should be made dynamic, calculated from historical cycle data (minimum 2 completed cycles).

---

### 9.2 Migraine Probability Calculation (`migraineProbabilityCalculator.ts`)

**Input:** Health scores (readiness, sleep, stress) from DB + cycle phase info  
**Output:** Probability %, risk level, factor breakdown

**Algorithm:**

Base probability: **15%**

Adjustments applied when scores are available:

| Factor | Score Range | Adjustment |
|--------|------------|-----------|
| Readiness | < 60 | +20% |
| Readiness | 60–74 | +10% |
| Readiness | ≥ 75 | −5% |
| Sleep | < 70 | +15% |
| Sleep | 70–79 | +5% |
| Sleep | ≥ 80 | −5% |
| Stress | < 70 | +20% |
| Stress | 70–79 | +8% |
| Stress | ≥ 80 | −5% |
| Cycle: Luteal day ≥ 21 | — | +15% |
| Cycle: Luteal day < 21 | — | +10% |
| Cycle: Menstruation | — | +8% |
| Cycle: Ovulation | — | +5% |
| Cycle: Follicular | — | −3% |

Final probability is **clamped to 5%–95%**.

**Risk level thresholds:**
- < 25%: Low
- 25%–44%: Moderate
- 45%–64%: High
- ≥ 65%: Very High

Scores that are `null` (not logged yet) are skipped — the calculation uses whatever subset of factors is available.

---

### 9.3 Insights Generation (`insightsGenerator.ts`)

Generates up to 3 insights by running rule checks against recent data:

**Rule 1 — Cycle correlation (requires ≥ 1 migraine + ≥ 1 cycle entry):**
If ≥ 60% of migraines occurred in the luteal phase → generate a "PMS Migraine Pattern Detected" insight.

**Rule 2 — Hydration warning:**
If yesterday's total water intake was < 1500ml → generate a "Low Water Intake Yesterday" warning.

**Rule 3 — Sleep quality (requires ≥ 7 days of health metrics):**
- If ≥ 3 of the last 7 days had sleep score < 65 → generate a "Sleep Quality Concerns" info insight.
- If average sleep score for the last 7 days was ≥ 75 → generate a "Good Sleep Pattern" success insight.

---

## 10. Frontend Architecture

### Component Hierarchy

```
App.tsx
├── Sidebar (navigation: Dashboard / Analytics)
├── Dashboard.tsx (currentView = 'dashboard')
│   ├── DateNavigation
│   ├── HealthScoreInput.tsx
│   ├── MigraineProbabilityCard.tsx
│   ├── CycleTrackerCard.tsx
│   ├── QuickActions (water, meal, supplement, migraine, period buttons)
│   ├── InsightsPanel.tsx
│   └── TrendsChart.tsx (7-day mini chart)
├── Analytics.tsx (currentView = 'analytics')
│   ├── TrendsChart.tsx (full, 30-day)
│   ├── CycleCorrelationChart.tsx
│   └── InsightsPanel.tsx
└── Dialogs (rendered at App level)
    ├── MigraineLogDialog.tsx
    └── PeriodLogDialog.tsx
```

### State Management Pattern

- **Server state:** All API data fetched via TanStack Query. Query keys map directly to API paths, e.g., `['/api/health/today', date]`
- **UI state:** React `useState` for current view, selected date, dialog open/close
- **Cache invalidation:** On any mutation (POST), the relevant query key is invalidated to trigger a re-fetch
- **Date state:** `selectedDate` is an ISO string (YYYY-MM-DD). All queries that are date-sensitive pass this as a query parameter

### Design System Tokens

Defined in `client/src/index.css` as CSS variables, consumed by Tailwind config:

- `--primary`: Purple (HSL 263 70% 50%) — brand color, key actions
- `--background` / `--foreground`: Light/dark mode surface colors
- `--card`: Card surface, slightly elevated from background
- `--destructive`: Red tones — used for migraine-related elements
- Chart palette: purple, blue, green, magenta, orange (sequential)

Dark mode is implemented via a `.dark` class on `document.documentElement`, toggled by a ThemeProvider with localStorage persistence.

---

## 11. ML Pipeline (Scaffolded)

The ML pipeline infrastructure is built and waiting for sufficient data. It is not yet operational.

### What is built

- **Schema tables:** `user_profile`, `lifestyle_log`, `migraine_predictions` exist in the database
- **Export endpoint:** `GET /api/export/ml-data` aggregates all tables into a joined CSV with one row per day
- **Preprocessing script:** `ml/preprocess.py` handles feature engineering: rolling averages (3/7-day), sin/cos cycle day encoding, phase one-hot encoding, missing data flags
- **Storage CRUD:** Full create/read operations for all three ML tables

### What is pending

- UI for logging lifestyle data (caffeine mg, alcohol units, perceived stress EMA score)
- Prediction results dashboard showing risk from ML model vs. rule-based model
- Model training script and scheduled inference runner
- Serving ML predictions back through the `/api/migraine-probability` endpoint

### Data requirements before ML becomes useful

| Requirement | Threshold |
|-------------|-----------|
| Minimum days of synchronized daily data | 30 days |
| Recommended days for stable model | 90 days |
| Minimum migraine events for training labels | 10+ events |

Until then, the rule-based probability calculator described in §9.2 is the active prediction method.

---

## 12. Known Limitations and Future Work

### Active Limitations

| Issue | Impact | Fix |
|-------|--------|-----|
| Cycle length hardcoded at 26 days | Inaccurate phase/risk calculations for different cycle lengths | Calculate dynamically from cycle log history (min 2 completed cycles) |
| No authentication | Not deployable as a shared app | Implement Replit Auth or similar for multi-user version |
| Meal logging has no date filter | All meals appear regardless of selected date | Add timestamp-based date filtering (same pattern as water/supplements) |
| Insights use fixed thresholds | May generate too many or too few insights | Make thresholds configurable or data-adaptive |
| Stress score semantics are inverted | A higher stress score means better stress management (counterintuitive) | Rename field to "Stress Management Score" or invert the UX label |

### Planned Improvements

1. **Dynamic cycle length** — calculate from actual data instead of 26-day hardcode
2. **Lifestyle logging UI** — caffeine, alcohol, perceived stress EMA inputs on dashboard
3. **ML predictions dashboard** — show ML model output once sufficient data is collected
4. **Period end date auto-detection** — infer end from CSV imports
5. **Water intake goal** — configurable daily target (currently implied at 2000ml in insights)
6. **Migraine pattern alerts** — proactive push/banner alerts during high-risk windows
7. **Multi-user version** — separate Replit project with full authentication

---

*This document reflects the state of the application as of April 2026. Update this document when features are added, changed, or removed.*
