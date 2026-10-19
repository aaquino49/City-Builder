# Pixel Dominion

A medieval city-builder and defense game that runs in your browser. Found a settlement, grow its economy through the seasons, and hold your walls against raiders. Settlers arrive when there's housing and food, workers turn wood, stone, iron and food into gold and buildings, and every so often a raid tests whether your soldiers, archers and towers are up to the job.

The game is plain HTML, CSS and JavaScript modules. There are no dependencies and no build step.

## Two ways to win

- **Build the Monument.** At 5,000 gold plus 1,250 wood, 800 stone and 300 iron, it's the biggest project in the game.
- **Survive wave 10**, the final raid.

You lose if no citizens remain. After a victory you can keep playing in **endless mode**.

## Features

- **Economy:** houses, farms, lumberyards, quarries, mines, granaries, taverns and a market, with gold from taxes and trade. Seasons matter: winter drains food fast, and droughts and good harvests come and go.
- **Defense:** walls and gates (drag to build a whole line), arrow and ballista towers, barracks and an archery range. Train soldiers, archers and knights, call up militia in an emergency, and plant a rally flag to direct your troops. One captain per city makes nearby soldiers fight harder.
- **Raids and the wider world:** raids arrive at dusk with a visible countdown, and defended raider camps sit out on the map. Diplomacy event chains, a wandering merchant and territory expansion add choices between raids.
- **Progression:** Tier 2 building upgrades, adjacency bonuses, and Academy research such as Ballistic Engineering, Iron Discipline and Trade Guilds.
- **Quality of life:** minimap, scout markers showing where raids will come from, an event log, live income rates, an objectives checklist, save slots with autosave, shareable map seeds, game speed controls, and an end-of-game chronicle of your city's history.
- **Art:** animated pixel sprites in the style of Pixel Frog's Tiny Swords.

## Play

The game uses JavaScript modules, so it has to be served over HTTP rather than opened as a file.

```bash
cd City-Builder
npm start            # Node 20+, serves http://localhost:8000
```

On Windows you can also double-click `City-Builder/start.bat`, or `City-Builder/launch_game.bat`, which uses Python's built-in server on port 8765 and opens your browser.

## Controls

| Action | Input |
|---|---|
| Pick a building | Click it in the build panel, or press 1-9 |
| Demolish | 0 |
| Place a building | Left-click on the map; drag to place a line of walls or roads |
| Cancel / deselect | Esc |
| Pause | Space |
| Game speed | `-` and `=` |
| Jump to incoming raiders (or the nearest raider camp) | F |
| Centre the camera on your town | H or Home |
| Stats overlay | Tab |
| Mute music / sound effects | M / N |

## Developer notes

- Add `?debug` to the URL for an FPS counter and the in-browser smoke tests, which report in the console.
- Add `?qa=1` to run the release-candidate QA harness.
- `npm run check` syntax-checks every module.

## Repository layout

Everything lives in the [`City-Builder/`](City-Builder) folder:

| Path | What |
|---|---|
| `index.html`, `css/` | The page and its styles |
| `js/core/` | Game state, input, pathfinding and utilities |
| `js/entities/`, `js/systems/` | Units, buildings and the simulation systems |
| `js/features/` | Modular features (minimap, market, save slots, objectives, chronicle and more) plugged in through a hook system |
| `js/render/`, `js/ui/` | Sprite rendering and the interface |
| `assets/` | Sprites, Tiny Swords art and self-hosted fonts |
| `server.js` | Zero-dependency static server for local play or hosting |
| `design_handoff_city_builder_ui/` | The UI redesign spec ("Illuminated Parchment") and its mockups |
| `walkthrough.md`, `project_tracker.md`, `qa_report.md` | Milestone log, project tracker and QA findings |
| `scratch/` | One-off scripts used to generate sprites |

## How it was made

Pixel Dominion was built with AI agents working as a small team. Claude acted as product manager, designer and engineer, and Gemini (in Antigravity) handled art and QA. The project went through 30 planned milestones, each logged in `walkthrough.md`, followed by later rounds of features and balance passes driven by automated playtests.

## Credits

- **Art:** [Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords) by Pixel Frog (legacy release, CC0). Sprites in `assets/tinyswords/custom/` were generated for this project in the same style. See [`assets/tinyswords/CREDITS.md`](City-Builder/assets/tinyswords/CREDITS.md).
- **Fonts:** EB Garamond, IM Fell English SC and VT323, under the SIL Open Font License.
