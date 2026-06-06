# Handoff · City Builder UI Redesign (Direction A · Illuminated Parchment)

## Overview

A complete UI redesign for a 2D retro-pixel city-building game. The redesign reorganises the existing HUD, build menu, settings, modals, and meta screens into a cohesive cozy-medieval visual system ("Illuminated Parchment"), and adds new screens that didn't exist before (Main Menu, Save/Load, Building Inspector, Trade modal).

The existing game logic in `js/` (engine, buildings, citizens, audio, grid) is untouched by this design; what changes is **what the player sees and how it's laid out**. Where this design changes data model expectations (e.g., grouping resources into pods, status colours, day/season tracking) those are called out below.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX prototypes** — they show intended look and behaviour, not production code to copy directly. The HTML uses React + Babel inline so the prototypes can be opened as static files.

**Task:** Recreate these designs inside the existing game's runtime. The current game is a plain HTML + ES module setup (`index.html` + `js/*.js`), and the in-game UI is rendered with vanilla DOM (`document.getElementById`, `innerHTML`, direct class toggles). Reimplement the new UI in that same vanilla style — no React in the shipped game. The JSX in the handoff is convenience for the mockups; treat it as a structural reference, not a dependency.

## Fidelity

**High-fidelity.** Exact colours, typography, spacing, sizes, and component states are specified. Pixel icons are committed to (16×16 grid, drawn as `<rect>` "pixels"). The developer should recreate the UI pixel-accurately.

The one part that is a *recommendation, not a spec* is the ground/world palette change (Meadow over the current Classic checker). See **Ground palette** below.

## Design tokens

### Palette

| Token | Hex | Used for |
|---|---|---|
| `parchment` | `#f0e0b2` | Panel background (light stop) |
| `parchmentDark` | `#e0c890` | Panel background (dark stop) |
| `parchmentEdge` | `#c8a868` | Panel borders, dividers, dotted underlines |
| `ink` | `#2a1d10` | Primary text, key values |
| `inkSoft` | `#5a4530` | Secondary text |
| `inkFaint` | `#8a7050` | Tertiary text, labels, subtitles |
| `gold` | `#c89a3b` | Accents, "treasure" status, highlights |
| `goldDark` | `#8c6618` | Icon outlines, header rules |
| `wine` | `#8c2c1c` | Primary action, critical/danger state, raid theme |
| `wineDark` | `#5a1808` | Wine on darker backgrounds, raid button bg |
| `leaf` | `#4a6b2a` | "Healthy" status, victory state |
| `leafDark` | `#2a4a18` | Healthy text, ledger positive deltas |
| `shadow` | `rgba(40, 25, 10, 0.22)` | Panel drop shadow |

These tokens are exported as `window.A` from `direction-a.jsx` in the prototype.

### Status colour rules

Resource chips in the HUD swap their numeric value colour based on state:

| Status | Value colour | Trigger | Extra |
|---|---|---|---|
| `treasure` | `gold` (`#c89a3b`) | Gold balance | — |
| `healthy` | `leafDark` (`#2a4a18`) | Food/joy above threshold, positive net delta | — |
| `normal` | `ink` (`#2a1d10`) | Default | — |
| `low` | `#a85a18` (ochre) | Resource ≤ ~25% of capacity, no immediate impact | — |
| `critical` | `wine` (`#8c2c1c`) | Resource at 0 or stop a chain | **Red pip dot** on the icon: 6×6 circle, `wine` bg, `parchment` border, soft glow shadow |

Trend strings (`"+10"`, `"-4"`) inherit colour: positive → `leafDark`, negative → `wine`.

### Typography

Load via Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Cinzel:wght@400;500;600;700&family=VT323&display=swap" rel="stylesheet">
```

| Family | Role | Typical use |
|---|---|---|
| `"IM Fell English SC"` | **Display / headers / labels** | Panel titles, pod labels (uppercased, letter-spacing 1.5–4), section headings |
| `"EB Garamond"` | **Body text** | Descriptions, italicised flavour text, ledger labels |
| `"VT323"` (monospace) | **Numerals** | HP/HUD numbers, timers, ledger values, dev overlay |
| `"Cinzel"` | (Used in Direction B and intro copy only) | Not core to the cozy Direction A — only used in side notes |

Common sizes:

| Use | Size | Weight | Letter-spacing | Family |
|---|---|---|---|---|
| Panel title | 18–22px | 400 | 2–4px | IM Fell English SC |
| Pod label | 9px (vertical) / 10px (horizontal) | 400 | 1.5–2px | IM Fell English SC |
| Resource value | 18px | 600 | — | EB Garamond (body) or VT323 (HUD numerals) |
| Raid timer | 28px | 400 | 2px | VT323 |
| Subtitle / flavour | 12–13px | 400 italic | — | EB Garamond |
| Button label | 11–12px | 400 | 1.5–3px uppercased | IM Fell English SC |

### Spacing & sizes

- Panel border: 2px solid `parchmentEdge`
- Panel inner padding: 16px default, 10–12px for tight HUD chips
- Panel shadow: `0 6px 18px rgba(40,25,10,0.22), inset 0 0 0 1px rgba(255,240,200,0.5)`
- Icon sizes used: 10, 11, 13, 14, 20, 22, 26, 28, 36px (all integer multiples are fine; bitmap pixels stay crisp via `image-rendering: pixelated` on the canvas and `shape-rendering: crispEdges` on the SVGs)
- Wax seal sizes: 26 (inline), 32 (banner), 36 (default), 44 (header), 56 (modal)
- Pod divider: 1px solid `parchmentEdge` between pods, with 18px right padding on each pod
- Slider thumb: 14px circle, gold radial-gradient, 1px wine border
- Bar (HP): 12px tall, 1px parchmentEdge border, inner 1px inset for the fill, fill is leaf→leafDark vertical gradient

### Illuminated corners

Every parchment panel gets four 14×14 SVG corner motifs (top-left orientation, mirrored to other corners). Composition:

- 2px goldDark outer L
- 1px gold inner L (offset 2,2)
- 1px leaf inner-inner L (offset 3,3, length 4)
- 2×2 wine "dot" at offset 6,6

Skip corners (`corners={false}`) for tight inline panels — event banner left edge, tooltips, save-slot rows.

### Wax seal

Circular badge for important state. Radial gradient (light → dark), 1px wineDark border, multi-layer shadow:
`0 2px 6px rgba(0,0,0,0.4), inset -2px -2px 4px rgba(0,0,0,0.3), inset 2px 2px 3px rgba(255,255,255,0.18)`

Colours: wine (default), leaf (victory), gold (treasure / merchant).

Used at: raid result modal (large), event banner, save-slot active marker, building inspector primary action callout.

## Pixel icon system

Icons are 16×16 SVGs drawn pixel-by-pixel with `<rect>` elements and `shape-rendering="crispEdges"`. Each icon has a small palette (4–6 colours) and a string-grid representation where each char maps to a palette key (or space for transparent).

**Naming convention** (matches existing game vocabulary where possible):

| Icon | Subject | Used in |
|---|---|---|
| `gold` | Coin (stack-of-three pixel coin) | Treasury pod, costs, save slot |
| `wood` | Stacked logs | Stockpile, costs |
| `stone` | Boulder cluster | Stockpile, costs |
| `iron` | Cooler-toned stone with bright veins | Stockpile, costs |
| `food` | Wheat / grain bundle | Hearth pod, farm |
| `housing` | Red-roofed cottage glyph | Hearth pod |
| `citizens` | Two small figures side-by-side | Hearth pod, save slot |
| `happiness` | Heart | Hearth pod |
| `defense` | Shield with bend | Garrison pod, tower |
| `sword` | Diagonal blade | Garrison pod, soldiers |
| `bow` | Bow + arrow | Garrison pod, archers |
| `knight` | Helmet with plume | Garrison pod (knights), unlocks later |
| `raid` | Burning torch | Reserved for raid-related callouts |
| `scroll` | Rolled parchment with seals | Reserved for events/quests |

**Building sprites** (28–36px in build menu, 36px in inspector):
`house`, `tower`, `wall`, `barracks`, `farm`, `lumberyard`, `quarry`, `mine`, `gate`, `archery`, `ballista`, `road`, `demolish`.

These are placeholders. **Final art should be drawn at native 16×16 by the game's pixel artist and dropped into `assets/sprites/` to match the existing convention.** The current sprite-loading code in `js/assets.js` already supports per-key PNG loading with a fallback colour box; the new pixel icons should be added there as new sprite keys (e.g., `icon_gold.png`, `icon_wood.png`, etc.) so the rest of the game can reuse them.

## Screens / views

### 1 · Day & Season indicator (top-left)

**Purpose:** Replace the current FPS/zoom/cam dev text with player-facing meta state.

**Layout:** Two-column parchment panel anchored 16px from top-left.

| Column | Width | Content |
|---|---|---|
| Day | min 56px | "DAY" label (IM Fell SC, 9px, 2 letter-spacing, inkFaint) over big number (IM Fell SC, 26px, wineDark) |
| Season | flex | Season glyph (22px serif character) + "SEASON" label + season name (IM Fell SC, 14px, ink) |

**Season glyphs/colours:** Spring `✿` `#4a6b2a` · Summer `☀` `#d4a838` · Autumn `✦` `#a8521c` · Winter `❄` `#7a9ab0`.

**The current FPS/zoom/cam readout should be moved off-screen entirely in production**, or hidden behind a dev keystroke. It's debug, not gameplay.

### 2 · Resource HUD bar (bottom-center)

**Purpose:** Show all resources at a glance, grouped semantically.

**Layout:** Single parchment panel anchored 16px from bottom, horizontally centered. Four pods in a row, each pod is a vertical category label + horizontal chip row, separated by 1px `parchmentEdge` dividers.

**Pods (left to right):**

| Pod | Chips |
|---|---|
| TREASURY | gold (status=treasure) with trend |
| STOCKPILE | wood · stone · iron (iron is critical/red when 0) |
| HEARTH | citizens · food (healthy when above threshold, with `+10` trend) · happiness (healthy at 100%) |
| GARRISON | defense · soldiers · archers (and knights when unlocked) |

**Chip layout:** 20×20px icon + label/value stack. Label is `IM Fell SC 10px / 1.5 letter-spacing / inkFaint`. Value is `EB Garamond 18px / weight 600 / status-coloured`. Trend pill sits inline with the value as `EB Garamond 11px` in `leafDark` (positive) or `wine` (negative).

Pod-label rotation: `writing-mode: vertical-rl; transform: rotate(180deg);` — reads bottom-to-top, IM Fell SC 9px gold-dark.

### 3 · Raid timer banner (top-center, hanging scroll)

**Purpose:** Make the next-raid countdown the most legible thing on screen besides the world.

**Layout:** Hangs from the top of the viewport, horizontally centered. Two small black "cord" segments above a clipped polygon panel (mimics a banner pinned to the wall).

**Clip-path:** `polygon(0 0, 100% 0, 100% 85%, 92% 100%, 50% 92%, 8% 100%, 0 85%)` — gives the bottom edge two scalloped tabs and a center point.

**States:**

| State | Bg | Border | Eyebrow | Number colour |
|---|---|---|---|---|
| Normal | parchment → parchmentDark gradient | parchmentEdge | "NEXT RAID" | ink |
| Warning (≤30s or active) | `#c44b3a` → wineDark gradient | wineDark | "⚔ RAID APPROACHES ⚔" | parchment cream |

**Typography:**
- Eyebrow: IM Fell SC 10px / 3 letter-spacing / 0.7 opacity
- Number: **VT323 28px** / 2 letter-spacing — mm:ss
- Footer: IM Fell SC 10px / 2 letter-spacing — `DAY 7 · AUTUMN`

When warning: also overlay a `radial-gradient(ellipse at center, rgba(140, 28, 18, 0) 40%, rgba(140, 28, 18, 0.35) 100%)` on the whole viewport for amplified urgency.

### 4 · Build menu (top-right rail)

**Purpose:** Pick what to place. Long list of buildings, mix of unlocked and locked.

**Layout:** 280-wide parchment panel anchored 24px from top-right.

**Structure (top to bottom):**

1. **Header:** "BUILD" (IM Fell SC 18px / 4 letter-spacing / wineDark / center), 1px divider.
2. **Tabs:** 4-up flex — `All · Civic · Industry · Military`. Active tab has parchment bg + 2px wine bottom border, IM Fell SC 11px / 1.5 letter-spacing, wineDark when active else inkFaint. Inactive tab bg is `rgba(140, 102, 24, 0.07)`.
3. **Item list:** Scrollable (max-height 540px), 8px padding, 4px gap.

**Build item row layout:**

```
[36×36 sprite frame] [name + cost icons]                   [yield text or "— locked —"]
```

- Sprite frame: `rgba(90, 63, 37, 0.16)` bg, 1px parchmentEdge border.
- Sprite: 28px pixel-art building (BuildingSprite component).
- Name: IM Fell SC 13px / 0.5 letter-spacing / ink.
- Cost row: small icon (10px) + value, inkSoft 11px, 8px gap between cost items.
- Yield: italicised EB Garamond 10px / leafDark, right-aligned, max-width 80px.

**States:**

| State | Background | Border | Notes |
|---|---|---|---|
| Default | transparent | 1px transparent | — |
| Hover | `rgba(140, 44, 28, 0.06)` | 1px parchmentEdge | — |
| Selected | `rgba(140, 44, 28, 0.12)` | 1px wine | Used while placing |
| Disabled (can't afford) | bg unchanged | bg unchanged | Greyscale costs, no hover |
| Locked | opacity 0.42 | — | cursor: not-allowed; yield text reads "— locked —"; subtitle could explain requirement, e.g. "req. Smith" |

### 5 · Build placement preview (on world)

When a build item is selected, draw a 1-tile highlight footprint at the cursor:

- Fill: `rgba(255, 240, 200, 0.32)` (warm cream)
- Border: 2px parchment
- If the building has a range (towers, archery), also draw a dashed circle:
  - Stroke: `rgba(255, 220, 120, 0.85)` 2px, `setLineDash([6, 6])`, radius = N tiles × tile size from footprint center.

Validity rules to enforce in code (not visually different yet, but UI should support):
- Invalid tile (occupied / out of bounds) → switch fill to `rgba(140, 44, 28, 0.32)` and stroke to wine.

### 6 · Building inspector (popover)

**Purpose:** Click any placed building to see its state and act on it.

**Layout:** 320-wide parchment panel that floats anchored to the building (with offset so it doesn't cover the building). On small screens / near edge, mirror horizontally.

**Structure:**

1. **Header row** (12px 16px padding, 1px divider below):
   - 48×48 sprite frame (same style as build menu)
   - Title (IM Fell SC 18px / wineDark) + subtitle ("Tilled by Mira & Joran" — citizen names, italic EB Garamond 12px inkFaint)
2. **Body** (12px 16px padding):
   - Italic description (EB Garamond 13px inkSoft 1.4 line-height)
   - **HP bar**: 12px tall, parchmentEdge border, leaf→leafDark fill, value label centered in VT323 11px parchment. Bar fades to ochre `#a8852a` at ≤50%, wine at ≤25%.
   - **Workers row** (only if maxWorkers > 0): pip dots, one per slot. Filled = leaf radial-gradient, empty = 1px parchmentEdge ghost. Count text `2 / 3` in VT323 16px inkSoft.
   - **Yield row**: italic EB Garamond 14px in leafDark.
3. **Actions** (top border, 6px gap, flex-wrap):
   - **Assign Worker** (parchment pip, normal style)
   - **Upgrade** (gold pip, highlighted) — text below: "Upgrade · Mill (200g, 30w)"
   - **Demolish** (wine border + wine text, parchment bg) — refunds 50%

### 7 · Tile tooltip (hover)

Smaller variant of the inspector for read-only previews. 220+ wide parchment panel, no header sprite. Used both for hovering an empty tile while a build item is selected (shows the building's spec) and for placed buildings on hover.

**Sections:**
- Title (IM Fell SC 16px / 2 letter-spacing / wineDark / 6px margin)
- Description (EB Garamond 13px italic inkSoft, line-height 1.35)
- Footer divider, then cost row (left) + yield (right)

### 8 · Event banner (top-center, below raid timer)

**Purpose:** One-line context for transient events ("Wandering Merchant Arrives", "Raiders Sighted", etc.).

**Layout:** Horizontal parchment panel with an 8px wine→wineDark left edge and a small wax-seal badge inside.

- Left edge: 8px solid gradient strip (wine top → wineDark bottom)
- Wax seal: 32px, wine, containing a glyph (`✺` for merchant, `⚔` for raid, etc.)
- Title: IM Fell SC 14px / 1.5 letter-spacing / wineDark, uppercased
- Description: EB Garamond 13px italic inkSoft

Used in normal state and stacks underneath the raid timer in raid-warning state.

### 9 · Settings drawer

**Purpose:** Replace the current `[ SAVE CITY ] / [ LOAD CITY ] / [ RESET ] / [ MUTE ]` stack + audio sliders + shortcuts cheatsheet with a focused panel.

**Layout:** 280-wide parchment panel titled "SETTINGS" (IM Fell SC 14px / 2 letter-spacing / wineDark / 1px parchmentEdge divider below).

**Sections:**

1. **Audio** — three sliders: Master, Music, Sound.
   - Row: 60px label column (IM Fell SC 11px / 1.5 letter-spacing / inkSoft uppercase) + slider track
   - Track: 10px tall, `rgba(40, 25, 10, 0.18)` bg, 1px parchmentEdge border. Fill is solid wine. Thumb is 14×14 gold radial circle with 1px wineDark border.
2. **Actions** — three scroll-style buttons (1px parchmentEdge top divider above):
   - Save City (`✎` icon)
   - Load City (`⌂` icon)
   - Reset Game (`✕` icon, wine text — destructive)
   - Button style: parchment→parchmentDark gradient, 1px parchmentEdge, IM Fell SC 12px / 2 letter-spacing, icon coloured goldDark (or wine for destructive).

**Keyboard shortcuts** (1-9 build tools, 0 demolish, ESC cancel, TAB stats, M music, N SFX) — keep working but **remove from the visible panel**. Surface them via a `?` help button (top-right corner) instead.

### 10 · Top-right corner icon strip

Three small parchment buttons (32×32) at top-right offset 12px: `⚙` settings, `♪` mute toggle (toggles between `♪` and `♪̸`/`♪×`), `?` help/shortcuts. Each is a 2px parchmentEdge button with parchment→parchmentDark bg and the symbol in IM Fell SC 18px wineDark.

### 11 · Stats overlay (TAB)

**Purpose:** Full ledger view of the realm. Currently 6 lines of plain text; redesign as a panel.

**Layout:** 460-wide parchment panel titled "REALM LEDGER · DAY 7".

Two grid sections (1fr 1fr columns):

**Population block:** Citizens · Builders · Soldiers · Archers · Knights · Happiness.
**Income block** (1px parchmentEdge top divider, "INCOME · PER MINUTE" eyebrow in IM Fell SC 11px / 2 letter-spacing / goldDark): Gold · Food · Wood · Stone.

**Row style:** EB Garamond 14px. Label italic inkSoft, value 600 weight (leafDark for positive deltas, gold for income totals). 1px dotted parchmentEdge bottom border on each row (dotted, not solid).

### 12 · Raid result modal

**Purpose:** Replace the current full-screen modal that lists raid outcomes.

**Layout:** 480-wide centered parchment panel, no padding on the panel itself — children manage their own padding.

**Structure:**

1. **Top block** (28/32/18 padding, centered):
   - Large wax seal (56px): **leaf** with `✚` for victory / **wine** with `✗` for defeat
   - Title: IM Fell SC 32px / 4 letter-spacing — `VICTORY` (leafDark) or `DEFEAT` (wineDark)
   - Subtitle: italic EB Garamond 15px inkSoft — "Your walls held strong against the raiders." / "The gate has fallen. Rebuild what you can."
   - **Ledger box**: inset `rgba(140, 102, 24, 0.08)`, 1px parchmentEdge, padding 12/16, left-aligned rows of `label : value` with status colours (leafDark for "0 lost", gold for spoils, wine for losses).
2. **Footer**: 1px parchmentEdge top divider, centered "CONTINUE" button — `wine → wineDark` vertical gradient, parchment cream text, IM Fell SC 14px / 3 letter-spacing, 8px 28px padding.

### 13 · Main menu / title screen

**Purpose:** Pre-game entry point. Doesn't exist yet in the codebase.

**Layout:** Full-screen, dimmed game world background (Meadow palette, density 0.22) with a radial vignette `radial-gradient(ellipse at center, rgba(40,25,10,0.4), rgba(0,0,0,0.75))` on top.

**Stack:**

- Top title block (14% from top, centered):
  - Eyebrow: IM Fell SC 14px / 8 letter-spacing / gold / opacity 0.85 — `OF KEEP & KINGDOM` (or whatever the user picks as the game's tagline)
  - **Title**: IM Fell SC 80px / 8 letter-spacing / parchment cream, shadow `0 4px 0 ${wineDark}, 0 6px 24px rgba(0,0,0,0.7)` — `HEARTHWOOD` (placeholder game name — *user should confirm*)
  - Subtitle: 64×10 filigree (SVG) + italic EB Garamond 17px parchmentDark + mirrored filigree
- Menu scroll (bottom 80px, centered, 360 wide): parchment panel with menu rows.

**Menu rows:** 14/22 padding, 1px parchmentEdge dividers between rows.
- Icon (24px slot center): `✦` (new), `⌂` (continue), `✎` (load), `⚙` (settings), `❦` (credits)
- Label: IM Fell SC 18px / 3 letter-spacing uppercased
- Subtitle (continue only): italic EB Garamond 12px inkFaint — `Hearthwood · Day 7`
- Active row (first by default): wine-tinted bg `rgba(140, 44, 28, 0.08)`, label in wineDark, trailing `›` chevron in wine

Footer: centered IM Fell SC `v 0.7.2 · ◆ ◆ ◆` in `rgba(232, 211, 168, 0.5)` 12px / 2 letter-spacing, 14px from bottom.

### 14 · Save / Load realm

**Purpose:** Replaces the existing single Save/Load button — adds slots and mini-map thumbnails.

**Layout:** 520-wide parchment panel with header bar that shows mode tabs (Load · Save).

**Header bar:** padding 14/22, 1px parchmentEdge bottom border.
- Left: title — IM Fell SC 20px / 4 letter-spacing wineDark — `LOAD REALM` or `SAVE REALM`
- Right: two tabs in a flex row, IM Fell SC 11px / 2 letter-spacing. Active tab has parchment bg + 2px wine bottom border.

**Body:** 14px padding, flex column 6px gap.

**Save slot row** (filled):

- 48×48 canvas thumbnail of the world (meadow tiles + a few coloured building dots). `image-rendering: pixelated`.
- Stack: name (IM Fell SC 16px / 1.5 letter-spacing / ink), meta line (italic EB Garamond 12px inkFaint — `Day 7 · Autumn · saved 2m ago`), stats row (12px inkSoft icons + counts).
- Active slot: wine-tinted bg + 1px wine border, with a 26px wine wax seal at right containing `✓`.

**Empty slot row:**
- 1px dashed parchmentEdge border, dim bg `rgba(140, 102, 24, 0.04)`.
- 36×36 dashed border placeholder with `+` (22px inkFaint).
- Italic EB Garamond 14px inkFaint label — `Empty Slot · Begin a new realm`.

**Footer:** 12/18 padding, 1px parchmentEdge top divider, soft gold-tinted bg.
- Left: italic EB Garamond 13px inkFaint — `Autosave every 60s`
- Right: scroll button — `Load Selected` (load mode) / `Save Here` (save mode)

### 15 · Trade modal · Wandering Merchant

**Purpose:** Replaces the current `#trade-modal` with a fully designed flow.

**Layout:** 560-wide parchment panel.

**Header (16/22/12 padding, 1px parchmentEdge bottom divider):**
- 44px wine wax seal with `※`
- Stack: title `THE WANDERING MERCHANT` (IM Fell SC 22px / 3 letter-spacing / wineDark) + italic flavour quote (EB Garamond 13px inkFaint) — *"Lay your coin and I'll lay my wares, friend."*
- Right: countdown — VT323 14px wine `DEPARTS` over VT323 22px wineDark timer (mm:ss)

**Body:** 14px padding, vertical flex 8px gap. Each deal is a row:

- 12px padding, `rgba(140, 102, 24, 0.04)` bg, 1px parchmentEdge — or `rgba(140, 44, 28, 0.06)` bg + 1px wine border if marked "favored"
- Deal name (IM Fell SC 14px / 1.5 letter-spacing / wineDark uppercased), optional `★ FAVORED` chip (IM Fell SC 10px goldDark)
- Below: YOU GIVE / YOU GAIN columns separated by `›` chevron (20px serif goldDark)
- Each cost is a chip: 3/8 padding, `rgba(40, 25, 10, 0.06)` bg, 1px parchmentEdge border, 13px icon + VT323 16px ink value
- Right-aligned **ACCEPT** button:
  - Favored: wine→wineDark gradient, cream text
  - Default: parchment→parchmentDark gradient, ink text
  - Both: IM Fell SC 12px / 2 letter-spacing, 8/16 padding

**Footer:** 10/22 padding, 1px parchmentEdge top divider, soft gold bg.
- Left: italic EB Garamond 12px inkFaint — `Choose at most three before he departs.`
- Right: `FAREWELL ›` (IM Fell SC 12px / 2 letter-spacing / inkSoft)

### Ground palette · Meadow (recommended)

The original world's alternating grass/dirt checker (`#3f6b2a`/`#48782f` grass + `#5a3f25`/`#6b4a2b` dirt every other tile) reads as a debug grid and clashes with the parchment HUD. **The fix isn't a different brown — it's dropping the alternating dirt entirely.** Dirt should appear only where the player carves a path or where a building sits on cleared ground.

**Meadow palette:**

```js
{
  base: ['#5e8a3e', '#658f44'],   // two near-identical grass shades
  alt:  ['#5e8a3e', '#658f44'],   // no checker — alt == base
  speckDark:  ['#4a7a30', '#3f6a28'],
  speckLight: ['#7aa252', '#88ad60'],
  checker: false,
}
```

**Per-tile rendering:**
1. Fill the 40×40 tile with one of `base[0]` / `base[1]` (random).
2. Sprinkle ~5 `4×4` "dark speck" pixels at random positions in the tile.
3. Sprinkle ~3 `4×4` "light speck" pixels at random positions.
4. Use a deterministic seeded PRNG so the same world re-renders identically.

**Paths:** explicit data — `paths: [[x, y, length, direction]]` — render as warm dirt (`#7a5a36`/`#8c6a3a`) over grass with darker `#5a4022` specks.
**Patches:** explicit data — `patches: [[x, y, radius]]` — render as a circular dirt clearing using the same dirt palette. Place a patch under every building's footprint automatically.

Result: the world looks like a meadow with a few worn paths and clearings instead of a checkered debug map.

If the user later wants seasonal feel, swap to the `autumn` palette in winter/autumn months (warmer sage `#6e8a48`/`#779452`).

## Interactions & behaviour

### Build flow
1. User clicks a build menu item → item becomes `selected` (wine border + tinted bg).
2. Cursor on the world shows the placement preview (cream highlight + dashed range circle if applicable).
3. Click a valid tile → place building, `playBuildSFX()`, increment counters, deduct cost, refreshUI. Selected item stays selected to allow chaining placements.
4. ESC → clear `selectedTool`, hide preview.

### Building inspector
- Click any placed building (when no tool selected) → inspector opens floating near the building. Persistent until user clicks elsewhere or presses ESC.
- Demolish → confirm via the chip itself? Or use a 2-click "are you sure" pattern: first click turns the demolish chip darker wine with text "Confirm"; second click executes. Refunds 50%.
- Upgrade → checks new cost; if affordable, executes; otherwise dim the chip and tooltip "Need 30w more".

### Raid timer
- Updates every second.
- ≤30s → switch to warning state (red banner + viewport vignette + event banner pinned below). Add a heartbeat pulse animation on the wax seal (scale 1 → 1.06 → 1, 1s ease-in-out infinite).
- During raid → swap to "ACTIVE RAID" eyebrow and freeze countdown.

### Day / Season
- Increment `day` each in-game day (existing tick).
- Season cycles every N days (game design decision — propose every 7 days = 28-day year).
- When season changes, briefly flash the season cell (1.4s leaf-gold glow fade).

### Trade modal
- Appears when wandering-merchant event fires.
- Countdown is `gameState.merchantDepartsAt - now`. When it hits 0 → close modal automatically with toast "The merchant has departed."
- Accepting a deal → animate the chips flying from inventory into the merchant's seal and back; or just play SFX + refresh.

### Animations & transitions
- Panel open: `opacity 0 → 1` + `translateY(8px) → 0`, 180ms, ease-out.
- Panel close: same in reverse, 140ms.
- Hover on interactive: 120ms ease background/border transition.
- Selected build item: 200ms colour + border transition.
- Raid warning pulse: 1s ease-in-out infinite on the wax seal/banner edge.

## State changes vs. existing game model

The existing `gameState` already tracks: gold, housing, defense, population, food, happiness, wood, stone, iron, raid timer. The redesign adds expectations:

| New | Source | Notes |
|---|---|---|
| `day` | game tick | Increment per in-game day |
| `season` | derived from `day` | Cycle every N days |
| `gold.trend` | derived | `+G per Ts` calculated from active income buildings |
| `food.trend` | derived | Sum of farm yields |
| Resource status | derived | Threshold per resource (e.g., iron < 1 = critical; food < 25% capacity = low) |
| Building `hp` / `hpMax` | already exists (`_BUILDING_HP`) | Surface in inspector |
| Building `workers` / `maxWorkers` | already exists (`def.maxWorkers` + assignment) | Surface in inspector with pip UI |
| Save slot metadata | new | name, day, season, citizens, gold, timestamp, optional thumbnail data — store a small canvas snapshot per save |
| Citizen names | new (suggested) | Used in inspector subtitle ("Tilled by Mira & Joran") for warmth |
| Trade deals model | partially exists | Add `label`, `recommended` flag, `give` / `get` objects keyed by resource |

## Files in this bundle

| Path | Role |
|---|---|
| `City Builder UI.html` | Main HTML — loads all JSX modules, mounts the design canvas |
| `design-canvas.jsx` | Pan/zoom design-canvas wrapper (not part of game UI; just for review) |
| `world.jsx` | The PixelWorld React component with all 5 ground palettes |
| `icons.jsx` | Pixel-icon component + ICONS palette + BUILDING_SPRITES |
| `direction-a.jsx` | Core Direction A components: panels, HUD, build menu, raid banner, tooltip, settings, stats, raid modal |
| `direction-a-extras.jsx` | Day/Season, Main Menu, Save/Load, Building Inspector, Trade modal |
| `direction-b.jsx` | Alternative direction (Carved Oak Banners) — **not used in Direction A**, included for reference only |
| `app.jsx` | Composes everything into the design canvas with named artboards |

The existing game's source (`js/engine.js`, `js/game.js`, `js/buildings.js`, etc.) is unchanged. The developer should:

1. Add the new pixel-icon SVGs (or PNGs) to `assets/sprites/` and load them in `js/assets.js`.
2. Add new DOM elements / replace existing ones in `index.html`:
   - `#day-season` (top-left) replaces `#stats-counter`
   - `#hud-bar` (bottom-center) replaces the current top-left stats list
   - `#build-menu` (top-right) replaces the existing build button list
   - `#raid-banner` (top-center) replaces the current `#res-raid-timer` location
   - `#settings-drawer`, `#save-load-modal`, `#trade-modal` (already exists, restyle), `#raid-modal` (already exists, restyle), `#building-inspector` (new)
3. Wire `refreshUI()` to update the new DOM. The existing function should still own which resources to push to which element.
4. Add `season` derivation + new event triggers (merchant timer, season-flip animation).
5. Replace the world-rendering palette in `js/grid.js` with the Meadow palette (drop alternating dirt).

## Suggested directory after handoff

```
your-game/
├── index.html                  # restructured to host new UI elements
├── style.css                   # parchment theme + tokens
├── js/
│   ├── engine.js               # existing — wire to new UI elements
│   ├── grid.js                 # existing — switch palette to meadow
│   ├── ui/
│   │   ├── hud.js              # new — HUD bar render
│   │   ├── build-menu.js       # new
│   │   ├── inspector.js        # new
│   │   ├── trade.js            # new
│   │   ├── save-load.js        # new
│   │   ├── main-menu.js        # new
│   │   └── icons.js            # new — icon registry
│   └── ...
├── assets/
│   └── sprites/
│       ├── icon_gold.png       # new — 16×16 pixel icons
│       ├── icon_wood.png
│       └── ...                 # one per token in the icon system
└── design_handoff_city_builder_ui/   # this folder
    ├── README.md
    └── (HTML + JSX prototypes)
```
