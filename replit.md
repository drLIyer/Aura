# Aura — Personalized Migraine Monitor and Predictor

## Overview

A health tracking application designed to help users monitor and analyze migraine patterns by correlating them with menstrual cycles, health metrics, water intake, meals, and supplements. The app integrates Fitbit data to provide comprehensive health insights and uses data analysis to identify migraine triggers and patterns, with a particular focus on menstrual cycle correlation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tools**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR and optimized production builds
- Single-page application with client-side routing handled via state management

**UI Component System**
- Shadcn UI component library with Radix UI primitives for accessible, headless components
- Tailwind CSS for utility-first styling with custom design tokens
- Custom theming system supporting light/dark modes via CSS variables
- Design philosophy: "Clinical clarity meets personal empowerment" with calming visual language

**State Management**
- TanStack Query (React Query) for server state management, caching, and data synchronization
- Local React state for UI-specific state (current view, form states)
- Optimistic updates with automatic cache invalidation on mutations

**Key UI Patterns**
- Dashboard view with score cards showing readiness, sleep, and stress metrics
- Dashboard date navigation: prev/next day buttons, date picker, and "Today" button for viewing historical data
- Logging interface for water, meals, supplements, and migraine episodes
- PeriodLogDialog with two modes: manual date entry with date picker and CSV file upload for wearable device import
- CSV import supports common formats from Fitbit, Oura, Garmin, Clue, Flo with automatic date parsing
- Analytics view with trend charts and cycle correlation visualizations
- Modular component architecture with reusable cards, charts, and forms

### Backend Architecture

**Server Framework**
- Express.js as the HTTP server with custom middleware for logging and error handling
- RESTful API design with JSON request/response format
- Session-based architecture (infrastructure for connect-pg-simple session store present)

**Data Layer**
- Drizzle ORM, PostgreSQL (Neon). Every table carries `user_id`; every query filters on the signed-in user.
- Structured tables: profiles (health profile, family history, intake answers, time zone), medications, supplements, attacks, daily_logs, wearable_samples, midas_assessments, integrations; quick logs: water_log, meal_log, supplement_log, cycle_log.
- Legacy tables (health_metrics, migraine_log, lifestyle_log, user_profile, migraine_predictions) are kept for `npm run db:claim-legacy`.

**Business Logic**
- All clinical logic lives in `shared/engine/` (pure TypeScript, unit-tested): guideline registry, rules engine, trigger analysis, cycle status (learned cycle length, day −2 to +3 window), Bayesian risk model and backtest.
- `server/engineState.ts` builds the engine's view of one user from storage.
- Sign-in is required on every `/api` route (`server/auth.ts`); all input is validated with zod (`shared/api.ts`).

**API Design Pattern**
- Route handlers in `routes.ts` coordinate between business logic modules and data layer
- Endpoints follow RESTful conventions: GET for retrieval, POST for creation
- Error handling with appropriate HTTP status codes and descriptive error messages

### Data Flow & Analysis

**Health Metrics Processing**
1. Users manually enter daily health scores (readiness, sleep, stress) via the Dashboard
2. Health metrics are stored in the database with upsert pattern (one entry per date)
3. Trend data is queried from the database for visualization in charts

**Cycle Analysis**
1. Menstrual cycle entries are tracked with start/end dates via PeriodLogDialog component
2. Users can manually enter period dates using date picker or import from wearable devices
3. Average cycle length is calculated from historical data (minimum 2 cycles, using 30-day average)
4. Current cycle phase is determined: menstruation, follicular, ovulation, or luteal
5. High-risk PMS windows are identified (days 15-28 of cycle)

**Migraine Correlation**
1. Migraine entries are logged with severity, duration, symptoms, and triggers
2. Cross-referencing with cycle data identifies patterns (e.g., 75% of migraines in luteal phase)
3. Insights are generated based on correlations with water intake, sleep quality, and cycle phase
4. Pattern detection alerts users to potential triggers before they cause migraines

### Design System

**Typography**
- Primary font: Inter for UI and data display
- Accent fonts: Cal Sans or Plus Jakarta Sans for headings
- Hierarchy: text-2xl/3xl for titles, text-lg for sections, text-base for cards, text-sm for body

**Color Semantics**
- Primary: Purple (HSL 263 70% 50%) for brand and key actions
- Chart colors: Purple, blue, green, magenta, orange for data visualization
- Health metrics use subtle color-coded backgrounds (purple-50, blue-50, green-50)
- Destructive: Red tones for migraine-related elements

**Layout Patterns**
- Responsive grid system: 1 column mobile, 3 columns desktop for score cards
- Max-width constraints: 7xl for dashboard, 4xl for forms
- Consistent spacing using Tailwind's scale (2, 4, 6, 8 units)
- Card-based interface with rounded-xl borders and subtle shadows

## Machine Learning Integration

### Prediction Model

**Overview**
- 24-hour ahead migraine prediction using machine learning
- Python-based feature engineering and preprocessing pipeline
- Scikit-learn for model training and prediction
- Feature importance analysis to identify key migraine triggers

**Architecture**
- `ml/preprocess.py`: Feature engineering script that generates rolling averages, cycle encodings, and handles missing data
- `ml/data/`: Directory for CSV exports and processed feature matrices
- `/api/export/ml-data`: Backend endpoint that exports database data as ML-ready CSV
- Database tables: `userProfile`, `lifestyleLog`, `migrainePredictions` for storing user demographics, daily lifestyle tracking, and prediction results

**Feature Categories**
1. Sleep Metrics: hours, efficiency, WASO (wake after sleep onset), rolling averages
2. Cardiovascular: Resting heart rate, HRV RMSSD, LF/HF ratio
3. Lifestyle: Caffeine intake, alcohol intake, perceived stress (EMA)
4. Menstrual Cycle: Cycle day (sin/cos encoding), phase (one-hot), contraceptive use
5. Migraine History: Time since last migraine, baseline monthly frequency
6. Environmental: Barometric pressure changes (planned)
7. Data Quality: Missing data flags, device quality indicators

**Prediction Workflow**
1. User data is continuously logged via the web interface
2. Export endpoint aggregates data across all tables into CSV format
3. Python preprocessing script creates rolling features and encodes categorical variables
4. ML model trains on historical data with binary target (migraine within 24h: yes/no)
5. Predictions stored in `migrainePredictions` table with probability, feature importance JSON, and source snapshot for reproducibility
6. UI displays prediction risk and key contributing factors

**Current Status**
- ✅ Schema extended with new tables (userProfile, lifestyleLog, migrainePredictions)
- ✅ Data export endpoint implemented (/api/export/ml-data)
- ✅ Python preprocessing script integrated
- ✅ Storage layer with full CRUD for ML tables
- ⏳ UI for lifestyle logging (caffeine, alcohol, stress) - pending
- ⏳ Prediction dashboard with risk visualization - pending
- ⏳ Model training and deployment pipeline - pending

**Known Limitations**
- ML training requires 30-90 days of synchronized real-time data collection
- Export endpoint functional but will generate zero labels until sufficient current data is logged
- See ml/KNOWN_LIMITATIONS.md for detailed solutions and workarounds

## External Dependencies

### Third-Party Services

**Python ML Stack**
- pandas >= 2.0.0 for data manipulation
- numpy >= 1.24.0 for numerical operations  
- scikit-learn >= 1.3.0 for machine learning models

### Database

**PostgreSQL via Neon**
- Serverless PostgreSQL with connection pooling via @neondatabase/serverless
- Database URL configured via environment variable (DATABASE_URL)
- Migrations managed through Drizzle Kit

### UI Libraries

**Radix UI**
- Comprehensive set of unstyled, accessible component primitives
- Components used: Dialog, Dropdown, Popover, Tabs, Toast, Slider, Checkbox, Radio, and more
- Provides keyboard navigation, focus management, and ARIA attributes

**Recharts**
- Declarative charting library for trend visualization
- LineChart for health metrics over time
- BarChart for cycle phase correlation analysis

### Developer Tools

**Vite Plugins**
- @replit/vite-plugin-runtime-error-modal: Enhanced error display in development
- @replit/vite-plugin-cartographer: Development tooling for Replit environment
- @replit/vite-plugin-dev-banner: Development environment indicator

### Utility Libraries

**Form Handling**
- React Hook Form with @hookform/resolvers for form state management
- Zod for runtime validation (via drizzle-zod integration)

**Date Handling**
- date-fns for date manipulation and formatting in cycle calculations

**Styling**
- clsx and tailwind-merge (via cn utility) for conditional class composition
- class-variance-authority for variant-based component styling