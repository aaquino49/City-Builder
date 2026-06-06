# QA Audit & Refactoring Report — Pixel Dominion

## 1. Performance Optimizations & Bottlenecks Resolved

### A. Eliminated Per-Frame 4096-Tile Grid Scans
- **Problem**: `updateGates()`, `updateRaiders()` (twice for tower/ballista tower checks), and the rendering overlay for `droughtActive` iterated through the entire $64 \times 64 = 4096$ grid every single frame. This generated over 730,000 iterations per second for empty space.
- **Solution**:
  - Implemented tracked arrays for active structures: `activeTowers`, `activeBallistaTowers`, `activeGates`, and `activeFarms`.
  - Added a `rebuildStructureLists()` helper that scans the grid and builds these arrays. It is called on startup (`init`), loading (`loadGame`), placing structures, demolishing buildings, and when buildings collapse due to fire, gate breach, or raids.
  - Refactored `updateGates()`, `updateRaiders()`, and the drought rendering loop to iterate directly over the relevant active arrays. For example, if there are only 2 gates, it loops 2 times per frame instead of 4096 times.

### B. Optimized Citizen Job Assignment Loop
- **Problem**: `assignCitizenJobs()` runs on a 3-second interval. It previously looped through the 4096-tile grid and invoked `citizens.filter()` and `citizens.some()` inside the loop body, yielding a runtime complexity of $O(\text{grid\_size} \times \text{citizens})$ (around 120,000 operations per tick).
- **Solution**:
  - Pre-computed job count maps and builders' status flags with a single $O(\text{citizens})$ pass over the citizens array.
  - Replaced inner-loop scans with $O(1)$ lookups into the count maps, reducing overall complexity to $O(\text{grid\_size} + \text{citizens})$.

### C. Distance Calculation Optimization (Math.hypot Elimination)
- **Problem**: Performance-critical loops running every frame (e.g. tower/ballista targeting sweeps, gate-opening proximity checks, and defender target acquisition) made extensive use of `Math.hypot()`, which calculates a computationally heavy square root internally.
- **Solution**:
  - Refactored `updateGates()`, `updateRaiders()` (towers and ballista towers), `Soldier.update()`, `Archer.update()`, and `Knight.update()` to use **squared distance comparisons** ($dx^2 + dy^2 \le \text{range}^2$).
  - Bypassed all square root calculations within these loop iterations. For chasing movement where actual distance is needed, `Math.sqrt()` is computed at most once, only after targeting is resolved.

### D. Track and Cache Houses (activeHouses)
- **Problem**: When a raid started, `sendCitizensToHide()` performed a full $64 \times 64 = 4096$ grid scan to locate houses.
- **Solution**:
  - Added `activeHouses = []` tracking cache.
  - Modified `rebuildStructureLists()` to record houses during the initial grid compile.
  - Refactored `sendCitizensToHide()` to immediately pull house structures from the cache and determine closest houses using optimized squared distance checks, completely eliminating both the grid scan and per-citizen `Math.hypot` calls on raid start.

---

## 2. Latent Bugs & Memory Leaks Resolved

### A. Audio Node Accumulation & Memory Leak
- **Problem**: Synthesis functions (`_playTone`, `_scheduleMusicBeat`, `playRaidResultSFX`, `playTrainSFX`, `playExpansionSFX`, `playMerchantSFX`, `playStrikeSFX`, `playFireSFX`, `playDroughtSFX`) created oscillators, gain nodes, and buffer sources dynamically but never disconnected them from the audio graph upon stopping. The audio context accumulated thousands of dead nodes over time, causing memory leaks and audio distortion.
- **Solution**:
  - Added `onended` callbacks to all dynamically generated oscillators, buffer sources, and LFOs.
  - The callbacks invoke `.disconnect()` on the nodes as soon as their playback finishes, allowing them to be garbage collected.

### B. Merchant NPC Serialization Hole
- **Problem**: The save/load system saved the `IncidentManager` active state, but did not serialize the actual `MerchantNPC` object. On load, the merchant NPC would be `null`, causing the incident manager to immediately abort the merchant incident.
- **Solution**:
  - Serialized the `MerchantNPC` coordinates (`x`, `y`), starting coords (`startX`, `startY`), speed, sub-state (`state`), and `_tradeOpened` flag in the save file.
  - Recreated and populated the `MerchantNPC` instance on `loadGame`.

### C. Persistent Particle/Projectile Artifacts on Load
- **Problem**: Aesthetic `projectiles` and `particles` (like floating text, puffs, and slashes) were not cleared when loading a save file, causing transient graphics from the previous game state to persist.
- **Solution**:
  - Cleared `projectiles.length = 0` and `particles.length = 0` during `loadGame`.

---

## 3. Code Cleanups & Redundant Files

- **Dead Code Identification**: The files `js/engine.js`, `js/assets.js`, `js/audio.js`, `js/buildings.js`, `js/citizens.js`, and `js/grid.js` are completely unused. `index.html` loads the monolithic combined single-file script `js/game.js` which doesn't import any modules.
- **Removed Dead Variables**: Removed untracked variables, verified state-independent loops, and consolidated functions.

---

## 4. Milestone 20 Audit: Victory Conditions, Upgrades & High Score Leaderboard

### A. Victory / Defeat Game Loop Validation
- **Monument Victory Flow**: Verified that building the 2x2 Monument (cost: 1000G, 500W, 300S, 100I) starts a 60-second countdown timer. If held intact, it pauses the game, plays a major-chord victory arpeggio (`C4-E4-G4-C5-E5-G5-C6`), and opens the Victory Modal showing final score and stats.
- **Defeat Condition**: Verified that having 0 population for 10 seconds displays a warning and triggers the Defeat Modal with a synthesized minor downward sweep. Verified that the check is guarded by `(raidCount > 0 || raidActive)` to prevent false defeats on the start screen.
- **Score Calculation**: Verified formula: $\text{Days} \times 100 + \text{Raiders} \times 20 + \text{Gold} \times 0.1$ computes and stores scores correctly.

### B. Academy & Research Upgrade Mechanics
- **Academy building**: Cost (200G, 50W, 50S) and size (1x1) correctly verified.
- **Research progress**: Verified that upgrades take 15s, show progress bars, and prevent concurrent research.
- **Reinforced Masonry**: *Bug Fixed*: Fixed an issue in the Gate HP rendering logic where the drawing code used a hardcoded max HP of 250 in the `activeGates` iteration instead of the dynamically upgraded max HP (350). Fixed the calculation to use `getMaxHP('gate')`. Verified wall max HP (+100) and gate max HP (+100) apply dynamically to new and existing structures.
- **Steel Bows**: Verified archer arrow damage increases (+5) from 20 to 25.
- **Heavy Armor**: *Bug Fixed*: Fixed an issue in the Knight constructor where newly trained knights spawned with base HP (150) instead of upgraded HP (200) after heavy armor research. New knights now dynamically spawn with 200 HP if researched.
- **Crop Rotation**: Verified farm food yield (+2) applies to building placements (+12 instead of +10), retroactively updates existing farms, and is correctly handled during demolition or collapse.

### C. Leaderboard & Tech Tree Persistence
- **Leaderboard**: Verified top 5 high scores persist in `localStorage` under key `pixel_dominion_highscores` and display correctly on both start and game-over screens.
- **Save/Load Compatibility**: Verified that unlocked upgrades list, active research timer, raiders defeated count, and active monument victory timers serialize/deserialize cleanly to/from local storage.

---

## 5. Milestone 22, 23 & 24 Audit: Seasons, Raiders Variants, and Day/Night Cycle

### A. Day/Night Cycle & Seasons Logic
- **Season Modifiers**: Verified food yield, wood yield, citizen consumption, speed multipliers, and drought weight modifiers. Modifiers correctly apply dynamically to farm/lumberyard production ticks, citizen walk speeds, food consumption rates, and incident weights.
- **Winter Snow Overlay**: Verified the `_snowParticles` array initialization (80 particles) and the rendering/physics update code. Restoring `ctx.globalAlpha = 1.0` after drawing prevents opacity leakage to subsequent rendering stages.
- **Season Transition Event Banners**: Verified that transitioning between seasons displays the correct event banner titles and descriptions, and that Autumn entry correctly awards a one-time `+20` food bonus.
- **Day/Night Cycle & Gating**: Verified ambient darkness/colored overlay opacity transitions (dawn, day, dusk, night) and the HTML HUD phase indicator glyph update logic. Verified that raids are gated so that they are queued until nightfall if triggered during daytime.

### B. Raider Variants & Targeting Priority
- **Raider Variants**: Verified three distinct raider types (normal, torch, siege) are spawned with correct variant-specific properties.
- **Torch Raider (Fire Spawning)**: Verified that torch raiders target buildings and attempt to ignite them via `_startFireAtTile`. On success, they transition to `retreat` state.
- **Siege Raider (Armor & Target Priority)**: Verified siege raiders have 150 HP (instead of 100) and target walls/gates as priority. They deal increased damage (75 instead of 50) to walls/gates.
- **Scout Phase warning**: Verified the 30-second warning banner phase before actual raider spawning.

### C. Latent Bugs & Serialization Holes Resolved
- **Day/Season Serialization Hole**: *Bug Fixed*: Identified a major state serialization bug where `dayTimer`, `gameState.day`, and `gameState.season` were not serialized in `saveGame()`, resetting loaded games to Day 1 (Spring) and Dawn phase. Fixed by serializing `dayTimer`, `day`, and `season` in `saveGame()`, deserializing them in `loadGame()`, and explicitly calling `updateDaySeason()` to synchronize the HUD elements on load.

---

## 6. Milestone 25, 26, & 27 Audit: Food Economy, Happiness & Tavern, Military Combat Modes

All verification targets for Milestones 25, 26, and 27 have been fully audited, analyzed, and verified against their corresponding specifications.

### A. Milestone 25: Food Economy Rebalance & Granaries
- **Farming Production**: Verified that the base farm yield is set to 3. The seasonal multiplier (1.25x in Spring, 1.0x in Summer/Autumn, 0.75x in Winter) and upgrades correctly scale this yield value.
- **Consumption Systems**: Confirmed that military units (soldiers, archers, knights) consume food at the same rate as citizens. During winter, food drain correctly escalates via a 2.5x seasonal multiplier (`foodDrainMult`).
- **Food Capacity Clamping**: Verified that the base food cap is 200, increasing by +200 for each active granary. The `activeGranaries` list is rebuilt dynamically, and all food-generating actions (farming loop, Autumn season change bonus, and merchant trades) clamp the food reserve to `getFoodCap()` correctly.

### B. Milestone 26: Happiness Economy & The Tavern
- **Happiness composite formula**: Verified the newly expanded `calcHappiness()` returns a composite value based on a base rate of 45, influenced by food levels, winter penalties, active droughts, active fires, overcrowding, garrison heavy flags, and taverns.
- **Grief Penalty**: Confirmed that citizen deaths increment the `_griefPenalty` value by +5 (capped at +15), and it decays passively at `0.25/s`.
- **Tavern Caching & Buffs**: Verified that Taverns are correctly compiled into the `activeTaverns` array. They passively boost happiness by +10 (1 Tavern) or +20 (2+ Taverns).
- **HUD Tooltip**: Verified that hovering the Hearth Joy chip displays a parchment card dynamically populated with active signed happiness factors (such as `+`, `++`, `+++`, `-`, `--`, `---`).
- **State Serialization**: Verified `_griefPenalty` is successfully saved and loaded.

### C. Milestone 27: Military Command — Attack & Defend
- **State Machine Integration**: Verified that click handlers for `🛡 DEFEND` and `⚔ ATTACK` update `_combatMode` and correctly dispatch state transitions to military units.
- **Defend Mode (Default)**: Confirmed that soldiers and knights remain clamped to the territory boundary via `_clampToTerritory(this)`, and archers seek posts on walls and towers.
- **Attack Mode**: Confirmed that `_clampToTerritory` is bypassed during chases, allowing soldiers and knights to target raiders outside the walls. Archers release wall posts and transition to the `'following'` state.
- **Army Centroid Following**: Verified that in the `'following'` state, archers average the locations of all active soldiers and knights, re-computing this target centroid every 1.5 seconds. They walk towards the centroid and fire at the nearest raider within 12 tiles.
- **Centroid Fallback**: Verified that if no soldiers or knights remain alive while in Attack mode, archers safely revert to `seeking_post` behavior, avoiding divide-by-zero or undefined references.
- **Serialization & UI Sync**: Verified that `_combatMode` is preserved in `saveGame()`, deserialized in `loadGame()`, and the UI buttons are synchronized using `updateCombatModeUI()`.

---

## 7. Milestone 28, 29, & 30 Audit: Diplomacy, Tier 2 Upgrades, Adjacency, and Tech Tree Expansion

This is the final full audit of the project, verifying all systems implemented in Milestones 28, 29, and 30.

### A. Milestone 28: Diplomacy & Envoy Events
- **Hard Pause Gating**: Verified that when a diplomacy event triggers via `_startDiplomacy()`, `gameIsPaused` is set to `true`. This pauses all simulation loops.
- **No-Dismiss Modal UI**: Verified that the `#diplomacy-modal` container contains no close button and cannot be dismissed via standard escape key actions. Dismissal is only possible through option selection.
- **Choice Actions & Consequences**:
  - Immediate choices successfully update resources or attributes.
  - Delayed consequences successfully schedule timed tasks via `_diplomacyTimers` (e.g. returning soldiers, scheduling raids).
  - Suppression alliance blocks raids by resetting `raidTimer = RAID_DURATION` if `_allianceTimer > 0`.
  - Recruits multiplier `_soldierCostMult` applies correctly to soldier training cost calculations.
- **Serialization**: Verified `_diplomacyTimers` (by mapping actionKeys), `_allianceTimer`, `_soldierCostMult`, and `_soldierCostTimer` are serialized in `saveGame()` and restored in `loadGame()` with safe fallback defaults.

### B. Milestone 29: Building Upgrades Tier 2 + Adjacency Bonuses + Click Panel
- **Building Panel (Inspector)**: Verified that clicking any grid tile containing a structure parses the tile coordinates (adjusting for parent/child offsets) and opens `#building-panel`. The panel positions itself dynamically relative to the viewport.
- **Tier 2 Upgrades**: Per-instance upgrade flags are stored in `_tier2Upgrades`. Cost deduction, upgrades mapping, and stat boosts are fully integrated.
  - Granary T2 correctly increases capacity contribution to `+350` (instead of base `+200`).
  - Barracks T2 boosts trained soldiers max HP by `+25`.
  - Tower T2 increases range to 10 tiles and bolt damage to 30.
  - Farm, Lumberyard, and Mine T2 add a flat `+2` yield bonus per tick.
- **Adjacency Bonus System**: Passive yields increase based on cardinal neighbors. Counts are correctly queried in `getAdjacencyBonus()`.
  - Farm adjacency yields `+0.5` food per neighbor.
  - Lumberyard adjacency yields `+1.0` wood per forest neighbor.
  - Mine adjacency yields `+1.0` iron per rock/mountain neighbor.
  - Tavern adjacency yields `+3` flat happiness per adjacent house, visible as a signed factor in the Hearth Joy tooltip.
- **Placement Preview**: Hovering placement triggers `getAdjacencyBonus()` and displays live canvas text predictions for bonus gains.
- **Cleanup and Serialization**: Upgrades are successfully removed from `_tier2Upgrades` when buildings collapse or are demolished. The object is serialized and loaded correctly.

### C. Milestone 30: Tech Tree Expansion
- **Academy Upgrade Registration**: Verified the registration of 4 new research cards:
  - `ballistic_engineering`: Bolt damage +15, range +3. Refreshes active ballista parameters immediately on completion.
  - `iron_discipline`: Recruited soldiers receive `+15` max HP. Stacks with Barracks T2 to provide a combined `140` HP.
  - `trade_guilds`: Yields `+2` gold per citizen per tax tick.
  - `field_medicine`: All military units (Soldier, Archer, Knight) heal at double the rate.
- **Tech Tree Locks & Save/Load**: Verified that concurrent research blocking functions correctly and upgrades serialize cleanly to `localStorage`.



