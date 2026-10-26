# Aura

A personalized migraine monitor and predictor.

Migraine tracking with a guideline-based clinical decision support engine. It learns each person's triggers, forecasts their risk for today and tomorrow, and produces a summary they can bring to their doctor.

## Demo (29 seconds)

![Aura demo: forecast, patterns, doctor report, guidelines and wearables](docs/aura-demo.gif)

[Watch the full-quality video (MP4)](docs/aura-demo.mp4). It shows a fictional patient with 120 days of example data.

To try the demo yourself, run `npm run build:demo` and open `dist/demo/migraine-demo.html` in a browser. It runs entirely in the browser and needs no server, sign-in or database.

## UX preview

**Desktop**

![Dashboard on desktop](screenshots/aura-ux.jpg)

**Mobile**

![Dashboard on mobile](screenshots/aura-ux-mobile.jpg)

**My patterns**

![My patterns: what your data shows](screenshots/analytics-ux.jpg)

## What it does

- **Logging:** quick logs for water, meals (with time), supplements and periods (manual entry or CSV import from Clue, Flo, Fitbit, Oura or Garmin).
- **Attack log:**
  - Aura questions.
  - Doses taken from the user's own medicine list, with a 2-hour relief rating.
  - Triggers, what helped and what made it worse.
  - Red-flag checks that show an emergency prompt immediately.
- **Daily check-in:** sleep, sleep and readiness scores, stress (0–10, higher means more stress), lunch time, work hours, caffeine, exposures and early warning signs.
- **My patterns (intake):** every user records their own triggers and how often each sets off an attack, their avoidance strategies, warning signs, and what helps or makes it worse.
- **Forecast:** each trigger starts from a research value, is adjusted by the user's own answers, then by their logs. The forecast is backtested against past days. See `shared/engine/cds/riskModel.ts`.
- **Alerts:** 13 rule groups covering red flags, medication overuse (ICHD-3), prevention (AAN/AHS 2026), acute response, interactions, medicine changes, family history, supplements, patterns, wearables and data quality. Every alert links to its guideline. Alerts with clinician-only detail never reach the patient view.
- **Medicines:** the full list of everything the patient takes, plus supplements, family history and the MIDAS questionnaire.
- **Doctor report:** one printable page.
- **Wearables:** each device's scoring method (ranges, bands, direction, HRV type) is built in (`shared/engine/domain/deviceScoring.ts`), so scores are read on their own scale, devices are never mixed, and each person can set their own cut-offs (for example, sleep score below 50). Oura, Fitbit, Garmin, Whoop, Polar and others connect through [Open Wearables](https://github.com/the-momentum/open-wearables), plus CSV import. Apple Watch needs a companion app or CSV export, because Apple Health has no web API.

## Running it

```bash
npm install
npm test          # engine + API tests
npm run check     # TypeScript
```

### Local development without a database

```bash
AURA_DEV_USER_ID=me npm run dev
```

This signs every request in as user `me` and stores data in memory. Use Profile → **Load demo data** to see the app with 120 days of example data. `AURA_DEV_USER_ID` is refused when `NODE_ENV=production`.

### Demo without a server

```bash
npm run build:demo   # → dist/demo/migraine-demo.html
```

This builds one self-contained page in which the app's real API (`server/api.ts`) runs inside the browser on in-memory storage, with a fictional patient. There's no server and no sign-in, nothing leaves the browser, and changes reset on reload. You can host it as a static file anywhere.

### On Replit / production

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres. Then run `npm run db:push` to create or upgrade tables. |
| `REPL_ID`, `SESSION_SECRET` | Replit Auth sign-in. Every `/api` route requires a signed-in user. |
| `OPEN_WEARABLES_URL`, `OPEN_WEARABLES_API_KEY` | Optional, for device connections. The key stays on the server. |

Without sign-in configured, the API refuses requests rather than serve health data to anyone.

### Moving data from the first version

Old rows are kept and marked as owned by `legacy`. After signing in once, find your user id at `/api/auth/user`, then run:

```bash
npm run db:claim-legacy -- <your-user-id> America/Chicago
```

The script:

- assigns your old water, meal, supplement and period logs to your account, with local dates and times;
- copies old health scores and migraine logs into check-ins and attacks. The old stress score was a device stress-management score, where higher means calmer, so it is kept as that measure rather than turned into self-rated stress.

The old tables are not changed.

## Code map

| Path | What |
| --- | --- |
| `shared/engine/` | Decision support: domain model, guideline registry (`domain/guidelines.ts`), rules, trigger analysis, risk model. Pure functions, unit-tested. |
| `shared/api.ts` | Request validation used by both server and client. |
| `shared/schema.ts` | Database tables. Every table has a `user_id`. |
| `server/` | Framework-neutral API (`api.ts`) with an Express adapter (`routes.ts`), sign-in (`auth.ts`), storage (`storage.ts`), engine adapter, Open Wearables client, ML export. |
| `client/src/` | React UI. |
| `ml/` | Research export preprocessing (see `ml/KNOWN_LIMITATIONS.md`). |
| `reports/`, `research_notes/` | Literature review behind the trigger starting values and epidemiology. |

All dates are the user's local calendar dates. The client sends its time zone with every request, and the server never derives "today" from its own clock.

## Disclaimer

This is decision support, not diagnosis. Alerts follow the cited guidelines and are meant to be reviewed with a clinician. Research-derived numbers come from published abstracts and should be checked by a clinician before clinical use.
