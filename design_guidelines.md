# Design Guidelines: Real-Time Event Broadcasting System

## Design Approach

**Modern Premium Dashboard** inspired by enterprise applications with gradient backgrounds, clean typography, and vibrant accent colors. The design emphasizes clarity, professionalism, and seamless real-time updates.

**Core Principle**: Premium aesthetics meet functional clarity. Every element is designed for maximum readability and user engagement.

---

## Color System

**Background Gradient**
- Base: Linear gradient from deep purple (#1a0f2e) to dark blue (#0f1729)
- Creates depth and visual interest without compromising readability
- Applied to main app background

**Surface Colors**
- Card Background: rgba(30, 30, 50, 0.6) - Semi-transparent dark with backdrop blur
- Elevated Surface: rgba(40, 40, 60, 0.8) - Modals, dropdowns, overlays
- Sidebar: rgba(0, 0, 0, 0.5) - Deep black with transparency

**Primary Accent**
- Vibrant Blue: #0066FF - Primary buttons, links, active states
- Blue Hover: #0052CC - Hover state for interactive elements
- Blue Light: #4D94FF - Lighter variant for secondary elements

**Event Type Colors** (vibrant for quick identification)
- Products: #10B981 (emerald green)
- Polls: #0066FF (vibrant blue)
- Contests: #A855F7 (purple)

**Text Colors**
- Primary: #FFFFFF - Headers, important text
- Secondary: rgba(255, 255, 255, 0.7) - Body text, descriptions
- Muted: rgba(255, 255, 255, 0.5) - Captions, metadata

**System States**
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444
- Info: #0066FF

---

## Typography

**Font Family**: Inter (Google Fonts) - Modern, clean, highly legible
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Type Scale**
- Display (Page Headers): 32px / Bold (700)
- H1 (Section Titles): 24px / Semibold (600)
- H2 (Card Headers): 20px / Semibold (600)
- H3 (Subheadings): 18px / Medium (500)
- Body Large: 16px / Regular (400)
- Body: 14px / Regular (400)
- Caption: 12px / Medium (500)
- Code/Monospace: 14px / JetBrains Mono

**Letter Spacing**
- Headers: -0.02em (tighter for display text)
- Body: 0em (default)
- Captions: 0.01em (slightly looser for small text)

---

## Layout System

**Spacing Scale** (Tailwind compatible)
- xs: 4px (0.25rem)
- sm: 8px (0.5rem)
- md: 16px (1rem)
- lg: 24px (1.5rem)
- xl: 32px (2rem)
- 2xl: 48px (3rem)

**Container Widths**
- Max width: 1400px (max-w-screen-2xl)
- Padding: 24px on desktop, 16px on mobile
- Cards: Full width on mobile, grid on desktop

**Grid System**
- Campaign cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Gap: 24px (gap-6)
- Responsive breakpoints: sm: 640px, md: 768px, lg: 1024px, xl: 1280px

---

## Component Patterns

### Cards
**Design**
- Background: Semi-transparent dark with backdrop-blur-xl
- Border: None (borderless design)
- Border Radius: 16px (rounded-2xl)
- Padding: 24px (p-6)
- Shadow: Subtle glow effect for depth

**Hover State**
- Subtle brightness increase (brightness-105)
- Smooth transition (200ms ease)

### Buttons

**Primary Button**
- Background: #0066FF
- Text: White
- Padding: 12px 24px
- Border Radius: 8px
- Hover: #0052CC
- Font: 14px Medium (500)

**Secondary Button**
- Background: rgba(255, 255, 255, 0.1)
- Border: 1px solid rgba(255, 255, 255, 0.2)
- Text: White
- Hover: rgba(255, 255, 255, 0.15)

**Icon Buttons**
- Square or circular
- Size: 40px × 40px
- Hover: Background rgba(255, 255, 255, 0.1)

### Form Inputs

**Text Inputs**
- Background: rgba(255, 255, 255, 0.05)
- Border: 1px solid rgba(255, 255, 255, 0.1)
- Border Radius: 8px
- Padding: 12px 16px
- Text: White
- Placeholder: rgba(255, 255, 255, 0.4)
- Focus: Border color #0066FF

**Select Dropdowns**
- Same styling as text inputs
- Chevron icon: White

### Navigation

**Sidebar (if applicable)**
- Background: rgba(0, 0, 0, 0.5)
- Width: 280px
- Icons: White with subtle opacity
- Active state: Blue highlight

**Top Navigation**
- Height: 64px
- Background: rgba(0, 0, 0, 0.3) with backdrop-blur
- Sticky positioning
- Logo left, actions right

### Status Indicators

**Connection Status**
- Connected: Green dot (#10B981) + "Connected" text
- Connecting: Yellow dot (#F59E0B) + "Connecting..." text
- Disconnected: Red dot (#EF4444) + "Disconnected" text
- Pulsing animation on status dot

**Client Count**
- User icon + count
- Subtle background: rgba(255, 255, 255, 0.1)
- Rounded pill shape

---

## Effects & Animations

**Backdrop Blur**
- Cards: backdrop-blur-xl
- Navigation: backdrop-blur-lg
- Overlays: backdrop-blur-2xl

**Transitions**
- Default: 200ms ease
- Color changes: 150ms ease
- Transform: 200ms cubic-bezier(0.4, 0, 0.2, 1)

**Animations**
- Fade in: opacity 0 → 1 (300ms)
- Slide in: translateY(20px) → 0 (300ms)
- Pulse (status): scale 1 → 1.2 → 1 (1s infinite)

**Hover Effects**
- Buttons: brightness-110
- Cards: brightness-105
- Links: opacity 0.7 → 1

---

## Dark Mode Implementation

**Always Dark**
- Application enforces dark mode
- No light mode toggle
- Gradient background always visible

**Glass Morphism**
- Use semi-transparent backgrounds
- Apply backdrop-blur for depth
- Layer effects for hierarchy

---

## Accessibility

**Contrast Ratios**
- Text on background: Minimum 7:1 (AAA)
- Interactive elements: Minimum 4.5:1 (AA)
- Focus indicators: 3px solid #0066FF

**Keyboard Navigation**
- Visible focus states on all interactive elements
- Logical tab order
- Escape key closes modals/dialogs

**Screen Readers**
- Semantic HTML throughout
- ARIA labels for icon-only buttons
- Live regions for real-time updates

---

## Images & Icons

**Icons**
- Lucide React for UI icons
- Size: 20px default, 24px for emphasis
- Color: White with opacity variations
- Stroke width: 2px

**Logos**
- Support for campaign logos
- Max dimensions: 200px × 200px
- Rounded corners: 8px
- Fallback: Gradient placeholder

**Event Images**
- Product images: 4:3 aspect ratio
- Poll option images: Square (1:1)
- Lazy loading for performance
- Border radius: 8px

---

## Responsive Design

**Breakpoints**
- Mobile: < 640px (single column)
- Tablet: 640px - 1024px (2 columns)
- Desktop: > 1024px (3+ columns)

**Mobile Optimizations**
- Larger touch targets (min 44px)
- Simplified navigation (hamburger menu)
- Stacked layouts for forms
- Bottom sheet for modals

**Desktop Enhancements**
- Multi-column grids
- Side-by-side layouts
- Hover states enabled
- Keyboard shortcuts

---

## Page-Specific Patterns

### Campaign List Page
- Grid of campaign cards
- "New Campaign" button (primary, top-right)
- Campaign card: Logo + Name + Description + Date + Actions
- Empty state: Center-aligned with create CTA

### Campaign Admin Page
- Header with campaign info + back button
- Event forms in collapsible sections
- Real-time event log (sidebar or bottom)
- Connection status (top-right)

### Advanced Campaign Page
- Tabbed interface (Overview, Integrations, Components)
- Form sections with clear labels
- Save/Cancel actions per section
- Visual component timeline

### Viewer Page
- Clean, distraction-free event display
- Event cards with animations
- Notification system
- Minimal chrome

---

## Best Practices

1. **Consistency**: Use design tokens from this guide
2. **Performance**: Optimize images, lazy load content
3. **Accessibility**: Test with keyboard and screen readers
4. **Responsiveness**: Mobile-first approach
5. **Clarity**: Prioritize content hierarchy
6. **Feedback**: Visual confirmation for all actions

This design creates a premium, professional experience with excellent readability and modern aesthetics.
