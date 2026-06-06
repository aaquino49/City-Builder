# Prompt For Gemini: Pixel Dominion Sprite Asset Batch

You are creating pixel art assets for a browser game called Pixel Dominion.

Pixel Dominion is a top-down medieval fantasy city-builder. The art direction is warm, muted, 16-bit pixel art: parchment, stone, burgundy banners, forest greens, aged gold, iron blue-gray, and crisp dark outlines. Think readable SNES-era city-builder/RPG assets, not modern vector art.

Use the style guide below and generate the requested PNG assets with exact filenames and exact dimensions.

## Output Requirements

- Output PNG-24 files with alpha transparency.
- No antialiasing.
- No soft shadows, blur, gradients, painterly rendering, or vector-like smoothing.
- Transparent backgrounds for all non-terrain sprites.
- Crisp pixel edges.
- Use a limited palette: 12 to 16 colors per sprite.
- Light source from top-left.
- Save using the exact filenames listed below.

## Style Guide Summary

- Perspective: top-down orthographic.
- Standard sprites: 16 x 16 px.
- Logo: 256 x 80 px.
- Major silhouettes should use a 1-pixel dark outline.
- Materials should use 3 to 4 tones: highlight, midtone, shadow, deep shadow.
- Avoid pure white and pure black. Use warm off-whites and dark browns instead.
- Palette anchors:
  - parchment `#f0e6c8`
  - aged gold `#c8a84b`
  - burgundy `#6b2438`
  - forest green `#4a6b2a`
  - ink shadow `#1a1008`
  - stone gray `#8a7b6a`
  - clay/mud `#8b6532`
  - iron blue-gray `#6a7a8a`
  - ember orange `#d4631a`
  - bone stone `#d8cfb8`

## Assets To Generate

### 1. Granary

Filename: `building_granary.png`

Size: 16 x 16 px

Description:
A small medieval grain storage building. It should clearly read as food storage, not a house. Use a squat wooden structure, grain sacks, barrels, or a small raised silo form. Warm wood browns, parchment sack highlights, and aged gold grain accents. Include a dark doorway or shadowed storage opening facing downward. Keep the silhouette compact and readable at 16 x 16.

### 2. Tavern

Filename: `building_tavern.png`

Size: 16 x 16 px

Description:
A cozy medieval tavern/inn used as a happiness building. It should look more social and lively than a house. Use a warm lit window, a tiny hanging sign, burgundy roof or trim, and wood/stone walls. Door faces downward. It should feel inviting without being too bright or modern.

### 3. Stone Deposit

Filename: `obstacle_stone.png`

Size: 16 x 16 px

Description:
A natural raw stone deposit placed across the map before the game begins. It must look like harvestable rock, not a constructed quarry. Use 2 to 4 clustered boulders with irregular outlines, stone-gray highlights on top-left faces, darker shadow underneath, and small cracks. Keep the bottom-right edge darker. It should sit naturally on grass.

### 4. Iron Vein

Filename: `obstacle_iron.png`

Size: 16 x 16 px

Description:
A natural rock formation with visible iron ore streaks, placed across the map before the game begins. It must be distinct from the stone deposit. Use darker gray-brown rock with blue-gray metallic streaks or flecks in cracks. Add a few small bright iron highlights, but keep it muted and medieval. The silhouette should be slightly sharper and more jagged than the stone deposit.

### 5. Torch Raider

Filename: `enemy_torch_raider.png`

Size: 16 x 16 px

Description:
A hostile raider variant carrying a torch. Dark jagged silhouette, leather/fur clothing, aggressive forward posture, and a small ember-orange torch flame. It must read differently from the standard raider. Use warm fire pixels sparingly so the torch is readable but not oversized.

### 6. Siege Raider

Filename: `enemy_siege_raider.png`

Size: 16 x 16 px

Description:
A heavier raider variant for siege waves. Bulkier silhouette than the standard raider, darker armor/leather, possible small shield, hammer, or ram-like weapon cue. Should feel tougher and slower. Avoid making it too large for the 16 x 16 canvas, but make it visibly heavier than other raiders.

### 7. Warehouse

Filename: `building_warehouse.png`

Size: 16 x 16 px

Description:
A medieval storage warehouse for possible future gameplay. Larger-feeling than a house but still one tile. Use stacked crates, barrels, a wide double door, and dark timber framing. Should be visually distinct from granary: warehouse stores general goods, granary stores food.

### 8. Game Logo

Filename: `ui_logo.png`

Size: 256 x 80 px

Description:
Pixel art title logo reading "PIXEL DOMINION". Use aged gold lettering with dark ink/brown shadow. It should feel carved, manuscript-like, or medieval, not sci-fi. Optional small crown, shield, or banner ornament is allowed. Must work on a dark vignetted start screen. Transparent background.

## Quality Bar

Before finalizing, check:

- Does each 16 x 16 sprite read correctly at native size?
- Are stone deposit and iron vein clearly different?
- Are granary and tavern clearly different from house/farm/lumber yard?
- Are torch raider and siege raider clearly different from the standard raider?
- Are all backgrounds transparent?
- Are all filenames exact?

Return the final PNG files as separate files, not a sprite sheet.
