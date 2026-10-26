# Migraine Tracker Design Guidelines

## Design Approach

**Hybrid Approach**: Drawing from health-tracking leaders (Clue, MyFitnessPal, Oura) combined with Material Design principles for data-dense interfaces. The app balances medical credibility with approachable, empowering wellness aesthetics.

**Core Principles**:
- Clinical clarity meets personal empowerment
- Data visibility without overwhelm
- Gentle, calming visual language (no harsh contrasts or anxiety-inducing reds)
- Trust through consistency and precision

## Typography

**Font Families** (Google Fonts):
- Primary: 'Inter' - Clean, highly legible for data and UI
- Accent: 'Cal Sans' or 'Plus Jakarta Sans' - Softer, warmer for headings

**Hierarchy**:
- Page Titles: text-2xl or text-3xl, font-bold
- Section Headers: text-lg, font-semibold
- Card Titles: text-base, font-medium
- Body Text: text-sm, font-normal
- Micro Labels/Timestamps: text-xs, text-gray-500

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8 for consistency
- Tight spacing (metrics, data points): p-2, gap-2
- Standard spacing (cards, sections): p-4, p-6, gap-4
- Generous spacing (page sections): p-8, gap-6, gap-8
- Container max-width: max-w-7xl for dashboard, max-w-4xl for forms

**Grid Patterns**:
- Dashboard score cards: grid-cols-1 md:grid-cols-3
- Quick actions: grid-cols-2 sm:grid-cols-4
- Supplement pills: grid-cols-2 sm:grid-cols-4
- Analytics: Single column with full-width charts

## Component Library

### Navigation
- Horizontal tab navigation with border-bottom indicators
- Active tab: purple-500 border, purple-600 text
- Inactive: transparent border, gray-500 text with hover states

### Score Cards
- Rounded-xl cards with subtle shadows (shadow-sm)
- Large score display (text-4xl font-bold) with small label below
- Color-coded backgrounds using subtle tints (purple-50, blue-50, green-50)
- Icon integration top-right corner

### Progress Indicators
- Water intake: Full-width progress bar with gradient fill (blue-400 to blue-600)
- Supplement checklist: Grid of pill-shaped cards with checkmark states
- Visual states: Completed (green-50 bg, green-300 border) vs Pending (gray-50 bg, gray-200 border)

### Charts & Data Visualization
- Using Recharts library with consistent styling
- CartesianGrid: strokeDasharray="3 3", stroke="#f0f0f0"
- Line colors: Readiness (purple-600), Sleep (blue-500), Stress (green-500), Cycle phase (pink-400)
- Responsive container height: 300px for dashboard, 400px for analytics
- Tooltip with white background, subtle shadow

### Cycle Tracking Components
- Calendar grid overlay showing cycle phases
- Color coding: Menstruation (red-100), Follicular (blue-50), Ovulation (purple-100), Luteal (yellow-50), PMS window (orange-100)
- Small colored dots on migraine correlation charts indicating cycle day

### Insight Cards
- Alert-style cards with icon, title, and message
- Border-left accent (4px) color-coded by type:
  - Warning: orange-500 border, orange-50 background
  - Info: blue-500 border, blue-50 background
  - Success: green-500 border, green-50 background
- Icon positioning: left-aligned with flex layout

### Forms & Input
- Migraine severity: Slider input with visible scale 1-10
- Symptom selection: Multi-select checkbox pills (rounded-full)
- Time/date pickers: Standard browser inputs with border-gray-300, focus:ring-purple-500
- Quick-add buttons: Compact size (px-3 py-2) with icon + label

### Action Buttons
- Primary CTA: bg-purple-600, hover:bg-purple-700, rounded-lg
- Quick action tiles: Vertical flex layout with icon above label, hover:bg-gray-50
- Icon size: w-5 h-5 within buttons

## Visual Treatment

**Backgrounds**:
- Page: gradient-to-br from-purple-50 to-blue-50
- Cards: white with border border-gray-200
- Header: white with subtle shadow

**Accents**:
- Primary: Purple (purple-500/600 for interactive elements)
- Health metrics: Blue (water), Green (stress/wellness), Orange/Yellow (alerts)
- Menstrual tracking: Pink/Red gradients for cycle-specific features

**Shadows**: Minimal use - shadow-sm for cards, shadow-md for elevated modals only

## Images

**No hero images** - This is a utility dashboard app. Focus on clean data presentation.

**Icon Usage**:
- Lucide React icons throughout (Brain, Droplets, Calendar, Activity, AlertCircle, TrendingUp)
- Emoji accents for score cards (🎯, 😴, 🧘) add personality without clutter

## Animations

**Minimal, purposeful only**:
- Progress bar fills: transition-all duration-500
- Tab switches: Fade transitions (200ms)
- Score updates: Gentle number counter animation
- No scroll animations, no excessive micro-interactions