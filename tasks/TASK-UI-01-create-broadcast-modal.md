# TASK UI-01 — Redesign "Create Broadcast" modal

**Status: TRANSLATIONS COMPLETED — Modal redesign COMPLETED**  
**Owner:** Replit

---

## Problem
The current modal is in Spanish and lacks the Sportmonks match picker. All UI text must be in English.

## Goal
Redesign the Create Broadcast modal with Sportmonks match picker as the primary action.

---

## Translations (current ES → correct EN)

| Current (Spanish) | Should be (English) |
|---|---|
| "Selecciona un partido para autocompletar el formulario." | "Select a match to auto-fill the form." |
| "Liga / Competición" | "League / Competition" |
| "Seleccionar liga..." | "Select league..." |
| "Fecha del partido" | "Match date" |
| "Buscar equipo" | "Search team" |
| "Nombre del equipo..." | "Team name..." |
| "Selecciona una liga para ver los partidos disponibles" | "Select a league to see available matches" |
| "Información del Broadcast" | "Broadcast Information" |
| "Nombre del Broadcast" | "Broadcast Name" |
| 'Ej: "Atlético Madrid vs PSG"' | 'E.g.: "Barcelona vs PSG"' |
| "Campaña" | "Campaign" |
| "Seleccionar campaña..." | "Select campaign..." |
| "Descripción opcional del broadcast" | "Optional broadcast description" |
| "Vincula este broadcast al ID de contenido de tu reproductor de vídeo (ej: stream ID de Viaplay o TV2)." | "Link this broadcast to your video player content ID (e.g. Viaplay or TV2 stream ID)." |
| "Inicio" | "Start time" |
| "Fin" | "End time" |
| "Cancelar" | "Cancel" |
| "Crear Broadcast" | "Create Broadcast" |

Also fix: "votos" → "votes" in poll options display throughout the dashboard.

---

## New modal design (implement after translations)

**Modal width:** `max-w-5xl`

### Section 1 — Link Match Context (top)

4-column grid:
- **League/Competition** dropdown — show league logo from Sportmonks CDN
- **Date picker** — defaults to today
- **Search filter** — text input to filter by team name

**Match list** (scrollable, below controls):
- Each row: home logo + away logo (overlapping circles), "Home vs Away", kick-off time, venue
- Selected state: blue border + blue tint + filled checkmark icon
- Hover: subtle blue border

**On match select → auto-fill:**
- Broadcast Name → `"{HomeTeam} vs {AwayTeam}"`
- Start Time → kick-off datetime from Sportmonks
- `sportmonks_fixture_id` → fixture id (hidden field, required)

### Section 2 — Broadcast Information (bottom)

- **Broadcast Name** (full width, auto-filled, editable, required)
- **Campaign** (full width, dropdown, required)
- **Description** (full width, textarea, optional)
- **External Content ID** (full width, helper text: "Viaplay/TV2 stream content ID — required")
- **Start Time / End Time** (side by side, auto-filled from match)

**Validation:** `sportmonks_fixture_id` + `externalId` are required before enabling "Create Broadcast" button.

---

## Data sources

- `GET /api/sportmonks/leagues` — list of available leagues
- `GET /api/sportmonks/fixtures?leagueId=X&date=YYYY-MM-DD&team=Y` — match list
- Team/league logos from `cdn.sportmonks.com`

---

## Notes
- Must work from both `/broadcasts` and campaign detail pages
- All existing broadcast creation functionality must keep working
- Do not break existing fields (metadata JSON, etc.)
