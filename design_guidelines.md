# Design Guidelines: Real-Time Event Broadcasting Admin Panel

## Design Approach

**Hybrid Dashboard System** blending Linear's minimalist admin aesthetics with Material Design's data visualization patterns. The real-time nature demands clear status indicators and live updates without overwhelming the interface.

**Core Principle**: Information clarity meets real-time responsiveness. Every element serves the dual purpose of data presentation and live monitoring.

---

## Color System

**Dark Mode Foundation**
- Background Base: 222 47% 11% (deep charcoal)
- Surface: 222 47% 14% (elevated cards)
- Surface Elevated: 222 47% 17% (modals, dropdowns)
- Border: 222 47% 20% (subtle divisions)

**Event Type Colors** (vibrant for quick scanning)
- Products: 142 76% 36% (emerald green) - for product launches/updates
- Polls: 217 91% 60% (vivid blue) - for user polls/voting
- Contests: 280 100% 70% (purple) - for competitions/giveaways
- Each type uses 20% opacity background with full opacity borders/text

**System Colors**
- Success/Active: 142 76% 36%
- Warning: 38 92% 50%
- Error: 0 84% 60%
- Text Primary: 210 40% 98%
- Text Secondary: 215 20% 65%

---

## Typography

**Font Stack**: Inter (Google Fonts) for entire interface
- Display: 32px/700 for dashboard headers
- Heading: 24px/600 for section titles
- Subheading: 18px/600 for card headers
- Body: 15px/400 for content
- Caption: 13px/500 for metadata/timestamps
- Code: JetBrains Mono 14px/400 for WebSocket URLs/IDs

**Norwegian Text Handling**: Ensure proper rendering of æ, ø, å characters with sufficient letter-spacing (0.01em) for readability.

---

## Layout System

**Spacing Units**: Use Tailwind's 4, 6, 8, 12, 16, 24 for consistent rhythm
- Card padding: p-6
- Section spacing: space-y-8
- Grid gaps: gap-6
- Component margins: mb-4, mb-6

**Grid Structure**
- Main Dashboard: 24px side padding, max-w-screen-2xl centered
- Two-column layout: 2fr (main content) + 1fr (sidebar/activity feed)
- Card grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

---

## Component Library

### Navigation
**Top Bar** (sticky, z-50)
- Logo + title left, WebSocket status center, user menu right
- Height: h-16, backdrop-blur-xl with bg-[222_47%_11%]/80
- Live indicator: pulsing dot with "LIVE" text when connected

### Event Cards
**Unified Card Design**
- Rounded-2xl, border-2 with event-type color
- Background: event-type color at 8% opacity
- Header: Event type badge + timestamp (right-aligned, text-xs)
- Content: Icon (h-8) + title (font-semibold) + description
- Footer: Action buttons + participant count/status

### Real-Time Feed (Sidebar)
- Scrollable container (h-screen - h-16)
- Mini event cards with abbreviated content
- Auto-scroll to newest (with pause-on-hover)
- "Ny hendelse" badge for unread items

### Forms (Event Creation)
**Dark-Optimized Inputs**
- Background: 222 47% 17%
- Border: 222 47% 25% (focus: event-type color)
- Text: 210 40% 98%
- Placeholder: 215 20% 50%
- Padding: px-4 py-3, rounded-lg

**Event Type Selector**
- Segmented control with three options
- Active state: background in event-type color (20% opacity)
- Hover: subtle brightness increase

### Status Indicators
**WebSocket Connection**
- Connected: Green pulsing dot + "Tilkoblet"
- Disconnecting: Yellow + "Kobler til..."
- Error: Red + "Frakoblet" with reconnect button

### Data Visualization
**Event Statistics Dashboard**
- Bar charts with event-type colors
- Grid of metric cards (count, active participants, response rate)
- Sparkline graphs for trend visualization

---

## Images

### Hero Section
**Dashboard Header Visual**
- Full-width gradient overlay image (h-64) showcasing abstract network/connection visualization
- Gradient overlay: from background-base to transparent (bottom to top)
- Position: Below top navigation, above main content
- Contains: Large dashboard title "Hendelsesstyring" + subtitle "Sanntids kringkasting" with blurred-background outlined buttons for "Ny hendelse" and "Statistikk"

**Card Thumbnails** (where applicable)
- Product events: 4:3 ratio product images
- Contest events: Trophy/reward imagery
- Poll events: Chart/graph representations
- All with rounded-lg, border matching event-type color

---

## Interactions

**Animations** (subtle, purposeful only)
- Event card entry: Slide-in from right with fade (200ms ease-out)
- Live updates: Gentle glow pulse on new items (1s duration)
- WebSocket status: Pulsing animation on connection dot
- NO hover animations on hero buttons (rely on native states)

**Micro-interactions**
- Card hover: Subtle brightness lift (brightness-105)
- Button press: Scale-95 transform
- Form focus: Border color transition (150ms)

---

## Accessibility

**Dark Mode Consistency**
- All inputs maintain dark backgrounds (no white fields)
- Minimum contrast ratio 4.5:1 for all text
- Focus indicators: 3px outline in event-type color
- Keyboard navigation: Visible focus states throughout

**Screen Reader Support**
- Live region announcements for new events
- Clear labels for all form controls in Norwegian
- Status indicators with aria-live="polite"

---

## Admin Panel Specific Patterns

**Bulk Actions Bar**
- Appears when events selected (sticky bottom)
- Dark surface with elevated z-index
- Actions: Slett, Arkiver, Eksporter
- Clear count indicator "3 hendelser valgt"

**Filter System**
- Dropdown filters for event type, date range, status
- Applied filters shown as dismissible chips
- "Nullstill filtre" link when filters active

**Empty States**
- Centered icon + message when no events
- "Opprett første hendelse" CTA button
- Illustration suggestion: Abstract broadcasting waves

This design creates a professional, real-time monitoring experience optimized for Norwegian admin users with clear event-type differentiation and responsive live updates.