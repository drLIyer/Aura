# Personalized Migraine Monitor and Predictor — UX Requirements

**Version:** 1.0  
**Date:** April 2026  
**Status:** Reflects current build

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Design System](#2-design-system)
3. [Application Structure and Navigation](#3-application-structure-and-navigation)
4. [Global Patterns](#4-global-patterns)
5. [Screen: Dashboard](#5-screen-dashboard)
6. [Screen: Log](#6-screen-log)
7. [Screen: Analytics](#7-screen-analytics)
8. [Dialog: Period Log](#8-dialog-period-log)
9. [Component Inventory](#9-component-inventory)
10. [Empty States](#10-empty-states)
11. [Error and Validation States](#11-error-and-validation-states)
12. [Loading and Pending States](#12-loading-and-pending-states)
13. [Responsive Behaviour](#13-responsive-behaviour)
14. [Known UX Issues and Recommended Improvements](#14-known-ux-issues-and-recommended-improvements)

---

## 1. Design Philosophy

**Core statement:** "Clinical clarity meets personal empowerment."

The app handles sensitive health data. The visual language should feel calm and trustworthy — not alarming or medical in a cold way. The user should finish each interaction feeling informed, not anxious. Specific principles that flow from this:

- **Low visual noise.** Cards separate concerns. Information hierarchy is achieved through typography weight and muted secondary text, not colour competition.
- **Colour carries meaning.** Probability risk uses a consistent green → yellow → orange → red scale throughout every component that touches risk. Cycle phases each have their own consistent colour. These mappings must never be used for unrelated data.
- **Data over decoration.** Every visual element — gradient, icon, progress bar — must communicate something specific. Nothing is present purely for aesthetic reasons.
- **Immediate feedback.** Every save or log action returns a toast within one render cycle. The user should never wonder whether something worked.
- **Graceful empty states.** An empty state is never a blank screen. Every card that can be empty has a prompt that either explains what will appear or provides a direct action to populate it.

---

## 2. Design System

### Colour Palette

| Token | Usage | Value |
|-------|-------|-------|
| `--primary` | Brand, key actions, active nav | Purple HSL 263 70% 50% |
| `--background` | Page background | Light: near-white, Dark: near-black |
| `--card` | Card surfaces | Slightly elevated from background |
| `--muted` | Progress bar tracks, secondary backgrounds | Subdued surface |
| `--muted-foreground` | Secondary and tertiary text | Low-contrast text |
| `--destructive` | Migraine-related elements, error states | Red tones |

The page background uses a subtle gradient: `from-purple-50 to-blue-50` in light mode, `from-purple-950/20 to-blue-950/20` in dark mode.

### Semantic Colour Assignments (must remain consistent)

| Concept | Colour |
|---------|--------|
| Risk: Low | Green (`text-green-600`, `bg-green-500`) |
| Risk: Moderate | Yellow (`text-yellow-600`, `bg-yellow-500`) |
| Risk: High | Orange (`text-orange-600`, `bg-orange-500`) |
| Risk: Very High | Red (`text-red-600`, `bg-red-500`) |
| Cycle: Menstruation | Red (`text-red-500`, `bg-red-500/10`) |
| Cycle: Follicular | Blue (`text-blue-500`, `bg-blue-500/10`) |
| Cycle: Ovulation | Purple (`text-purple-500`, `bg-purple-500/10`) |
| Cycle: Luteal / PMS | Orange (`text-orange-500`, `bg-orange-500/10`) |
| Insight: Warning | Amber (`border-l-orange-500`, `bg-orange-500/5`) |
| Insight: Info | Blue (`border-l-blue-500`, `bg-blue-500/5`) |
| Insight: Success | Green (`border-l-green-500`, `bg-green-500/5`) |
| Insight: Cycle pattern | Pink (`border-l-pink-500`, `bg-pink-500/5`) |
| Water intake | Blue (`text-chart-2`, blue gradient fill) |
| Readiness score icon | Purple |
| Sleep score icon | Blue |
| Stress management icon | Green |
| Migraine severity | `text-destructive` (red) |

### Health Score Colour Thresholds

Used on displayed score values in the health score card:

| Score Range | Colour |
|------------|--------|
| ≥ 80 | Green (`text-green-600 dark:text-green-400`) |
| 60–79 | Yellow (`text-yellow-600 dark:text-yellow-400`) |
| < 60 | Red (`text-red-600 dark:text-red-400`) |

### Typography

| Use | Scale | Weight |
|-----|-------|--------|
| Page titles (Dashboard, Log) | `text-3xl` | Bold |
| Section headings within cards | `text-lg` | Semibold |
| Card body / data labels | `text-sm` | Normal or Medium |
| Sub-labels, helper text | `text-xs` | Normal |
| Large data values (scores, probability) | `text-2xl`–`text-4xl` | Bold or Semibold |

Primary font: **Inter**. Headings may use Plus Jakarta Sans or Cal Sans.

### Spacing

Consistent spacing units used throughout:

- Card internal padding: `p-4` (compact cards) or `p-6` (standard cards)
- Vertical space between dashboard sections: `space-y-6`
- Grid gap between paired cards: `gap-6`
- Between form fields: `space-y-6` (forms), `space-y-2` (label/input pairs)

### Component Rules

- All interactive surfaces use the Shadcn component library (`Card`, `Button`, `Badge`, `Input`, `Slider`, `Checkbox`, `Select`, `Dialog`, `Tabs`)
- Icon buttons always use `size="icon"` — no custom width or height overrides
- Sliders are always paired with a numeric input showing the same value
- No hover interactions are implemented manually on `Button` or `Badge` — built-in elevation handles this
- Cards must never be nested inside other cards

---

## 3. Application Structure and Navigation

### Top-Level Layout

```
┌─────────────────────────────────────────────┐
│ Header (app name, dark mode toggle)         │
├─────────────────────────────────────────────┤
│ Navigation bar (Dashboard | Log | Analytics) │
├─────────────────────────────────────────────┤
│                                             │
│  Main content area (max-w-7xl, px-4 py-8)   │
│                                             │
└─────────────────────────────────────────────┘
```

### Navigation Bar

- Fixed below the header, flush with the page edge
- Three tabs: **Dashboard**, **Log**, **Analytics**
- Active tab: `border-b-2 border-primary text-primary`
- Inactive tab: `text-muted-foreground`, transitions to `text-foreground` on hover with a transparent bottom border
- Switching view resets `logSection` to null (prevents deep-linking into a specific log form)

### View Routing

State-based, not URL-based. `currentView` can be:

| Value | Renders |
|-------|---------|
| `dashboard` | Dashboard page |
| `log` | Log page (optionally pre-scrolled to a section) |
| `analytics` | Analytics page |

### Deep Navigation from Dashboard to Log

When the user clicks a Quick Action button (Log Water, Log Meal, Log Supplements, Log Migraine), the app transitions to the Log view **and** passes a `logSection` value (`water`, `meal`, `supplements`, `migraine`) so that view scrolls to or highlights the relevant section.

---

## 4. Global Patterns

### Toast Notifications

Every write action produces exactly one toast. Toasts appear in the bottom-right corner. Rules:

| Action | Success Toast | Error Toast |
|--------|--------------|-------------|
| Save health scores | "Health scores saved successfully" | "Failed to save health scores" |
| Log period (manual) | "Period logged successfully" | "Failed to log period" |
| Import period from CSV | "Import Complete — Successfully imported N of M period entries" | (handled inline with CSV error text) |
| Log water | (none currently — handled by immediate total update) | — |
| Log migraine | (confirmation from Log page) | — |

Error toasts use `variant: "destructive"` and include the error message string as a description when available.

### Dark Mode

Toggled by a button in the header. Preference is persisted in `localStorage`. The `dark` class is applied to `document.documentElement`. All colour utility classes include explicit `dark:` variants where the Shadcn token system does not handle them automatically.

### Date Constraints

- The date picker and navigation on the Dashboard have a `max` value of today — the user cannot navigate to future dates
- The "Next Day" button is disabled when the selected date is today
- "Today" button only appears when the user has navigated away from today
- Period start/end date inputs also have a `max` of today

---

## 5. Screen: Dashboard

The primary daily-use screen. Intended to be opened each morning.

### Layout (top to bottom)

```
1. Date header + navigation controls
2. [2-col grid] Migraine Probability Card | Health Score Input Card
3. Quick Actions bar
4. [2-col grid] Cycle Tracker Card | Supplement Card
5. Water Intake Card (full width)
6. Trends Chart (7-day, full width) — only rendered when trend data exists
7. Insights & Alerts Card (full width)
8. Period Log Dialog (modal, overlays everything)
```

On mobile (< `lg` breakpoint): all grids collapse to single column.

---

### 5.1 Date Header

**Elements:**
- Page title: "Dashboard" (`text-3xl font-bold`)
- Subtitle: Full date format — e.g., "Monday, April 20, 2026" (`text-muted-foreground`)
- Previous day button: icon-only, chevron-left
- Date picker input: native `<input type="date">`, width `w-40`, max = today
- Next day button: icon-only, chevron-right, disabled when viewing today
- "Today" button: ghost variant, text "Today", only visible when not viewing today

**Behaviour:**
- All data-fetching queries on the Dashboard include the `selectedDate` as a query parameter, so navigating dates re-fetches health scores, water, supplements, and migraine probability for that specific date
- Cycle phase and insights do not re-fetch on date change (they are not date-scoped)

---

### 5.2 Migraine Probability Card

**Purpose:** The most important piece of information on the page — the user's risk for today.

**Visual structure:**
- Card has a soft gradient background tinted with the risk colour (e.g., `from-green-500/10 to-green-600/5`) and a matching border
- Header row: risk icon on the left, risk level badge on the right ("Low Risk", "Moderate Risk", "High Risk", "Very High Risk")
- Large probability figure: `text-4xl font-bold`, coloured by risk
- "chance" label next to the number in smaller muted text
- Progress bar: full-width, colour matches risk level, animates width on load (`transition-all duration-500`)
- Contributing Factors section (below a divider): lists each factor with a directional icon and the factor's raw value

**Factor display:**
| Impact | Icon | Colour |
|--------|------|--------|
| Positive (lowers risk) | TrendingDown | Green |
| Negative (raises risk) | TrendingUp | Red |
| Neutral | Minus dash | Muted |

Factor name is left-aligned in muted text; factor value is right-aligned, coloured by impact.

**States:**
- Only rendered when the API returns data (`migraineProbability && ...`)
- If no health scores exist, the card still renders using the base probability (15%) adjusted only by cycle phase

---

### 5.3 Health Score Input Card

Two distinct modes toggled by a button, not a navigation transition.

**View mode (default):**
- Header row: title "Daily Health Scores" + "Edit Scores" or "Add Scores" button (outline, sm)
- "Add Scores" shown when no scores exist for the date; "Edit Scores" shown when they do
- Three columns showing: icon + label + large value number
  - Readiness: Activity icon (purple) + score coloured by threshold
  - Sleep: Moon icon (blue) + score coloured by threshold  
  - Stress Mgmt: Brain icon (green) + score coloured by threshold
- Empty state: single centred paragraph "No health scores logged for this day. Add your readiness, sleep, and stress scores."

**Edit mode:**
- Header row: title "Edit Health Scores" + Cancel (ghost) and Save (default + Save icon) buttons
- Three score fields, each containing:
  - Label with icon
  - Numeric input `w-16` showing the current value, accepts 0–100, right-aligned in the label row
  - Full-width slider below the label
  - Slider and numeric input are bidirectionally synced — moving either updates the other
- Footer helper text: "Enter your daily scores (0-100). Higher scores indicate better health status."
- Save button shows as disabled while the mutation is pending
- On successful save: exits edit mode, returns to view mode; success toast fires

**Constraint:** One entry per date. Saving while scores already exist overwrites them.

---

### 5.4 Quick Actions Card

**Purpose:** One-tap shortcuts to the most common daily logging tasks.

**Layout:** `grid grid-cols-2 sm:grid-cols-4` — 2 columns on mobile, 4 on small screens and up

**Buttons (outline variant, tall):**
| Label | Icon | Action | Icon colour |
|-------|------|--------|-------------|
| Log Supplements | Activity | Navigate to Log > Supplements | `text-primary` |
| Log Water | Droplets | Navigate to Log > Water | `text-chart-2` (blue) |
| Log Meal | Utensils | Navigate to Log > Meal | `text-chart-3` (green) |
| Log Migraine | Brain | Navigate to Log > Migraine | `text-destructive` (red) |

Each button is full-width within its column, with the icon above the text label, `py-4 gap-2`.

**Note:** "Log Period" is not in this strip. It is accessible via the "Log Period" button on the Cycle Tracker Card.

---

### 5.5 Cycle Tracker Card

**Header row:** Calendar icon (pink) + "Menstrual Cycle" title + "Log Period" button (outline, sm, always visible)

**Data state:**
- Cycle day: right-aligned `text-2xl font-bold` showing "N / 26" format
- Phase pill: coloured background block showing the phase name + colour (see phase colour table in section 2)
- Footer row: "Days until next period" + number

**Empty state:**
- Centred paragraph: "No cycle data yet. Log your period to start tracking."
- "Log Period" button is still visible in the header

---

### 5.6 Supplement Card

Displays supplements logged for the currently selected date.

**Contents:**
- List of supplement names as badges or text entries
- Empty state when no supplements have been logged for that date

---

### 5.7 Water Intake Card

**Layout:**
- Header row: Droplets icon + "Water Intake Today" + current/goal text (e.g., "800ml / 2000ml") right-aligned
- Progress bar: blue gradient fill, 100% max, smooth transition
- Log entries list below the bar: each entry shows timestamp (formatted as HH:MM AM/PM) and amount in ml

**Goal:** hardcoded at 2000ml.

**Scope:** Filtered to the currently selected date. If viewing a past date, shows water entries from that day.

---

### 5.8 Trends Chart (Dashboard)

- Only rendered when `trends.length > 0` (at least one day of health metrics in the DB)
- Shows 7 days of data
- Three lines: Readiness, Sleep, Stress (using chart colour palette)
- The full 30-day version is shown on the Analytics screen

---

### 5.9 Insights & Alerts Card

- Header row: AlertCircle icon (orange) + "Insights & Alerts"
- Each insight is a left-bordered block with coloured left border (`border-l-4`) and tinted background
- Structure within each insight: icon (left-aligned) + title (semibold) + message (muted)
- Fallback when no insights are available from the API: shows a single "Welcome" info insight prompting the user to start logging

---

## 6. Screen: Log

Accessed from the navigation bar, or via Quick Action buttons on the Dashboard.

When navigated from a Quick Action, the page receives an `initialSection` prop (`water`, `meal`, `supplements`, or `migraine`) that controls which section is shown or focused first.

### Sections available

| Section | Form type |
|---------|-----------|
| Water | Amount input (ml) |
| Meal | Type selector (Breakfast, Lunch, Dinner, Snack) |
| Supplements | Name + Dosage text inputs |
| Migraine | Full MigraineLogForm (see 6.1) |

### 6.1 Migraine Log Form

The most complex form in the app. Rendered as a Card on the Log page.

**Header row:** "Log Migraine Episode" title + ghost icon button (X) to cancel/close

**Fields:**

**Severity (required):**
- Label: "Severity (1–10)"
- Slider: min=1, max=10, step=1
- Value displayed: `text-2xl font-bold text-primary` to the right of the slider
- Default: 5

**Duration (required):**
- Label: "Duration (hours)"
- Slider: min=0, max=24, step=0.5
- Value displayed to the right: "Nh" format
- Default: 0 (must be changed before form can be submitted — validation blocks submit if duration = 0)

**Symptoms (optional):**
- Label: "Symptoms"
- Badge toggles: Nausea, Aura, Light Sensitivity, Sound Sensitivity, Throbbing Pain, Fatigue
- Selected: `variant="default"` (filled purple)
- Unselected: `variant="outline"`
- Multiple can be selected simultaneously

**Medications (optional):**
- Label row: "Medications Taken" + "Add Medication" button (outline, sm, Plus icon)
- Empty state text: "No medications added yet"
- Each medication entry is a row with:
  - Medication dropdown (Select): options are Diclofenac Sodium, Ibuprofen, Acetaminophen
  - Dosage input (text): placeholder "e.g., 400mg"
  - Times taken input (number): min=1, max=10
  - Remove button (ghost icon, Trash2, destructive colour)
- Multiple medications can be added

**Triggers (optional):**
- Textarea, min-height 80px, placeholder: "What might have triggered this migraine? (e.g., skipped meal, poor sleep, stress)"

**Notes (optional):**
- Textarea, min-height 80px, placeholder: "Any other details about this episode..."

**Footer:**
- Two equal-width buttons side by side: Cancel (outline) + Log Migraine (default)
- "Log Migraine" is disabled and does nothing if duration = 0

---

## 7. Screen: Analytics

**Purpose:** Pattern review. Not used daily. Gives the user a historical view of migraine trends.

### Layout (top to bottom)

```
1. Trends Chart — 30 days
2. Cycle-Migraine Correlation Chart
3. Recent Migraine History list
4. [3-col grid] Summary stat cards
```

---

### 7.1 Trends Chart (30-day)

Same component as Dashboard but with `days={30}`. Only rendered when trend data exists.

---

### 7.2 Cycle-Migraine Correlation Chart

Bar chart showing how many migraines occurred in each of the four cycle phases. Uses the same phase colour assignments as the rest of the app.

---

### 7.3 Recent Migraine History

- Shows up to 10 most recent migraine entries
- Each row: date (left), "Analysis in progress" phase note (secondary text), Severity (right, `text-destructive`), Duration (right)
- Empty state: centred paragraph "No migraines logged yet. Log your first migraine to start tracking patterns."

---

### 7.4 Summary Stat Cards (3-column grid)

| Card | Label | Value | Notes |
|------|-------|-------|-------|
| Total Migraines | "Total Migraines" | Count, `text-3xl font-bold` | All time |
| Average Severity | "Average Severity" | "N/10", `text-destructive` | Across all episodes |
| PMS-Related | "PMS-Related" | "N%", `text-pink-500` | Luteal phase % of total |

All three are empty/zero when no migraines are logged.

---

## 8. Dialog: Period Log

A modal Dialog with two tabs. Opened from:
- The "Log Period" button on the Cycle Tracker Card (Dashboard)

The dialog resets all its internal state (start date, end date, CSV file, parsed entries) when it is closed.

### Tab 1: Manual Entry

**Fields:**
- Period Start Date (required): native date input, max = today, default = today, label includes "Select the first day of your period" helper text
- "Include end date" checkbox: unchecked by default. Revealing the end date field is controlled by this checkbox.
- Period End Date (conditional): appears when checkbox is checked, min = start date, max = today

**Validation (inline, shown as `text-destructive`):**
- Start date empty → "Please select a start date"
- End date checked but empty → "Please select an end date or uncheck the option"
- End date before start date → "End date must be after start date"

**Submit button:** Full width, "Log Period" text. Shows "Logging..." and disabled during pending state.

---

### Tab 2: Import Data (CSV)

**Instructions:** "Upload a CSV file exported from your wearable device or period tracking app."

**Upload zone:**
- Dashed border box, full width, click to open file picker
- Shows Upload icon + "Click to upload CSV file" when empty
- Shows the filename when a file is selected
- Sub-label: "Supports exports from Fitbit, Oura, Garmin, Clue, Flo"
- Accepts `.csv` files only

**After a file is selected:**
- If parsing succeeds: green "Found N period entries" text + a scrollable preview box showing up to 5 entries (start date and, if present, end date), with "+ M more entries" overflow text
- If parsing fails: red error text with AlertCircle icon

**Import button:** Full width, "Import N Entries" text. Disabled until entries are parsed. Shows "Importing..." during import.

**Expected format reference** shown as a code block at the bottom:
```
start_date,end_date
2024-01-15,2024-01-19
2024-02-12,2024-02-17
```

**Date formats accepted by the parser:**
- `YYYY-MM-DD` (ISO — passthrough)
- `MM/DD/YYYY`
- `MM-DD-YYYY`
- Any format parseable by JavaScript's `Date()` constructor as fallback

**Column detection:**
- Looks for columns containing "start", "period_start", "begin", or exactly "date" for start date
- Looks for columns containing "end", "period_end", or "finish" for end date
- Falls back to first two columns if no matching headers are found

---

## 9. Component Inventory

Summary of all named UI components and which screen they appear on.

| Component | Dashboard | Log | Analytics | Dialog |
|-----------|-----------|-----|-----------|--------|
| `Header` | Global | Global | Global | — |
| `Navigation` | Global | Global | Global | — |
| `ScoreCard` | Yes | — | — | — |
| `HealthScoreInput` | Yes | — | — | — |
| `MigraineProbabilityCard` | Yes | — | — | — |
| `CycleTrackerCard` | Yes | — | — | — |
| `QuickActions` | Yes | — | — | — |
| `WaterIntakeCard` | Yes | — | — | — |
| `SupplementCard` | Yes | — | — | — |
| `TrendsChart` | Yes (7d) | — | Yes (30d) | — |
| `InsightsCard` | Yes | — | Yes | — |
| `CycleAnalyticsChart` | — | — | Yes | — |
| `MigraineLogForm` | — | Yes | — | — |
| `LoggingPanel` | — | Yes | — | — |
| `PeriodLogDialog` | Yes | — | — | Yes |

---

## 10. Empty States

Each component's expected empty state:

| Component | Empty State Message |
|-----------|-------------------|
| Health Score Card (view mode) | "No health scores logged for this day. Add your readiness, sleep, and stress scores." — Add Scores button visible |
| Cycle Tracker Card | "No cycle data yet. Log your period to start tracking." — Log Period button still visible |
| Water Intake Card | Progress bar at 0%, no entries listed, but card still renders |
| Insights Card | Shows fallback "Welcome" insight: "Start logging your water, supplements, and meals to get personalized insights!" |
| Trends Chart | Not rendered (hidden) when no trend data exists |
| Analytics — Migraine History | "No migraines logged yet. Log your first migraine to start tracking patterns." |
| Analytics — Summary Stats | All values show 0 or 0% |
| Analytics — Cycle Correlation | Chart renders with all four phases showing 0 migraines |
| Migraine Log Form — medications | "No medications added yet" text below the Add Medication button |
| PeriodLogDialog — CSV tab (before upload) | Upload icon with "Click to upload CSV file" prompt |

---

## 11. Error and Validation States

### Form Validation

| Form | Field | Validation Rule | Error Display Location |
|------|-------|----------------|----------------------|
| Period Log — Manual | Start date | Required | Inline, `text-destructive`, below submit button |
| Period Log — Manual | End date | Required if checkbox checked | Inline, `text-destructive` |
| Period Log — Manual | End date | Must be ≥ start date | Inline, `text-destructive` |
| Migraine Form | Duration | Must be > 0 | Silent block (submit button does nothing) |
| Health Score Input | All scores | Clamped to 0–100 by input `min`/`max` and JS guard | No error shown — silently clamped |

### API Error Handling

All POST mutations that fail show a destructive toast with:
- Title: descriptive action that failed (e.g., "Failed to log period")
- Description: the error message string from the server, or "Please try again" as fallback

### CSV Parse Errors

Displayed inline within the dialog, with an `AlertCircle` icon and `text-destructive` colour:
- "No valid period entries found in the file. Please check the format."
- "Failed to parse CSV file. Please check the format."
- "Failed to read file."

---

## 12. Loading and Pending States

### Query Loading

Currently, no skeleton or spinner states are shown while queries load. The dashboard mounts with undefined data, and each card renders its empty state until the data arrives. This means there is a brief flash of the empty state on first load.

**Recommended improvement:** Add Shadcn `Skeleton` loaders inside each card to prevent layout shift and flash of empty state.

### Mutation Pending States

| Action | Pending Indicator |
|--------|------------------|
| Save health scores | Save button `disabled={isPending}` |
| Log period (manual) | Submit button text changes to "Logging..." and is disabled |
| Import CSV | Import button text changes to "Importing..." and is disabled |

---

## 13. Responsive Behaviour

### Breakpoints Used

| Tailwind prefix | Width |
|----------------|-------|
| (default) | Mobile, < 640px |
| `sm:` | ≥ 640px |
| `lg:` | ≥ 1024px |

### Grid Collapses

| Grid | Desktop | Mobile |
|------|---------|--------|
| Migraine Probability + Health Scores | `lg:grid-cols-2` | 1 column |
| Cycle Tracker + Supplements | `lg:grid-cols-2` | 1 column |
| Analytics Summary Stats | `md:grid-cols-3` | 1 column |
| Quick Actions | `sm:grid-cols-4` | `grid-cols-2` |

### Content Width

All content is constrained to `max-w-7xl mx-auto` with `px-4 py-8 sm:px-6 lg:px-8` horizontal padding.

---

## 14. Known UX Issues and Recommended Improvements

The following issues exist in the current build and should be addressed:

---

### P1 — High Priority

**1. No skeleton/loading states**
Cards flash their empty state briefly on first load before data arrives. This is confusing because it looks like the app is telling the user they have no data, then corrects itself.
- Fix: Add `Skeleton` components inside each card while `isLoading` is true.

**2. Duration = 0 is a silent blocker in the Migraine Form**
If the user leaves Duration at 0 and clicks "Log Migraine", nothing happens. There is no error message to explain why.
- Fix: Show inline validation text under the Duration slider when submit is attempted with 0 duration: "Please enter a duration greater than 0."

**3. Meal log has no date filter**
Water and supplements are filtered by the selected date. Meals are not — the API returns all meal entries regardless of date. If the user is reviewing a past date on the Dashboard, the supplement card reflects that date but the Log page meal history does not.
- Fix: Add a `date` query parameter to `/api/meals` and filter by date in the storage layer, matching the pattern used for water and supplements.

---

### P2 — Medium Priority

**4. "Stress Management Score" label is counterintuitive**
The field is labelled "Stress Management Score" on the edit form (where the helper text says higher = better) but displayed as "Stress Mgmt" in the view. A score of 80 means stress is well-managed, not that stress is high. The label should be consistent and intuitive. The insights engine uses `score < 70 → negative` which is correct but non-obvious.
- Fix: Use a single consistent label ("Stress Management Score") everywhere with a tooltip or sub-label clarifying "Higher = better stress management."

**5. No confirmation when navigating away from an unsaved health score edit**
If the user clicks "Edit Scores", makes changes, then clicks a navigation tab, the changes are lost without any warning.
- Fix: Either auto-save on blur, or show a "You have unsaved changes" alert when navigating away while `isEditing` is true.

**6. Cycle length is hardcoded at 26 days**
Every user's cycle length is assumed to be 26 days regardless of their actual history.
- Fix: Calculate average cycle length dynamically once ≥ 2 completed cycles are logged. Show the used cycle length on the Cycle Tracker Card so the user knows what the system is assuming.

---

### P3 — Lower Priority

**7. Analytics migraine history shows "Analysis in progress" for cycle phase**
Each migraine entry shows a static "Analysis in progress" placeholder instead of the actual cycle phase on that date.
- Fix: Call `getCyclePhaseOnDate()` for each migraine entry and display the actual phase name.

**8. Water goal is not configurable**
The goal is hardcoded at 2000ml in the Dashboard component. Different users have different needs.
- Fix: Allow the user to set a daily water intake goal in a settings or profile section.

**9. No way to delete or edit a logged migraine**
Once a migraine is logged, it cannot be corrected or removed from the UI.
- Fix: Add edit and delete actions to each row in the migraine history list on the Analytics screen.

**10. Period Log dialog does not reset when closed during loading**
If the dialog is dismissed while the import is in progress (`isLoading || isImporting`), `onOpenChange` is suppressed. The user cannot close the dialog until the operation finishes.
- This is a defensive design choice but may feel broken if the import is slow. Consider allowing cancel with an abort mechanism.

**11. No empty state for the Water Intake Card when viewing a past date with no entries**
The card renders correctly but shows 0ml / 2000ml with an empty log, which is accurate but indistinguishable from "this was a day the user drank nothing" vs. "this was a day before the app existed."
- Fix: Add a note like "No water entries logged for this date" when the log is empty on a date other than today.

---

*This document reflects the UX of the application as of April 2026. Update this document when screens, flows, or component behaviour changes.*
