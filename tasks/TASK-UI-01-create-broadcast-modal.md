# TASK UI-01 — Redesign "Create Broadcast" modal

**Status: TODO**

## Goal
Redesign the Create Broadcast modal with Sportmonks match picker as the primary action.

## Layout
- Modal width: `max-w-5xl`
- Two sections: 1) Link Match Context (top), 2) Basic Info (bottom)

## Section 1 — Link Match Context
4-column grid controls:
- League/Competition dropdown — show league logo from Sportmonks CDN
- Date picker — defaults to today
- Search filter — text input to filter matches

Match list (scrollable):
- Each item: home team logo + away team logo (overlapping circles), "Home vs Away", kick-off time, venue
- Selected state: blue border + blue tint + filled checkmark
- Hover: subtle blue border

On select → auto-fill:
- Broadcast Name → "{HomeTeam} vs {AwayTeam}"
- Start Time → kick-off datetime from Sportmonks

## Section 2 — Basic Info
- Broadcast Name (full width, auto-filled, editable, required)
- Campaign (full width, dropdown, required)
- Description (full width, textarea)
- External Content ID (full width, empty, helper: "Viaplay/TV2 stream content ID")
- Start Time / End Time (side by side, auto-filled start)
- Metadata JSON (textarea, keep as-is)

## Data sources
- `/api/sportmonks/leagues` and `/api/sportmonks/fixtures`
- Team/league logos from cdn.sportmonks.com

## Notes
- Must work from both `/broadcasts` and campaign detail
- All existing broadcast creation functionality must keep working
