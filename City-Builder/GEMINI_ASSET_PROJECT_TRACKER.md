# Gemini Asset Production Tracker

This tracker lists the assets to generate or replace for Pixel Dominion. The current folder contains many sprites already, but the assets below are the ones that need attention because they are missing from the documented production set, not wired into the loader, unused, or specifically requested for refresh.

## Priority 1: Gameplay Assets To Produce Or Refresh

| Status | Asset | Filename | Size | Reason | Notes |
|---|---|---|---:|---|---|
| Done | Granary | `building_granary.png` | 16 x 16 | Exists in folder but is not currently loaded by the sprite loader. Needs a production-ready asset and loader wiring later. | Food storage building. Should look like a small medieval grain store or silo with sacks/barrels. |
| Done | Tavern | `building_tavern.png` | 16 x 16 | Exists in folder but is not currently loaded by the sprite loader. Needs a production-ready asset and loader wiring later. | Happiness building. Should read as an inn/tavern with warm light, signboard, and burgundy accent. |
| Done | Stone Deposit | `obstacle_stone.png` | 16 x 16 | Exists and is placed across the map before game start. User requested it be included in the asset batch. | Natural raw stone, not a building. Must differ from quarry. |
| Done | Iron Vein | `obstacle_iron.png` | 16 x 16 | Exists and is placed across the map before game start. User requested it be included in the asset batch. | Natural rock with blue-gray ore streaks. Must differ from mine. |

## Priority 2: Missing From Documentation Or Unused But Present

| Status | Asset | Filename | Size | Reason | Notes |
|---|---|---|---:|---|---|
| Done | Torch Raider | `enemy_torch_raider.png` | 16 x 16 | File exists and code loads it, but it is missing from the main art inventory document. | Raider variant carrying torch/fire cue. |
| Done | Siege Raider | `enemy_siege_raider.png` | 16 x 16 | File exists and code loads it, but it is missing from the main art inventory document. | Heavier raider variant. Larger/darker silhouette. |
| Done | Warehouse | `building_warehouse.png` | 16 x 16 | File exists but no active gameplay building currently appears to use it. | Generate only if planned for future storage gameplay. |
| Done | Game Logo | `ui_logo.png` | 256 x 80 | File exists, but the current start screen does not appear to use it. | Useful if the logo will be wired into the start screen later. |

## Acceptance Checklist

- [x] Every PNG has transparent background where appropriate.
- [x] Every file name matches the tracker exactly.
- [x] Every standard sprite is exactly 16 x 16 px.
- [x] Logo is exactly 256 x 80 px.
- [x] Sprites remain readable at 1x.
- [x] Sprites match the parchment, stone, burgundy, forest, and muted medieval palette.
- [x] No antialiasing, blur, glow, or soft edges.
- [x] Stone deposit and iron vein are visually distinct from quarry and mine buildings.
- [x] Granary and tavern are visually distinct from house, farm, and lumber yard.

## Integration Notes For Developer

Completed integration:

- `building_granary.png` and `building_tavern.png` are now loaded by `js/ui/ui.js`.
- `building_warehouse.png` is loaded by `js/ui/ui.js` for future use.
- `ui_logo.png` is referenced by the start screen.
- `obstacle_stone.png`, `obstacle_iron.png`, `enemy_torch_raider.png`, and `enemy_siege_raider.png` were already loaded by the game.

Remaining optional follow-up:

- Decide whether `building_warehouse.png` should become a real buildable structure or remain an unused future asset.
- Update `ART_ASSETS.md` with torch raider, siege raider, granary, tavern, warehouse, and any final status changes.
