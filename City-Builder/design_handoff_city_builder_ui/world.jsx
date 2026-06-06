/* World.jsx — reusable pixel-tile world background that visually echoes the
   game's checkered grass/dirt grid. Renders to an offscreen canvas once and
   reuses across artboards. Trees and rocks are drawn as simple pixel motifs. */

const WORLD_PALETTES = {
  // The current jarring high-contrast checker (for comparison)
  classic: {
    base: ['#3f6b2a', '#48782f'],   // alternating grass/dirt
    alt:  ['#5a3f25', '#6b4a2b'],
    speckDark:  ['#2f5a20', '#4a331c'],
    speckLight: ['#56833a', '#7a5a36'],
    checker: true,
    bg: '#3f6b2a',
  },
  // Recommended: single grass tone with soft organic variation, no checker.
  // Dirt only appears where the player carves paths or places buildings.
  meadow: {
    base: ['#5e8a3e', '#658f44'],   // two near-identical grass shades
    alt:  ['#5e8a3e', '#658f44'],   // no dirt baked into ground
    speckDark:  ['#4a7a30', '#3f6a28'],
    speckLight: ['#7aa252', '#88ad60'],
    checker: false,
    bg: '#5e8a3e',
  },
  // Cozy autumn — warmer sage + ochre, matches the parchment HUD
  autumn: {
    base: ['#6e8a48', '#779452'],
    alt:  ['#6e8a48', '#779452'],
    speckDark:  ['#587538', '#4e6a30'],
    speckLight: ['#a8aa58', '#c0a850'],
    checker: false,
    bg: '#6e8a48',
  },
  // Subtle checker: same hue, alternating lightness only (keeps the grid feel
  // without the dirt clash)
  softGrid: {
    base: ['#5e8a3e', '#5e8a3e'],
    alt:  ['#578234', '#578234'],   // same hue, slightly darker
    speckDark:  ['#4a7a30', '#3f6a28'],
    speckLight: ['#7aa252', '#88ad60'],
    checker: true,
    bg: '#5e8a3e',
  },
  // Painted parchment ground — leans even harder into the UI palette
  parchmentGround: {
    base: ['#8a9a52', '#94a258'],
    alt:  ['#8a9a52', '#94a258'],
    speckDark:  ['#6a7a3a', '#5a6a30'],
    speckLight: ['#b8c068', '#c8c878'],
    checker: false,
    bg: '#8a9a52',
  },
};

function PixelWorld({
  width = 800,
  height = 500,
  seed = 1,
  density = 0.18,
  showCursor = null,
  showRadius = null,
  dimEdges = false,
  palette = 'meadow',
  paths = [],     // [[x,y,len,dir]] — dirt paths drawn over grass
  patches = [],   // [[x,y,r]] — dirt patches (building bases, clearings)
}) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const TILE = 40;
    const cols = Math.ceil(width / TILE) + 1;
    const rows = Math.ceil(height / TILE) + 1;
    const P = WORLD_PALETTES[palette] || WORLD_PALETTES.meadow;

    // deterministic pseudo-random
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    // Base ground fill
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const isAlt = P.checker && ((x + y) % 2 === 1);
        const v = rnd();
        const set = isAlt ? P.alt : P.base;
        ctx.fillStyle = set[v < 0.5 ? 0 : 1];
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        // organic speckle texture
        ctx.fillStyle = P.speckDark[v < 0.5 ? 0 : 1];
        for (let i = 0; i < 5; i++) {
          const px = x * TILE + Math.floor(rnd() * (TILE / 4)) * 4;
          const py = y * TILE + Math.floor(rnd() * (TILE / 4)) * 4;
          ctx.fillRect(px, py, 4, 4);
        }
        ctx.fillStyle = P.speckLight[v < 0.5 ? 0 : 1];
        for (let i = 0; i < 3; i++) {
          const px = x * TILE + Math.floor(rnd() * (TILE / 4)) * 4;
          const py = y * TILE + Math.floor(rnd() * (TILE / 4)) * 4;
          ctx.fillRect(px, py, 4, 4);
        }
      }
    }

    // Dirt patches (clearings under buildings, etc) — soft dabs
    patches.forEach(([px, py, r]) => {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          ctx.fillStyle = rnd() < 0.5 ? '#7a5a36' : '#8c6a3a';
          ctx.fillRect((px + dx) * TILE, (py + dy) * TILE, TILE, TILE);
          // speck
          ctx.fillStyle = '#5a4022';
          for (let i = 0; i < 4; i++) {
            const sx = (px + dx) * TILE + Math.floor(rnd() * (TILE / 4)) * 4;
            const sy = (py + dy) * TILE + Math.floor(rnd() * (TILE / 4)) * 4;
            ctx.fillRect(sx, sy, 4, 4);
          }
        }
      }
    });

    // Dirt paths — straight or L-shaped trails
    paths.forEach(([px, py, len, dir]) => {
      for (let i = 0; i < len; i++) {
        const tx = dir === 'h' ? px + i : px;
        const ty = dir === 'v' ? py + i : py;
        ctx.fillStyle = rnd() < 0.5 ? '#8c6a3a' : '#7a5a36';
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        ctx.fillStyle = '#5a4022';
        for (let k = 0; k < 4; k++) {
          const sx = tx * TILE + Math.floor(rnd() * (TILE / 4)) * 4;
          const sy = ty * TILE + Math.floor(rnd() * (TILE / 4)) * 4;
          ctx.fillRect(sx, sy, 4, 4);
        }
      }
    });

    // decorations: trees + rocks (rolled with new seed-stream so density
    // and palette don't shift the tree positions)
    let ds = seed * 7919;
    const drnd = () => { ds = (ds * 9301 + 49297) % 233280; return ds / 233280; };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (drnd() < density) {
          const cx = x * TILE + TILE / 2;
          const cy = y * TILE + TILE / 2;
          const kind = drnd();
          if (kind < 0.65) {
            // tree
            ctx.fillStyle = '#3a2818';
            ctx.fillRect(cx - 2, cy + 6, 4, 8);
            ctx.fillStyle = '#1f4520';
            ctx.fillRect(cx - 10, cy - 2, 20, 8);
            ctx.fillRect(cx - 8, cy - 8, 16, 6);
            ctx.fillRect(cx - 5, cy - 14, 10, 6);
            ctx.fillStyle = '#2a5a2a';
            ctx.fillRect(cx - 8, cy - 2, 4, 4);
            ctx.fillRect(cx + 4, cy - 6, 4, 4);
          } else if (kind < 0.85) {
            // rock
            ctx.fillStyle = '#6a6a6a';
            ctx.fillRect(cx - 6, cy - 2, 14, 8);
            ctx.fillStyle = '#5a5a5a';
            ctx.fillRect(cx - 8, cy + 2, 18, 4);
            ctx.fillStyle = '#8a8a8a';
            ctx.fillRect(cx - 4, cy - 4, 8, 4);
          }
        }
      }
    }

    if (dimEdges) {
      const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // placement cursor (selected tool footprint preview)
    if (showCursor) {
      const { x, y, w = 1, h = 1, radius } = showCursor;
      ctx.fillStyle = 'rgba(255, 240, 200, 0.32)';
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          ctx.fillRect((x + dx) * TILE, (y + dy) * TILE, TILE, TILE);
        }
      }
      if (radius) {
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc((x + w / 2) * TILE, (y + h / 2) * TILE, radius * TILE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = '#f4e6c2';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TILE, y * TILE, w * TILE, h * TILE);
    }
  }, [width, height, seed, density, JSON.stringify(showCursor), dimEdges, palette, JSON.stringify(paths), JSON.stringify(patches)]);

  return <canvas ref={ref} style={{ width: `${width}px`, height: `${height}px`, imageRendering: 'pixelated', display: 'block' }} />;
}

window.PixelWorld = PixelWorld;
window.WORLD_PALETTES = WORLD_PALETTES;
