# Pixel Dominion — Art Asset Reference

---

## Style Guide

### Overview
**Pixel Dominion** is a 2D retro-pixel top-down fantasy city builder. The visual style is **16-bit medieval pixel art** — warm, earthy, and slightly gothic — inspired by illuminated manuscripts and parchment-bound tomes. Think SNES-era Civilization or early RPG towns: chunky pixels, strong readable silhouettes, and a hand-crafted feel.

### Perspective
**Top-down orthographic.** The camera looks straight down. Buildings have no perspective lean. Taller structures (towers) are represented by extra vertical height, not by foreshortening. Shadows fall straight down from the base of a structure.

### Pixel Grid
- **Base tile unit:** 16 × 16 px — all terrain and most buildings are designed on this grid.
- **Tall structures:** 16 × 32 px — towers and multi-story buildings get double the vertical space.
- **Monument (2 × 2 tile):** 32 × 32 px — the only structure that spans multiple tiles.
- **Characters / Units:** 16 × 16 px — displayed at true 1:1 on screen (no upscaling applied to characters).
- **Tiles (terrain):** 16 × 16 px — seamlessly tileable, displayed at 2× (32 × 32 on screen).
- **UI elements:** variable — see individual entries.
- All sprites must have **fully transparent backgrounds** (no white or color fill behind the subject).

### Color Palette
The palette is warm and muted — parchment and stone and oxidised metal, with accents of burgundy and forest green. Avoid pure white (#ffffff) and pure black (#000000); use near-tones instead.

| Role           | Hex       | Usage                                           |
|----------------|-----------|-------------------------------------------------|
| Parchment      | `#f0e6c8` | Base/highlight for wood, interiors, sand        |
| Aged Gold      | `#c8a84b` | Trim, torchlight, ornamental details            |
| Wine / Burgundy| `#6b2438` | Rooftops, flags, banners                        |
| Forest Green   | `#4a6b2a` | Foliage, grass highlights                       |
| Ink / Shadow   | `#1a1008` | Outlines, deepest shadows                       |
| Stone Gray     | `#8a7b6a` | Walls, roads, stone buildings                   |
| Clay / Mud     | `#8B6532` | Dirt tiles, earthen paths                       |
| Iron Blue-Gray | `#6a7a8a` | Metal accents, iron ore, weapons                |
| Ember Orange   | `#d4631a` | Fire, torches, warning accents                  |
| Sky Bone       | `#d8cfb8` | Light stone, bone, pale wood                   |

Sprites may use additional colors as needed, but all tones should feel **desaturated and aged** — avoid neon or highly saturated hues.

### Lighting & Shading
- Light source is **top-left** for all sprites.
- Use **3–4 shading tones** per material (highlight → mid → shadow → deep shadow).
- Hard 1-pixel outlines on the darkest edge of every major shape (`#1a1008` or close).
- No anti-aliasing — keep all edges crisp pixel boundaries.

### Character Design
- Characters are **tiny but readable** at 16 × 16. Use silhouette to communicate role:
  - Citizen: plain robes, round head
  - Soldier: helmet, small shield
  - Archer: slightly taller hat, bow visible
  - Knight: bulkier outline, visor
  - Raider: darker, jagged outline, horned helmet
  - Merchant: wide-brimmed hat, satchel
- Faces are optional; a dot or suggestion of eyes is enough.
- 2–3 frames of **idle animation** is desirable but not required for the initial pass.

### Building Design
- Buildings should read clearly as their function at small sizes.
- Rooftops are mostly visible (top-down view). Steep peaks, thatched roofs, and crenellations help differentiate buildings.
- Doors face downward (toward the "camera") for max readability.
- Use consistent roof materials within categories: civic = thatched/red tile, military = stone/grey, industry = dark wood/slate.

### General Rules
- Limit each sprite to **12–16 unique colors** maximum.
- Keep **1-pixel spacing** between distinct elements within a sprite to prevent visual merging.
- Test readability at both 1× (16 px) and 2× (32 px) sizes.
- All files: **PNG-24 with alpha channel**, `assets/sprites/` directory.

---

## Asset Inventory

### Terrain Tiles

| # | Name | Filename | Description | Size | Status |
|---|------|----------|-------------|------|--------|
| 1 | Grass Tile | `tile_grass.png` | The default ground tile. Lush green turf with subtle variation — a mix of 3–4 green tones, irregular pixel clusters suggesting blades of grass or patches of clover. Should tile seamlessly with itself. No hard border. | 16 × 16 px | Complete |
| 2 | Dirt Tile | `tile_dirt.png` | Exposed earth — clay-brown with sandy tan highlights and small dark pebble pixels. Used under destroyed buildings and around quarries. Slightly warmer and more orange than the stone palette. Tileable. | 16 × 16 px | Complete |
| 3 | Road Tile | `tile_road.png` | Cobblestone or packed earth road. Irregular rounded stones in grey-tan with dark mortar gaps between them. Should connect visually to adjacent road tiles even without explicit connectors. Slightly lighter than the dirt tile. Tileable. | 16 × 16 px | Complete |

---

### Civic Buildings

| # | Name | Filename | Description | Size | Status |
|---|------|----------|-------------|------|--------|
| 4 | House | `building_house.png` | A modest medieval peasant's home. Thatched or red-tile pitched roof visible from above, with a small chimney. Warm wood-brown walls. A tiny door visible at the bottom edge. Cozy and slightly crooked, like a village cottage. | 16 × 16 px | Complete |
| 5 | Farm | `building_farm.png` | A tilled field or farmyard viewed from above. Alternating rows of brown soil and green crop (wheat, cabbage, or generic rows). A tiny scarecrow or fence post detail if space allows. Mostly flat — the "building" is the field itself. | 16 × 16 px | Complete |
| 6 | Lumber Yard | `building_lumberyard.png` | A small timber yard with a wood-plank structure and a stack of brown logs beside it. Dark wood roof (slate-grey or dark brown planks). Sawdust-yellow floor detail. A log pile forms a clear silhouette in one corner. | 16 × 16 px | Complete |
| 7 | Quarry | `building_quarry.png` | An open excavation into stone. Concentric grey-tone rings suggest depth — lighter stone at top, darker toward a central pit. A small crane arm or pile of cut stone blocks at the edge. Conveys digging-into-the-earth. | 16 × 16 px | Complete |
| 8 | Mine | `building_mine.png` | A mineshaft entrance with dark wooden support beams forming an arch at the top edge. Surrounding earth is dark grey-brown. A faint glow or ore fleck (iron-blue) in the darkness of the entrance. Black interior. | 16 × 16 px | Complete |
| 9 | Academy | `building_academy.png` | A scholar's hall or mage tower (single tile). Purple-toned stone with a pointed slate roof. Arched window with a faint glow (aged gold or pale blue). A book or scroll motif on the door. Distinguished from the tower by its ornate roof and warm lit window. | 16 × 16 px | Complete |
| 10 | Monument | `building_monument.png` | A grand victory column or obelisk spanning 2 × 2 tiles. The central structure rises: a tall white-stone obelisk with gold hieroglyph-like markings, set on a wide stone plinth. Subtle shadows radiate outward from the base. Conveys scale and permanence. | 32 × 32 px | Complete |

---

### Military Buildings

| # | Name | Filename | Description | Size | Status |
|---|------|----------|-------------|------|--------|
| 11 | Wall | `building_wall.png` | A single wall segment of mortared stone blocks. Crenellated top (two merlons visible). Stone-gray with darker shadow at the base. Should visually connect to adjacent wall tiles. Simple and blocky — no doors or windows. | 16 × 16 px | Complete |
| 12 | Gate (Open) | `building_gate_open.png` | A fortified archway with an open portcullis. The arch is stone, matching the wall, with iron bars of the raised portcullis visible near the top. The passage through is dark brown/black. A chain or winch detail on one side. | 16 × 16 px | Complete |
| 13 | Gate (Closed) | `building_gate_closed.png` | Same stone arch as the open gate, but the portcullis is fully lowered — iron bars fill the passage opening. The bars should be clearly visible and cast a thin shadow on the floor inside. Conveys locked / sealed. | 16 × 16 px | Complete |
| 14 | Guard Tower | `building_tower.png` | A tall stone watchtower — narrow at the top, wider at the base. Crenellated battlements at the top. A small arrow slit window midway. Darker grey stone than walls, with a banner (wine-red) hanging from one side. Extra height conveys military dominance. | 16 × 32 px | Complete |
| 15 | Barracks | `building_barracks.png` | A low military barracks with a dark grey slate roof and reinforced wooden doors. A weapon rack (swords or spears) visible on one wall. Red/wine trim or banner above the entrance. Slightly more imposing than the house — wider, plainer walls. | 16 × 16 px | Complete |
| 16 | Archery Range | `building_archery_range.png` | An open training ground with a wooden target post and archery butt (straw target) visible at the far end. Dark green turf floor with worn brown patches. A short fence or barrel detail on one side. Conveys active training. | 16 × 16 px | Complete |
| 17 | Ballista Tower | `building_ballistatower.png` | Taller than the regular tower. Stone base like a guard tower but with a siege ballista mounted at the top — visible crossbow arms, a bolt loaded. Dark iron fittings. Wider than the guard tower to communicate its heavy firepower. | 16 × 32 px | Complete |

---

### Destruction

| # | Name | Filename | Description | Size | Status |
|---|------|----------|-------------|------|--------|
| 18 | Rubble | `building_rubble.png` | The remains of a destroyed building. Scattered stone blocks, broken timber beams, and ash-grey debris. Irregular and asymmetric — no recognisable structure. Dust or scorch marks in one corner. Should feel like the aftermath of an attack. | 16 × 16 px | Complete |

---

### Characters & Units

| # | Name | Filename | Description | Size | Status |
|---|------|----------|-------------|------|--------|
| 19 | Citizen | `citizen_sprite.png` | A common villager in simple linen robes (off-white/parchment). Round head, small dot eyes, optional wisp of hair. Neutral stance. Conveys ordinariness — these are the people of your city. Warm skin tone, belt or sash detail. | 16 × 16 px | Complete |
| 20 | Soldier | `citizen_soldier.png` | A footsoldier in iron chainmail or plate. Round visored helmet. A small shield on the left arm, short sword at the hip. Slightly bulkier than the citizen. Steel-grey armor with a wine-red surcoat or tabard for color identity. | 16 × 16 px | Complete |
| 21 | Archer | `citizen_archer.png` | A ranger or archer unit. Leather jerkin (brown), a wide-brimmed or pointed hat. A short bow visible over one shoulder or held at the side. Teal or forest-green accent color to distinguish from the soldier at a glance. Slimmer silhouette than the soldier. | 16 × 16 px | Complete |
| 22 | Knight | `citizen_knight.png` | A heavy cavalry unit on foot (or mounted sprite). Full plate armor with a plume on the helmet. Larger and more imposing than the soldier — gold or brass trim on the armor. A two-handed sword or lance. Conveys elite status through size and ornament. | 16 × 16 px | Complete |
| 23 | Enemy Raider | `enemy_raider.png` | A barbarian raider. Dark, jagged silhouette — horned or spiked helmet, torn furs over leather. Warm red eyes or face paint. Wields an axe. Distinct from all friendly units through darker overall tone and more aggressive posture (leaning forward). | 16 × 16 px | Complete |
| 24 | Merchant NPC | `npc_merchant.png` | A wandering trader. Wide-brimmed hat, a large satchel or pack on their back. Friendly, rounded silhouette. Warm brown or tan clothing. A coin pouch or small chest detail. Conveyed as non-threatening and prosperous — different from both citizens and enemies. | 16 × 16 px | Complete |

---

### Obstacles & Resources

| # | Name | Filename | Description | Size | Status |
|---|------|----------|-------------|------|--------|
| 25 | Tree | `obstacle_tree.png` | A deciduous tree viewed from above. A circular canopy of 3–4 layered green tones over a thin dark trunk stub. The canopy has a slight highlight in the center-left (light source) and darker shadow at the bottom-right. Conveys density and natural growth. | 16 × 16 px | Complete |
| 26 | Stone Deposit | `obstacle_stone.png` | An outcropping of raw grey stone. 2–3 chunky boulder shapes clustered together, lighter highlights on top faces, dark shadows underneath. Neutral grey-stone tones. Looks like it belongs in the natural terrain before it's mined. | 16 × 16 px | Complete |
| 27 | Iron Vein | `obstacle_iron.png` | A rock formation with visible iron ore striations. Primarily grey-brown stone with streaks or flecks of blue-grey iron visible in the cracks. Slightly darker and more jagged than the stone deposit. A metallic sheen suggestion (brighter highlight pixels) on the ore. | 16 × 16 px | Complete |

---

### Effects

| # | Name | Filename | Description | Size | Status |
|---|------|----------|-------------|------|--------|
| 28 | Fire | `effect_fire.png` | A flame overlay applied to burning buildings. A flickering fire shape — yellow at the base fading to orange and ember-red at the tips. Semi-transparent or with alpha gradient on the edges. Should be recognisable as fire even at 16 × 16. | 16 × 16 px | Complete |
| 29 | Drought | `effect_drought.png` | A cracked-earth or wilting overlay indicating drought stress. Dry, cracked brown ground texture — a network of thin dark lines on a pale sand/clay background. Alternatively: a wilting crop or drooping leaf motif. Should convey withering and dryness at a glance. | 16 × 16 px | Complete |

---

### UI & Branding

| # | Name | Filename | Description | Size | Status |
|---|------|----------|-------------|------|--------|
| 30 | Game Logo | `ui_logo.png` | The **PIXEL DOMINION** title treatment for the start screen. Large, hand-crafted pixel lettering in aged gold (`#c8a84b`) with an ink shadow offset. Can include a small shield or crown glyph above or beside the text. The letterforms should feel inscribed or carved — not a clean digital font. Designed to sit over the dark start-screen vignette. | 256 × 80 px | Complete |
| 31 | Event Banner | `ui_event_banner.png` | A decorative scroll or parchment banner used as the background for in-game event notifications. Rolled-scroll edges at left and right, parchment-tan center field, aged wine-red or gold border detail. Semi-transparent or with alpha cutout at the ends so it composites cleanly over the game canvas. | 320 × 48 px | Complete |

---

## Summary

| Category | Total | Complete | Complete |
|----------|-------|-------------|---------|
| Terrain Tiles | 3 | 0 | 3 |
| Civic Buildings | 7 | 0 | 7 |
| Military Buildings | 7 | 0 | 7 |
| Destruction | 1 | 0 | 1 |
| Characters & Units | 6 | 0 | 6 |
| Obstacles & Resources | 3 | 0 | 3 |
| Effects | 2 | 0 | 2 |
| UI & Branding | 2 | 0 | 2 |
| **Total** | **31** | **0** | **31** |

---

*All sprites must be saved as PNG-24 with alpha transparency. Place all files in `City-Builder/assets/sprites/`. Filenames are case-sensitive and must match exactly as listed — they are referenced directly by the game engine.*
