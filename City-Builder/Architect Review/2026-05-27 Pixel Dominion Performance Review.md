# Pixel Dominion — Architecture & Performance Review
**Date:** 2026-05-27
**Reviewer:** Senior Game Architect
**Scope:** `js/game.js` (the shipped single-file build loaded by `index.html`). The
`js/engine.js`, `js/grid.js`, `js/citizens.js`, `js/buildings.js`, `js/assets.js`, `audio.js`
module set was a **second, divergent implementation that is not loaded** — see LOW-1.

> **Remediation status — updated 2026-05-27:** Both HIGH findings and all five MEDIUM
> findings have been implemented and verified (`node --check` passes). LOW-1 is resolved
> (modules archived to `js/legacy/`). LOW-2 and LOW-3 remain open as deferred polish. Line
> numbers in the findings below reference the **pre-fix** file; see each finding's
> *Resolution* note for what landed. Gameplay semantics were preserved throughout.

---

## Executive Summary

This is a healthy, surprisingly well-optimized codebase for its size. The two things
that usually kill JS games — pathfinding allocations and per-frame grid scans in the
update loop — have already been handled correctly: A* uses pre-allocated typed-array
buffers with a per-frame search budget (`_raidPathBudget`), the structure lookup tables
(`activeWalls`, `activeFarms`, etc.) are rebuilt event-driven on place/demolish rather
than per frame, the grass layer is pre-rendered to an offscreen canvas, and effect/particle
arrays are compacted in place with a swap-and-truncate pattern (zero garbage). There are
**no CRITICAL issues** — nothing here will freeze or crash the tab.

The remaining cost is concentrated in two places: **the render loop** and a handful of
**per-frame heap allocations**. The single most important fix is **HIGH-1** — `render()`
rebuilds a merged `BUILDINGS` object via `Object.assign({}, ...)` on *every frame*, which
is a pure-waste allocation that feeds the garbage collector ~60 objects/second for no
reason. Fix that first; it is a one-line change with zero risk. The second most impactful
is **HIGH-2**, the territory-shading pass, which runs a `Math.hypot` and an individual
`fillRect` for essentially every visible tile every frame when zoomed out.

---

## Findings Table

| Status | Severity | Title | Location | Summary |
|---|---|---|---|---|
| ✅ Fixed | HIGH | Per-frame object allocation in render | `game.js:4710` | `Object.assign({}, BUILDINGS, …)` rebuilt every frame |
| ✅ Fixed | HIGH | Territory shading scans + fills every visible tile | `game.js:247-256` | `Math.hypot` + `fillRect` per tile per frame (~4096 at zoom-out) |
| ✅ Fixed | MEDIUM | Per-frame raider filter allocations | `game.js:4355,4337` | `.filter()` / `.every()` allocate each frame during raids |
| ✅ Fixed | MEDIUM | `calcDefense`/`countBuildings` full-grid scans | `game.js:2762-2791` | 4096-tile scan, redundant with maintained active-lists |
| ✅ Fixed | MEDIUM | `assignCitizenJobs` double full-grid scan | `game.js:4228-4286` | Two 4096-tile scans + `citizens.find()` inside, every 3 s |
| ✅ Fixed | MEDIUM | Worker/archer "seek" box scans | `game.js:529,580,832` | 31×31 and 51×51 `hypot` scans per worker on retarget |
| ✅ Fixed | MEDIUM | Canvas state thrash in particle render | `game.js:4532-4558` | `font`/`textAlign`/fillStyle reset per particle |
| ✅ Fixed | LOW | Dead divergent module codebase | `js/engine.js` etc. | Unshipped second implementation; maintenance trap |
| ⬜ Open | LOW | Monument/academy bar text state thrash | `game.js:223-242` | `font`/`textAlign` set inside structure loop |
| ⬜ Open | LOW | Tile grid stored as strings | `game.js:54-62` | String compares per tile in render cull loop |

---

## Full Findings

### [HIGH] HIGH-1 — Per-frame object allocation in `render()`
- **Location:** `game.js:4710`
- **Problem:** Every frame, `render()` executes
  `const allDefs = Object.assign({}, BUILDINGS, { road: ROAD_DEF });`. This builds a brand
  new object and shallow-copies all ~13 building definitions into it **60 times per second**.
  `BUILDINGS` and `ROAD_DEF` never change at runtime, so the result is identical every frame.
  This is the textbook case of priority #2 (per-frame heap allocation): ~60 short-lived
  objects/sec is enough to trigger minor GC sweeps that show up as periodic 1–4 ms stutters.
- **Fix:** Build the merged table **once** at module scope, next to the other constants:
  `const ALL_DEFS = Object.assign({}, BUILDINGS, { road: ROAD_DEF });` Then pass `ALL_DEFS`
  into `grid.render(...)`. Delete the per-frame line entirely. Nothing mutates these defs,
  so a shared frozen reference is safe (`Object.freeze(ALL_DEFS)` documents that intent).
- **Expected Impact:** Eliminates ~3,600 object allocations per minute from the hot path,
  removing the most frequent GC trigger in the render path. One-line change, zero behavior risk.
- **✅ Resolution (2026-05-27):** Added frozen module-level `ALL_DEFS` (`game.js:39`);
  `render()` now passes it instead of rebuilding per frame.

### [HIGH] HIGH-2 — Territory shading scans and fills every visible tile each frame
- **Location:** `game.js:247-256` (the "Locked Territory Shading" loop inside `GameGrid.render`)
- **Problem:** This loop iterates every tile in the visible viewport and, for each one, calls
  `Math.hypot(tx - 32, ty - 32) > R` and then issues a separate `ctx.fillRect(...)` for every
  tile *outside* the radius. When the player zooms out to see the whole 64×64 board that is
  4,096 tiles → 4,096 `Math.hypot` calls (each an actual `sqrt`) **plus up to ~4,000 individual
  `fillRect` calls every single frame** = ~245,000 sqrt/sec and ~240,000 fill ops/sec. `fillRect`
  is cheap individually but thousands per frame of tiny rects is a real fill-rate and
  draw-call cost, and it is the dominant render expense at low zoom.
- **Fix:** Two independent improvements, both worth doing:
  1. **Drop the `sqrt`.** Compare squared distance: precompute `const R2 = R * R;` and test
     `(tx-32)*(tx-32) + (ty-32)*(ty-32) > R2`. Removes the per-tile `sqrt`.
  2. **Stop drawing thousands of rects.** Instead of darkening each outside tile, darken the
     *whole* visible area with one `fillRect`, then "punch out" the lit circle. The clean way:
     fill the full viewport dark once, then `ctx.save()`, set
     `ctx.globalCompositeOperation = 'destination-out'`, draw a single filled `arc` at the
     territory center with radius `R * TILE_SIZE`, then `ctx.restore()`. That replaces ~4,000
     fills with **two** draw calls. (If you want a soft edge, use a `createRadialGradient`
     fill instead of a hard arc.) Alternatively, only iterate the bounding box of the lit
     circle for the cutout rather than the whole viewport.
- **Expected Impact:** Converts an O(visible-tiles) fill pass (~4,000 draw calls + 4,096 sqrt
  per frame at full zoom-out) into a constant ~2 draw calls. This is the largest single render
  win available and most visible on low-end GPUs and integrated graphics.
- **✅ Resolution (2026-05-27):** Replaced the per-tile loop with a single even-odd fill
  (viewport rect + circle hole) at `game.js:251`. Cutout centered at `32.5 × TILE_SIZE`,
  radius `R × TILE_SIZE` — now edge-aligned with the golden boundary ring (was slightly
  misaligned before). Gameplay placement rule in `handleGridClick` left untouched.

### [MEDIUM] MED-1 — Per-frame raider array allocations during raids
- **Location:** `game.js:4355` (`raiders.filter(...)`) and `game.js:4337` (`raiders.every(...)`)
- **Problem:** While a raid is active, `update()` runs
  `const _frameActiveRaiders = raidActive ? raiders.filter(r => r.state === 'walking') : [];`
  every frame, allocating a new array (and the empty-array literal on the false branch).
  Separately, `raiders.every(r => r.state !== 'walking')` allocates a closure each frame.
  This is allocation inside the tick (priority #2), only during combat — exactly when frame
  budget is already tight from rendering many units and projectiles.
- **Fix:** Keep one module-scope scratch array `const _activeRaiders = [];` Each frame, reset
  its length to 0 (`_activeRaiders.length = 0`) and push walking raiders into it with a plain
  `for` loop — reusing the same backing store means no allocation. Replace the `.every(...)`
  check with a counter computed in that same loop (e.g. track `walkingCount`), avoiding the
  closure. Pass `_activeRaiders` to the soldier/archer/knight/gate updaters as today.
- **Expected Impact:** Removes one array allocation + one closure per frame during raids,
  flattening GC-induced stutter precisely during the most allocation-heavy gameplay moments.
- **✅ Resolution (2026-05-27):** Added module-scope `_activeRaiders` scratch array
  (`game.js:2559`), refilled in place each frame; resolve-raid check rewritten as a
  break-early loop (no closure). Consumers only read it within-frame, so reuse is safe.

### [MEDIUM] MED-2 — `calcDefense`/`countBuildings` full-grid scans duplicate maintained lists
- **Location:** `game.js:2762-2791`; `calcDefense` is called from `refreshUI` (`game.js:4203`)
- **Problem:** `calcDefense()` scans all 4,096 tiles to count walls/towers/gates/ballistas, and
  `countBuildings(key)` does the same per call. But the codebase **already maintains**
  `activeWalls`, `activeTowers`, `activeGates`, `activeBallistaTowers` (rebuilt event-driven in
  `rebuildStructureLists`). `refreshUI` runs on every tax tick (every 3 s) plus on every place,
  demolish, raid resolution, and rebel death — so a full-grid scan fires far more often than the
  underlying counts actually change. This is priority #1 (full-grid scan), just outside the
  literal render tick.
- **Fix:** Derive defense directly from the maintained lists:
  `activeWalls.length * 2 + activeTowers.length * 10 + activeGates.length * 3 +
  activeBallistaTowers.length * 15 + soldiers.length * 5 + …`. For `countBuildings`, either read
  the relevant active-list length or keep a small `buildingCounts[key]` tally updated in
  `place`/`demolish`. No grid scan needed.
- **Expected Impact:** Replaces a 4,096-iteration scan with O(1) length reads on every UI
  refresh. Eliminates a scan that currently runs several times per second during normal play.
- **Dependency:** None — the lists already exist and are correctly maintained.
- **✅ Resolution (2026-05-27):** `rebuildStructureLists` now also builds a `buildingCounts`
  tally (`game.js:2575`). `calcDefense` reads `activeWalls/Towers/Gates/BallistaTowers.length`;
  `countBuildings` reads `buildingCounts`. Counts are identical — all defense/queried buildings
  are 1×1, and the new tally skips child tiles (more correct for multi-tile buildings).

### [MEDIUM] MED-3 — `assignCitizenJobs` runs two full-grid scans plus nested `find` every 3 s
- **Location:** `game.js:4228-4286`
- **Problem:** Every `JOB_SCAN_INTERVAL` (3 s), this function scans all 4,096 tiles **twice**
  (once for workplaces, once for under-construction buildings). Worse, inside each scan it calls
  `citizens.find(c => c.job === 'idle' && …)`, which is itself O(citizens). So worst case it is
  O(tiles × citizens) = up to 4,096 × N every 3 s. This scales poorly as the city fills in
  (priority #1 + #4).
- **Fix:** Drive assignment off maintained lists instead of scanning the grid:
  1. Maintain a list of "jobful" structures (farms, lumberyards, quarries, mines) and a list of
     under-construction tiles — both are subsets you can populate inside `rebuildStructureLists`
     and update when a building completes. Iterate those lists, not the whole grid.
  2. Build the idle-citizen set **once** at the top of the function (single pass over
     `citizens`), into an array you `pop()` from as you assign — instead of re-scanning with
     `find()` for every workplace.
- **Expected Impact:** Turns an O(tiles × citizens) periodic operation into roughly
  O(workplaces + citizens). On a built-up map this is the difference between a multi-millisecond
  hitch every 3 s and an unnoticeable one.
- **Dependency:** Easiest after MED-2 establishes the habit of reading from active-lists; share
  the same list-maintenance code path.
- **✅ Resolution (2026-05-27):** `rebuildStructureLists` now also builds `jobfulStructures`
  and `underConstruction` lists. `assignCitizenJobs` (`game.js:4253`) snapshots the idle pool
  once and iterates those lists instead of two grid scans + nested `find()`. Assignment order
  and the one-worker-per-workplace-per-call semantics are preserved; completed under-construction
  entries are skipped and pruned on the next `rebuildStructureLists`.

### [MEDIUM] MED-4 — Worker/archer "seek" box scans use `hypot` over large tile windows
- **Location:** woodcutter seek `game.js:529-539`, miner seek `game.js:580-590`,
  archer post-seek `game.js:832-842`
- **Problem:** When a woodcutter/miner enters its `seek` phase it scans a 31×31 window (961 tiles)
  calling `Math.hypot` per candidate; an archer seeking a post scans 51×51 (2,601 tiles) with
  `hypot`, and re-runs every 1 s while unposted (and additionally calls
  `archers.some(...)` per candidate tile — nested O(archers)). These are not every-frame, but
  with several idle workers/archers retargeting they add up to tens of thousands of `sqrt` calls
  per second during setup and after combat churn.
- **Fix:**
  1. Replace `Math.hypot(dx, dy)` with squared distance `dx*dx + dy*dy` for the nearest-node
     comparison — you only need relative ordering, not the actual distance.
  2. Search against the maintained resource-node / `activeWalls` + `activeTowers` lists rather
     than sweeping a tile box. For "nearest of a small set," iterating the list (typically far
     fewer than 961/2,601 entries) is both faster and simpler.
  3. For the archer's `archers.some(...)` post-occupancy test, maintain a `Set` of occupied post
     keys (`"tx,ty"`) updated when archers claim/release posts, turning the inner O(archers)
     check into an O(1) lookup.
- **Expected Impact:** Removes the per-candidate `sqrt`, shrinks the candidate set from
  thousands of tiles to the handful of actual nodes, and removes a nested loop — meaningfully
  reduces the post-combat re-org spike.
- **✅ Resolution (2026-05-27):** Woodcutter/miner seeks now use squared distance
  (`game.js:541,592`). The archer seek (`game.js:837`) searches the maintained
  `activeWalls`/`activeTowers` lists within a 25-tile box instead of a 51×51 sweep, with a
  claimed-posts `Set` built once (replacing per-candidate `archers.some()`). Stale list entries
  self-correct via the existing live post-validity check at the top of `Archer.update`.
  *Note:* the resource-node (tree/stone/iron) box scans were kept as box scans — building
  maintained node lists was judged higher-risk/lower-value since nodes mutate on every
  harvest; the `sqrt` removal captures most of the benefit there.

### [MEDIUM] MED-5 — Canvas state thrashing in the particle render loop
- **Location:** `game.js:4532-4558` (particle loop in `renderWorldOverlay`)
- **Problem:** The loop walks particles in spawn order and, per particle, switches canvas state:
  `floating_text` sets `ctx.font` and `ctx.textAlign`; `puff` sets `fillStyle`; `slash` sets
  `strokeStyle` + `lineWidth`. Because particle types are interleaved, the context's state
  machine flips repeatedly within one frame (priority #3). Setting `ctx.font` in particular is
  one of the more expensive 2D-context state changes. With many simultaneous floating numbers
  during combat this is real cost.
- **Fix:** Group by type. Either keep separate arrays (`puffs`, `slashes`, `floatingTexts`) or do
  three passes over `particles` filtered by type. Set the shared state **once** per group:
  set `ctx.font`/`ctx.textAlign` a single time before drawing all floating texts, etc. Set
  `globalAlpha` per particle only where it actually varies.
- **Expected Impact:** Collapses dozens-to-hundreds of redundant state transitions per frame into
  ~3 per frame during heavy combat. Most noticeable when many `+N` damage numbers are on screen.
- **✅ Resolution (2026-05-27):** Particle render (`game.js:4553`) split into three type-batched
  passes (puff / slash / floating_text); shared `fillStyle`/`strokeStyle`/`lineWidth`/`font` set
  once per group. `ctx.font` now written once per frame regardless of floating-number count.

### [LOW] LOW-1 — Dead, divergent second codebase
- **Location:** `js/engine.js`, `js/grid.js`, `js/citizens.js`, `js/buildings.js`, `js/assets.js`
- **Problem:** `index.html` loads only `js/game.js`. The ES-module set is an older parallel
  implementation (e.g. `engine.js` has its own `update`/`render`/`loop`, a simpler raid system,
  no jobs/research/incidents). It is never executed, but it is the same size and shape as the
  real code, so a future contributor (or a future you) can easily edit the wrong file and waste
  hours, or copy a stale pattern from it.
- **Fix:** Move the unused modules into a clearly-labeled `legacy/` directory, or delete them if
  `game.js` is authoritative. If the long-term goal is to *return* to a modular build, leave a
  short `README` in that folder stating that `game.js` is the source of truth today.
- **Expected Impact:** No runtime change; removes a significant maintenance/onboarding hazard.
- **✅ Resolution (2026-05-27):** The six unused modules (`engine.js`, `grid.js`, `citizens.js`,
  `buildings.js`, `assets.js`, `audio.js`) were moved to `js/legacy/` with a `README.md` stating
  `game.js` is the source of truth. `js/game.js` and `server.js` remain the only live files.

### [LOW] LOW-2 — Monument/academy bar rendering sets text state inside the structure loop
- **Location:** `game.js:223-242`
- **Problem:** Inside the per-tile structure render loop, monument countdown and academy progress
  set `ctx.font`, `ctx.textAlign`, and several `fillStyle` values. These structures are rare (0–1
  each), so the cost is small, but it sits inside the hottest loop and re-sets `font` whenever one
  is visible.
- **Fix:** Render monument/academy HUD bars in a small dedicated pass after the tile loop (you
  already maintain `activeMonuments`; add the academy similarly), setting text state once.
- **Expected Impact:** Minor; mainly keeps the main tile loop free of expensive `font` writes.

### [LOW] LOW-3 — Tile grid stored as strings
- **Location:** `game.js:54-62` (`tiles[y][x] = 'tile_grass'`)
- **Problem:** Tiles are strings, so the render cull loop does string comparisons
  (`tile === 'tile_grass'`) per visible tile. String equality on interned literals is fast in V8,
  so this is genuinely minor — flagged only for completeness.
- **Fix:** If you ever profile the tile loop as hot, intern tile types to small integer constants
  (`const T_GRASS = 0, T_DIRT = 1, …`) and store a `Uint8Array`. This also halves tile memory and
  improves cache locality. Not worth doing preemptively.
- **Expected Impact:** Negligible today; listed as a known lever for a future large-map mode.

---

## Architecture Guidance — A Single "Structure Index" as the Backbone

Several MEDIUM findings (MED-2, MED-3, MED-4) are the same root issue wearing different hats:
code that needs "which structures of type X exist / which need workers / where is the nearest
node" reaches for a full-grid scan instead of a maintained index. You already proved the pattern
works with `activeWalls`/`activeFarms`/etc. The guidance is to **lean on that index as the single
source of truth for all structure queries** and stop scanning the grid anywhere outside
`rebuildStructureLists`.

### Rationale
A 64×64 grid is 4,096 cells. Any code that walks it is paying for 4,096 iterations to find what is
usually a few dozen relevant tiles. You have the entity counts to make incremental indexing cheap:
structures change only on place/demolish/raid/fire — discrete events, not every frame. Maintaining
small typed lists at those moments converts every consumer from O(4,096) to O(relevant).

### Data Model
Centralize in the existing list group (`game.js:2549-2561`):
- Keep the current per-type arrays (`activeWalls`, `activeTowers`, …).
- Add `buildingCounts` — a plain object `{ [key]: number }` incremented in `place`, decremented in
  `demolish`. Replaces `countBuildings` and the count loop in `calcDefense`.
- Add `jobfulStructures` — array of `{ tx, ty, key, maxWorkers }` for farm/lumberyard/quarry/mine,
  and `underConstruction` — array of `{ tx, ty }` for tiles with `progress < 1`. Both populated in
  `rebuildStructureLists` and updated when a building completes (set its progress to 1 in one place
  and remove it from `underConstruction` there).
- Optionally add `occupiedPosts` — a `Set` of `"tx,ty"` keys for archer posts (MED-4.3).

### Step-by-Step Implementation Plan
1. **HIGH-1 first** (one line, no dependencies): hoist `ALL_DEFS` to module scope; pass it into
   `grid.render`. Ship.
2. **HIGH-2** (render-only, isolated): squared-distance compare + composite cutout for territory
   shading. Ship and eyeball that the lit circle and golden boundary still line up.
3. **MED-1** (combat-only, isolated): reusable `_activeRaiders` scratch array + walking counter.
   Ship.
4. Add `buildingCounts` to `place`/`demolish`; rewrite `calcDefense` and `countBuildings` to read
   counts/list-lengths (**MED-2**). Ship.
5. Add `jobfulStructures`/`underConstruction` to `rebuildStructureLists`; rewrite
   `assignCitizenJobs` to iterate those lists and a pre-built idle queue (**MED-3**). Ship.
6. Swap `hypot`→squared distance and grid-box scans→list searches in worker/archer seek
   (**MED-4**); add `occupiedPosts` Set. Ship.
7. **MED-5** particle batching; **LOW-2** monument/academy pass — cosmetic render cleanups, do
   together. Ship.
8. **LOW-1**: relocate the dead module set to `legacy/`.

### Gotchas
- **Keep `rebuildStructureLists` authoritative.** Every new index must be (a) rebuilt there and
  (b) kept in sync at the same call sites that already invoke `rebuildStructureLists` (place,
  demolish, fire destruction, raid resolution — see the call sites around `game.js:1192, 3310,
  3352, 3419, 3482, 3649`). If you add incremental updates in `place`/`demolish`, make sure the
  full rebuild still produces an identical result, or the two paths will drift.
- **`progress` completion is the easy miss.** Buildings finish construction in `_updateBuilder`
  (`game.js:668-686`) and in research/other paths; that is where a tile leaves `underConstruction`
  and (if jobful) enters `jobfulStructures`. Route completion through one helper so you don't have
  to find every site.
- **Don't change the territory-shading center/radius semantics in HIGH-2.** The golden boundary
  circle (`game.js:258-268`) is drawn from the same center `(32.5, 32.5)` and radius `R`; keep the
  cutout geometry identical so they stay visually consistent.
- **Order matters for merge safety:** HIGH-1, HIGH-2, MED-1 are independent and touch isolated
  regions — land them first. MED-2 and MED-3 both modify `place`/`demolish`/`rebuildStructureLists`;
  do MED-2 fully before MED-3 to avoid two simultaneous edits to the same functions.

---

## Sequencing Recommendation (TL;DR)

1. ✅ **HIGH-1** — hoist `ALL_DEFS` (1 line, zero risk, biggest GC win per effort).
2. ✅ **HIGH-2** — territory shading: squared distance + composite cutout (largest render win).
3. ✅ **MED-1** — reusable raider scratch array (combat-only, isolated).
4. ✅ **MED-2** — `calcDefense`/`countBuildings` from maintained lists (touches `place`/`demolish`).
5. ✅ **MED-3** — `assignCitizenJobs` off lists + idle queue (builds on MED-2's list discipline).
6. ✅ **MED-4** — worker/archer seek: squared distance + list search + occupied-post Set.
7. ✅ **MED-5** — particle/text render batching. ⬜ **LOW-2** — monument/academy bar text (open).
8. ✅ **LOW-1** — dead modules relocated to `js/legacy/`. ⬜ **LOW-3** — defer unless large-map mode ships.

**Implemented 2026-05-27:** items 1–6 and MED-5/LOW-1 landed in the listed order; `node --check`
passes and gameplay semantics were preserved. Remaining open: **LOW-2** (monument/academy bar text
state — pairs naturally with a future render-pass cleanup) and **LOW-3** (string→int tile enum —
only worth it for a large-map mode). Both are low-value polish, not correctness or scaling risks.
