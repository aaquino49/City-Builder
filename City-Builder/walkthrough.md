# Pixel Dominion — Milestone Walkthrough Log

## Milestone 30 — Tech Tree Expansion
**Status**: Complete
**Completed**: 2026-05-29

### What Was Built
- **4 new Academy researches** added to the `RESEARCH` config array, rendered automatically by the existing Academy panel UI (progress bars, concurrency lock, completed state all handled by existing infrastructure).
- **Ballistic Engineering** (200G, 50I): When researched, `rebuildStructureLists()` sets all active ballista tower entries to range 19 tiles (+3) and bolt damage 90 (+15). Called immediately on research completion and on `loadGame()`.
- **Iron Discipline** (150G, 40I): Soldiers trained after research spawn at 115 HP instead of 100. Stacks additively with Barracks Tier 2 upgrade (+25): combined maximum is 140 HP.
- **Trade Guilds** (180G, 20I): Tax tick adds `citizenCount × 2` gold on top of base income. Scales with population — larger cities benefit more.
- **Field Medicine** (150G, 30W): Doubles HP regeneration rate on all military units — Soldier (3→6/s), Archer (2→4/s at post), Knight (3→6/s). Applied at all existing regen call sites.
- **Save/Load**: All 4 upgrade keys stored under the existing `gameState.upgrades` object; no extra serialization needed. `ballistic_engineering` re-applies on load via `rebuildStructureLists()`.

### Verified Scenarios
| Scenario | Result |
|---|---|
| Academy panel open | 4 new entries visible alongside existing 4 |
| Research `iron_discipline` | Soldiers trained afterwards spawn at 115 HP |
| Barracks T2 + `iron_discipline` both active | Soldiers spawn at 140 HP |
| Research `trade_guilds` | Tax tick income increases by citizenCount × 2 |
| Research `ballistic_engineering` | Ballista range +3, damage +15; persists on reload |
| Research `field_medicine` | All military unit regen rates doubled |
| Concurrent research attempt | Blocked; existing research continues |

---

## Milestone 29 — Building Upgrades Tier 2 + Adjacency Bonuses + Click Panel
**Status**: Complete
**Completed**: 2026-05-29

### What Was Built
- **Click Panel** (`<div id="building-panel">`): Floating inspector panel that opens when the player clicks any placed building tile. Shows building name, current stats (yield, HP, workers), an Upgrade button (if eligible and not yet upgraded), and a Demolish button. Closes on outside click. Positioned near the tile, clamped to viewport. Does not pause the game.
- **`openBuildingPanel(tx, ty)`**: Populates and positions the panel from tile coords. Reads `_tier2Upgrades` to determine upgrade eligibility and shows "Already upgraded" state when applicable.
- **`_tier2Upgrades` object**: Per-tile upgrade registry keyed by `'tx,ty'` strings. Tracks which individual building instances have been upgraded to Tier 2. Serialized in `saveGame()` and restored in `loadGame()`. Cleared on demolish and collapse.
- **6 Tier 2 Upgrades**:
  - Farm (80G, 30W): +2 food/tick
  - Lumberyard (80G, 30S): +2 wood/tick
  - Mine (100G, 30W): +2 iron/tick
  - Barracks (150G, 50S): soldier spawn HP 100 → 125
  - Tower (120G, 40S): +2 range, +5 arrow damage
  - Granary (100G, 40W): food cap bonus 200 → 350 for that Granary
- **`getAdjacencyBonus(tx, ty, buildingType)`**: Helper checking 4 cardinal neighbors. Returns bonus yield based on neighbor tile types.
- **Adjacency Bonuses (passive, per production tick)**:
  - Farm near Farms: +0.5 food/tick per neighboring farm (max +2.0)
  - Lumberyard near Forest tiles: +1 wood/tick per forest neighbor (max +4)
  - Mine near Mountain tiles: +1 iron/tick per mountain neighbor (max +4)
  - Tavern near Houses: +3 happiness per house neighbor (integrated into `calcHappiness()` as signed factor)
- **Placement preview**: Hovering a Farm, Lumberyard, Mine, or Tavern placement shows the expected adjacency bonus in the build cursor overlay.

### Verified Scenarios
| Scenario | Result |
|---|---|
| Click empty tile | No panel |
| Click Farm | Panel opens: name, yield, upgrade button (80G 30W) |
| Click already-upgraded Farm | Upgrade button shows "Already upgraded" |
| Farm next to 2 Farms | +1.0 food/tick adjacency bonus |
| Lumberyard adjacent to 3 forest tiles | +3 wood/tick adjacency bonus |
| Tavern next to 4 houses | +12 happiness shown in tooltip |
| Hover Farm placement near Farms | Tooltip shows expected adjacency bonus |
| Save with upgraded buildings, reload | `_tier2Upgrades` fully restored |
| Demolish upgraded building | `_tier2Upgrades` entry removed; food cap recalculates |

---

## Milestone 28 — Diplomacy & Envoy Events
**Status**: Complete
**Completed**: 2026-05-29

### What Was Built
- **`DiplomacyEvent` system**: 15-card diplomacy event pool integrated into `IncidentManager` as a new weighted incident type. Events feel rare and significant.
- **Hard-pause modal** (`<div id="diplomacy-modal">`): Game sets `gameIsPaused = true` before surfacing the card. Modal has no dismiss button — only Option A / Option B resume play. `showDiplomacyModal(event)` populates it dynamically from the event data object.
- **`_DIPLOMACY_ACTION_MAP`**: Keyed consequence functions (`raid`, `raid_strong`, `return_soldiers_5`, `return_soldiers_10`) enabling deferred timer serialization and reconstruction on load.
- **`_diplomacyTimers` array**: `{ remainingSec, actionKey, action }` entries decremented each tick. Supports retaliatory raids, soldier returns, and other delayed outcomes. Serialized as `{ remainingSec, actionKey }` pairs; reconstructed via `_DIPLOMACY_ACTION_MAP` on `loadGame`.
- **`_allianceTimer`**: Set to `SEASON_DURATION` by `rival_alliance` Option A; blocks raid spawning while active. Serialized and restored.
- **`_soldierCostMult` / `_soldierCostTimer`**: `iron_shortage` Option B sets `_soldierCostMult = 1.5` for 3 in-game days. Applied to barracks recruit gold cost. Serialized and restored.
- **Pool guards**: Events requiring resources the player lacks are filtered out before the random draw (e.g. `grain_trade` requires food ≥ 60, `soldier_levy` requires 10+ soldiers).
- **Full 15-event pool**: `grain_trade`, `soldier_levy`, `noble_refuge`, `safe_passage`, `rival_alliance`, `tribute_demand`, `defecting_knight`, `mercenary_company`, `lost_caravan`, `iron_shortage`, `wandering_bard`, `harvest_festival`, `flood_warning`, `royal_decree`, `plague_refugees`.

### Verified Scenarios
| Scenario | Expected |
|---|---|
| Diplomacy fires | Hard-pause; card modal; no dismiss |
| Option A selected | Immediate + delayed consequences; game unpauses |
| Option B selected | Immediate + delayed consequences; game unpauses |
| `grain_trade` Option B | Raid queued after 2 in-game days |
| `rival_alliance` Option A | `_allianceTimer` set; raids blocked 1 season |
| `iron_shortage` Option B | Soldier cost 1.5× for 3 in-game days |
| `soldier_levy` Option A | 10 soldiers removed; re-added after 14 days |
| Event requires resources player lacks | Event absent from pool |
| Save mid-timer → reload | `_diplomacyTimers` restored; consequence fires at correct remaining time |

---

## Milestone 27 — Military Command: Attack & Defend
**Status**: Complete
**Completed**: 2026-05-29

### What Was Built
- **`_combatMode` variable**: Module-level `'defend'` | `'attack'` toggle controlling all military unit behaviour.
- **HUD buttons**: `🛡 DEFEND` and `⚔ ATTACK` buttons in the HUD bar. Active mode highlighted with gold border. `updateCombatModeUI()` syncs state on switch and on load.
- **Defend mode — soldiers/knights**: Existing behaviour preserved. `_clampToTerritory()` keeps units inside the territory radius when chasing raiders.
- **Attack mode — soldiers/knights**: `_clampToTerritory()` guarded by `if (_combatMode !== 'attack')` — units freely pursue raiders outside the territory perimeter.
- **Defend mode — archers**: Existing `seeking_post → moving_to_post → at_post` wall/tower manning state machine unchanged.
- **Attack mode — archers**: Mode-sync guard at top of `Archer.update()` transitions archers to new `'following'` state. Archers compute army centroid (soldiers + knights) every 1.5s, walk toward it, fire at raiders within 12 tiles. Falls back to `seeking_post` if no army exists.
- **Save/load**: `_combatMode` serialized and restored; `updateCombatModeUI()` called on load to sync buttons.

### Verified Scenarios
| Scenario | Result |
|---|---|
| Default start | DEFEND active; archers seek wall posts; soldiers/knights clamp to territory |
| Click ATTACK | ATTACK active; archers follow army centroid; soldiers pursue outside walls |
| Click DEFEND mid-raid | Archers re-enter seeking_post; soldiers snap back to boundary |
| ATTACK, no raiders | Soldiers patrol inside territory; archers follow centroid |
| ATTACK, raiders arrive | Soldiers/knights chase outside perimeter unimpeded |
| No army, ATTACK mode | Archers fall back to wall-post seeking |
| Save ATTACK, reload | Mode and button state correctly restored |

---

## Milestone 26 — Happiness Economy & The Tavern
**Status**: Complete
**Completed**: 2026-05-29

### What Was Built
- **Multi-factor happiness formula**: Replaced single-input `food/population` calculation with a composite score (base 45) influenced by food tier, tavern coverage, season, drought, grief, active fires, overcrowding, and garrison pressure.
- **Grief system**: `_griefPenalty` float (0–15) increments by 5 on violent citizen deaths (raids/fire), decays over ~60s. Does not trigger on emigration.
- **Happiness tooltip**: Hovering `#res-happiness` shows a live parchment-styled card listing only active factors with `+`/`++`/`+++` or `-`/`--`/`---` strength indicators.
- **Tavern building**: New civic building (120g, 40w) providing +10 happiness per Tavern, capped at 2 (+20 max). Passive — no workers required.
- **Save/load**: `_griefPenalty` serialized. `activeTaverns` rebuilt from grid on load.

### Happiness Thresholds (unchanged)
- ≥ 75: Fast citizen spawn (3s)
- ≥ 60: Strikes cannot fire
- ≥ 50: No rebel citizens
- ≥ 40: Full tax income, no emigration

### Verified Scenarios
| Scenario | Result |
|---|---|
| Food surplus, summer, no Tavern | 70 |
| Food surplus, summer, 1 Tavern | 80 |
| Food surplus, summer, 2 Taverns | 90 |
| Food adequate, winter | 55 |
| Food scarce, winter | 35 (emigration) |
| Food scarce, winter, drought | 27 (crisis) |
