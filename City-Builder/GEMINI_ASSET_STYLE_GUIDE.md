# Pixel Dominion Asset Style Guide

Use this guide for all replacement or newly generated game assets.

## Game Identity

Pixel Dominion is a top-down medieval city-builder with a warm parchment-and-stone fantasy look. The art should feel like 16-bit era pixel art: readable silhouettes, crisp pixels, limited color palettes, and hand-crafted medieval detail.

## Required Format

- File format: PNG-24 with alpha transparency.
- Background: fully transparent unless the asset is a terrain tile.
- No antialiasing, blur, gradients, bloom, or painterly edges.
- Pixel edges must be crisp and aligned to the pixel grid.
- Filenames must match exactly.
- Save all final files into `assets/sprites/`.

## Sizes

- Standard terrain tile: 16 x 16 px.
- Standard building: 16 x 16 px.
- Tall building or tower: 16 x 32 px.
- Monument: 32 x 32 px.
- Units/NPCs: 16 x 16 px.
- Logo: 256 x 80 px.

## Camera And Perspective

- Top-down orthographic.
- Buildings should be mostly roof/top visible.
- Doors and entrances should face downward toward the player.
- Taller structures can use vertical sprite height, but avoid perspective lean.
- Light source is from the top-left.
- Shadows fall down-right, subtle and contained inside the sprite.

## Palette

Use warm, muted medieval tones. Avoid pure white and pure black.

Core colors:

| Role | Hex | Use |
|---|---:|---|
| Parchment | `#f0e6c8` | pale highlights, cloth, UI parchment |
| Aged gold | `#c8a84b` | trim, coin details, ornament |
| Burgundy | `#6b2438` | banners, roofs, faction accents |
| Forest green | `#4a6b2a` | grass, foliage, natural accents |
| Ink shadow | `#1a1008` | outlines, deepest shadows |
| Stone gray | `#8a7b6a` | walls, stone deposits, ruins |
| Clay/mud | `#8b6532` | dirt, quarry earth, wood shadows |
| Iron blue-gray | `#6a7a8a` | metal, ore, weapons |
| Ember orange | `#d4631a` | fire, torches, warning accents |
| Bone stone | `#d8cfb8` | light stone, pale masonry |

Guidelines:

- Use 12 to 16 colors maximum per sprite.
- Use 3 to 4 tones per material: highlight, midtone, shadow, deep shadow.
- Use a 1-pixel dark outline on major silhouettes.
- Keep important details large enough to read at 1x.

## Readability Rules

- Every asset must be readable at native size.
- Test at 1x and 2x scale.
- Prefer strong shapes over tiny decorative noise.
- Do not fill the whole canvas unless the asset is a terrain tile.
- Leave transparent breathing room where needed so buildings do not look cramped.

## Specific Notes

- Stone deposit and iron vein are placed throughout the map before the game begins, so they must look natural and distinct from constructed quarry/mine buildings.
- The stone deposit should read as harvestable raw rock.
- The iron vein should read as raw rock with visible metal/ore streaks.
- Granary and tavern need to read clearly inside the build menu at 28 x 28 display size and on the 16 x 16 map grid.
- The logo should work on a dark, vignetted start screen.
