// Pixel Dominion — Tiny Swords Sprite Engine (Work Order G1)
// Animated pixel-art rendering on top of the unchanged 64×64 / TILE_SIZE=32 sim.
// Anything without a Tiny Swords sprite falls back to the old assets/sprites art.

import { sim, TILE_SIZE } from '../core/state.js';

// Frame size, animation rows (row-major: start = row * cols + col) and timing.
// Default fps is 10 (Tiny Swords timing).
function _pawn(src) {
    return {
        src, frameW: 192, frameH: 192,
        anims: {
            idle:       { start: 0,  count: 6, fps: 10, loop: true },
            run:        { start: 6,  count: 6, fps: 10, loop: true },
            build:      { start: 12, count: 6, fps: 10, loop: true },
            chop:       { start: 18, count: 6, fps: 10, loop: true },
            carry_idle: { start: 24, count: 6, fps: 10, loop: true },
            carry_run:  { start: 30, count: 6, fps: 10, loop: true },
        },
        anchor: [96, 128], // feet/shadow centre in frame px
        size: { scale: 1 / 3 },
    };
}

function _warrior(src) {
    return {
        src, frameW: 192, frameH: 192,
        anims: {
            idle:    { start: 0,  count: 6, fps: 10, loop: true },
            run:     { start: 6,  count: 6, fps: 10, loop: true },
            attack:  { start: 12, count: 6, fps: 10, loop: true },
            attack2: { start: 18, count: 6, fps: 10, loop: true },
        },
        anchor: [96, 128],
        size: { scale: 1 / 3 },
    };
}

function _torch(src) {
    return {
        src, frameW: 192, frameH: 192,
        anims: {
            idle:   { start: 0,  count: 7, fps: 10, loop: true },
            run:    { start: 7,  count: 6, fps: 10, loop: true },
            attack: { start: 14, count: 6, fps: 10, loop: true },
        },
        anchor: [96, 128],
        size: { scale: 1 / 3 },
    };
}

// Single-frame building/resource/deco images (frameW/H filled in at load).
function _still(src, size) {
    return { src, frameW: 0, frameH: 0, anims: { idle: { start: 0, count: 1, fps: 10, loop: true } }, size };
}

export const SPRITES = {
    // ---- units ----
    pawn_blue:   _pawn('assets/tinyswords/units/pawn_blue.png'),
    pawn_red:    _pawn('assets/tinyswords/units/pawn_red.png'),
    pawn_purple: _pawn('assets/tinyswords/units/pawn_purple.png'),
    pawn_yellow: _pawn('assets/tinyswords/units/pawn_yellow.png'),
    warrior_blue:   _warrior('assets/tinyswords/units/warrior_blue.png'),
    warrior_yellow: _warrior('assets/tinyswords/units/warrior_yellow.png'),
    warrior_purple: _warrior('assets/tinyswords/units/warrior_purple.png'),
    archer_blue: {
        src: 'assets/tinyswords/units/archer_blue.png', frameW: 192, frameH: 192,
        anims: {
            idle:  { start: 0,  count: 6, fps: 10, loop: true },
            run:   { start: 8,  count: 6, fps: 10, loop: true },
            shoot: { start: 32, count: 8, fps: 10, loop: true }, // row 4, shoot-right
        },
        anchor: [96, 128],
        size: { scale: 1 / 3 },
    },
    torch_red:    _torch('assets/tinyswords/units/torch_red.png'),
    torch_yellow: _torch('assets/tinyswords/units/torch_yellow.png'),
    torch_purple: _torch('assets/tinyswords/units/torch_purple.png'),
    tnt_red: {
        src: 'assets/tinyswords/units/tnt_red.png', frameW: 192, frameH: 192,
        anims: {
            idle:  { start: 0,  count: 6, fps: 10, loop: true },
            run:   { start: 7,  count: 6, fps: 10, loop: true },
            throw: { start: 14, count: 7, fps: 10, loop: true },
        },
        anchor: [96, 128],
        size: { scale: 1 / 3 },
    },
    // ---- effects ----
    fx_fire: {
        src: 'assets/tinyswords/effects/fire.png', frameW: 128, frameH: 128,
        anims: { idle: { start: 0, count: 7, fps: 10, loop: true } },
        anchor: [64, 104], // base centre
        size: { scale: 0.3 },
    },
    fx_explosion: {
        src: 'assets/tinyswords/effects/explosions.png', frameW: 192, frameH: 192,
        anims: { idle: { start: 0, count: 9, fps: 12, loop: false } },
        anchor: [96, 100],
        size: { scale: 0.35 },
    },
    fx_dead: {
        src: 'assets/tinyswords/effects/dead.png', frameW: 128, frameH: 128,
        anims: { idle: { start: 0, count: 14, fps: 14, loop: false } },
        anchor: [64, 90],
        size: { scale: 0.3 },
    },
    fx_arrow: {
        src: 'assets/tinyswords/effects/arrow.png', frameW: 64, frameH: 64,
        anims: { fly: { start: 0, count: 1, fps: 10, loop: true } },
        anchor: [32, 34], // frame 0 = arrow pointing RIGHT
        size: { scale: 0.35 },
    },
    fx_dynamite: {
        src: 'assets/tinyswords/effects/dynamite.png', frameW: 64, frameH: 64,
        anims: { idle: { start: 0, count: 6, fps: 10, loop: true } },
        size: { scale: 0.35 },
    },
    // ---- nature ----
    tree: {
        src: 'assets/tinyswords/resources/tree.png', frameW: 192, frameH: 192,
        anims: { sway: { start: 0, count: 4, fps: 4, loop: true } }, // row 0 idle sway
        size: { fitWidthTiles: 1.35 },
    },
    sheep_idle: {
        src: 'assets/tinyswords/resources/sheep_idle.png', frameW: 128, frameH: 128,
        anims: { idle: { start: 0, count: 8, fps: 6, loop: true } },
        size: { scale: 0.25 },
    },
    sheep_bounce: {
        src: 'assets/tinyswords/resources/sheep_bouncing.png', frameW: 128, frameH: 128,
        anims: { idle: { start: 0, count: 6, fps: 6, loop: true } },
        size: { scale: 0.25 },
    },
    pickup_wood: _still('assets/tinyswords/resources/w_idle.png', { scale: 0.25 }),
    pickup_gold: _still('assets/tinyswords/resources/g_idle.png', { scale: 0.25 }),
    pickup_meat: _still('assets/tinyswords/resources/m_idle.png', { scale: 0.25 }),
    deco_rock_big: _still('assets/tinyswords/deco/06.png', { fitWidthTiles: 0.9 }),
    // ---- buildings (single frame each) ----
    house_blue:  _still('assets/tinyswords/buildings/house_blue.png',  { fitWidthTiles: 1.15 }),
    house_red:   _still('assets/tinyswords/buildings/house_red.png',   { fitWidthTiles: 1.15 }),
    house_yellow: _still('assets/tinyswords/buildings/house_yellow.png', { fitWidthTiles: 1.15 }),
    house_purple: _still('assets/tinyswords/buildings/house_purple.png', { fitWidthTiles: 1.15 }),
    house_construction: _still('assets/tinyswords/buildings/house_construction.png', { fitWidthTiles: 1.15 }),
    house_destroyed: _still('assets/tinyswords/buildings/house_destroyed.png', { fitWidthTiles: 0.95 }),
    tower_blue:   _still('assets/tinyswords/buildings/tower_blue.png',   { fitWidthTiles: 1.15 }),
    tower_purple: _still('assets/tinyswords/buildings/tower_purple.png', { fitWidthTiles: 1.15 }),
    tower_yellow: _still('assets/tinyswords/buildings/tower_yellow.png', { fitWidthTiles: 1.15 }),
    tower_construction: _still('assets/tinyswords/buildings/tower_construction.png', { fitWidthTiles: 1.15 }),
    tower_destroyed: _still('assets/tinyswords/buildings/tower_destroyed.png', { fitWidthTiles: 1.15 }),
    castle_blue: _still('assets/tinyswords/buildings/castle_blue.png', { fitWidthTiles: 2.3 }),
    castle_construction: _still('assets/tinyswords/buildings/castle_construction.png', { fitWidthTiles: 2.3 }),
    castle_destroyed: _still('assets/tinyswords/buildings/castle_destroyed.png', { fitWidthTiles: 2.3 }),
    goblin_house: _still('assets/tinyswords/buildings/goblin_house.png', { fitWidthTiles: 1.3 }),
    goblin_destroyed: _still('assets/tinyswords/buildings/goblin_house_destroyed.png', { fitWidthTiles: 1.3 }),
    goldmine_active: _still('assets/tinyswords/buildings/goldmine_active.png', { fitWidthTiles: 1.3 }),
    goldmine_inactive: _still('assets/tinyswords/buildings/goldmine_inactive.png', { fitWidthTiles: 1.3 }),
    goldmine_destroyed: _still('assets/tinyswords/buildings/goldmine_destroyed.png', { fitWidthTiles: 1.3 }),
    // ---- custom buildings (G2: single-frame PNGs in assets/tinyswords/custom/) ----
    academy: _still('assets/tinyswords/custom/academy.png', { fitWidthTiles: 1.15 }),
    archery_range: _still('assets/tinyswords/custom/archery_range.png', { fitWidthTiles: 1.15 }),
    ballista_tower: _still('assets/tinyswords/custom/ballista_tower.png', { fitWidthTiles: 1.15 }),
    barracks: _still('assets/tinyswords/custom/barracks.png', { fitWidthTiles: 1.15 }),
    farm: _still('assets/tinyswords/custom/farm.png', { fitWidthTiles: 1.2 }),
    granary: _still('assets/tinyswords/custom/granary.png', { fitWidthTiles: 1.15 }),
    lumberyard: _still('assets/tinyswords/custom/lumberyard.png', { fitWidthTiles: 1.15 }),
    market: _still('assets/tinyswords/custom/market.png', { fitWidthTiles: 1.15 }),
    quarry: _still('assets/tinyswords/custom/quarry.png', { fitWidthTiles: 1.25 }),
    tavern: _still('assets/tinyswords/custom/tavern.png', { fitWidthTiles: 1.15 }),
    iron_vein: _still('assets/tinyswords/custom/iron_vein.png', { fitWidthTiles: 0.8 }),
    // ---- custom walls & gates (G2: drawn connected; see ui.js wall pass) ----
    wall_post: _still('assets/tinyswords/custom/wall_post.png', { fitWidthTiles: 0.95 }),
    wall_h: _still('assets/tinyswords/custom/wall_h.png', { fitWidthTiles: 1.0 }),
    wall_v_top: _still('assets/tinyswords/custom/wall_v_top.png', { fitWidthTiles: 0.7 }),
    wall_v_mid: _still('assets/tinyswords/custom/wall_v_mid.png', { fitWidthTiles: 0.7 }),
    wall_v_bottom: _still('assets/tinyswords/custom/wall_v_bottom.png', { fitWidthTiles: 0.7 }),
    gate_closed: _still('assets/tinyswords/custom/gate_closed.png', { fitWidthTiles: 1.0 }),
    gate_open: _still('assets/tinyswords/custom/gate_open.png', { fitWidthTiles: 1.0 }),
    // ---- terrain sheet + deco (painted directly, not via drawSprite) ----
    terrain_flat: { src: 'assets/tinyswords/terrain/tilemap_flat.png', frameW: 64, frameH: 64, anims: {}, size: null },
};

// Game-object → sprite mapping. Custom-building, wall and gate art lives in
// assets/tinyswords/custom/ (G2). Only UI images (ui_logo / ui_event_banner)
// and not-yet-mapped objects fall back to the old assets/sprites art.
// Values may be a sprite key or a function returning one.
export const SPRITE_FOR = {
    citizen: 'pawn_blue',
    rebel: 'pawn_red',
    militia: 'pawn_purple',
    soldier: 'warrior_blue',
    captain: 'warrior_yellow',
    knight: 'warrior_purple',
    archer: 'archer_blue',
    merchant: 'pawn_yellow',
    raider_normal: 'torch_red',
    raider_torch: 'torch_yellow',
    raider_siege: 'tnt_red',
    camp_guard: 'torch_purple',
    tree: 'tree',
    stone_deposit: 'deco_rock_big',
    house: 'house_blue',
    house_t2: 'house_yellow',
    tower: 'tower_blue',
    tower_t2: 'tower_purple',
    monument: 'castle_blue',
    monument_construction: 'castle_construction',
    academy_construction: 'tower_construction',
    academy: 'academy',
    archery_range: 'archery_range',
    ballista_tower: 'ballista_tower',
    barracks: 'barracks',
    farm: 'farm',
    granary: 'granary',
    lumberyard: 'lumberyard',
    market: 'market',
    tavern: 'tavern',
    iron_vein: 'iron_vein',
    wall: 'wall_post',
    wall_h: 'wall_h',
    wall_v_top: 'wall_v_top',
    wall_v_mid: 'wall_v_mid',
    wall_v_bottom: 'wall_v_bottom',
    wall_post: 'wall_post',
    gate: 'gate_closed',
    gate_closed: 'gate_closed',
    gate_open: 'gate_open',
    rubble: 'house_destroyed',
    mine: 'goldmine_active',
    quarry: 'quarry',
    camp: 'goblin_house',
    // build-menu icons (+ train/clear tools)
    icon_train_soldier: 'warrior_blue',
    icon_train_archer: 'archer_blue',
    icon_train_knight: 'warrior_purple',
    icon_train_captain: 'warrior_yellow',
    icon_clear: 'tree',
    icon_clear_rubble: 'house_destroyed',
};

// Build-menu tool key → sprite key for the 28px icon (undefined = old icon).
// Every buildable now has Tiny Swords/custom art; road uses the sand centre
// tile and is painted by drawRoadIcon() instead of drawSpriteIcon().
export const ICON_FOR = {
    house: 'house_blue',
    farm: 'farm',
    granary: 'granary',
    tavern: 'tavern',
    market: 'market',
    academy: 'academy',
    monument: 'castle_blue',
    lumberyard: 'lumberyard',
    quarry: 'quarry',
    mine: 'goldmine_active',
    wall: 'wall_post',
    gate: 'gate_closed',
    tower: 'tower_blue',
    barracks: 'barracks',
    archery_range: 'archery_range',
    ballista_tower: 'ballista_tower',
    clear: 'tree',
    clear_rubble: 'house_destroyed',
    train_soldier: 'warrior_blue',
    train_archer: 'archer_blue',
    train_knight: 'warrior_purple',
    train_captain: 'warrior_yellow',
};

// Loaded records: { img, mips[canvas|img...], cols, anchorX, anchorY, bboxW, worldScale }
const _loaded = {};

export function hasSprite(key) {
    return !!_loaded[key];
}

// Raw loaded image for custom painters (walls/gates) that need drawImage
// control beyond drawSprite (exact tile-span stretches, multi-part stacks).
// Returns null when the sprite hasn't loaded (caller falls back to old art).
export function getSpriteImage(key) {
    const rec = _loaded[key];
    return rec ? rec.img : null;
}

function _loadImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// Alpha bounding box of frame 0 (in source px). Used for auto-anchors and
// fitWidthTiles sizing. Fully transparent → whole frame.
function _frameZeroBBox(img, frameW, frameH) {
    const w = frameW || img.naturalWidth || img.width;
    const h = frameH || img.naturalHeight || img.height;
    try {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, w, h, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (d[(y * w + x) * 4 + 3] > 8) {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
            }
        }
        if (x1 < 0) return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
        return { x0, y0, x1, y1 };
    } catch (_) {
        return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
    }
}

export async function loadSprites() {
    const jobs = Object.entries(SPRITES).map(async ([key, def]) => {
        if (_loaded[key] || !def.src) return;
        const img = await _loadImage(def.src);
        if (!img) return; // missing file → key stays unloaded, caller falls back
        const fw = def.frameW || img.naturalWidth || img.width;
        const fh = def.frameH || img.naturalHeight || img.height;
        if (key === 'terrain_flat' || key.startsWith('deco')) {
            _loaded[key] = { img, mips: [img], cols: 1, anchorX: 0, anchorY: 0, bboxW: fw, worldScale: 1 };
            return;
        }
        // Downscaled MIP copies (1, ½, ¼, ⅛) for clean minification when zoomed out.
        const mips = [img];
        let prev = img;
        let pw = img.naturalWidth || img.width;
        let ph = img.naturalHeight || img.height;
        for (let m = 0; m < 3; m++) {
            const nw = Math.max(1, Math.floor(pw / 2));
            const nh = Math.max(1, Math.floor(ph / 2));
            const c = document.createElement('canvas');
            c.width = nw; c.height = nh;
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = true;
            g.imageSmoothingQuality = 'high';
            g.drawImage(prev, 0, 0, nw, nh);
            mips.push(c);
            prev = c; pw = nw; ph = nh;
        }
        const cols = Math.max(1, Math.round((img.naturalWidth || img.width) / fw));
        const bbox = _frameZeroBBox(img, fw, fh);
        const bboxW = Math.max(1, bbox.x1 - bbox.x0 + 1);
        let anchorX, anchorY;
        if (def.anchor) {
            anchorX = def.anchor[0]; anchorY = def.anchor[1];
        } else {
            anchorX = (bbox.x0 + bbox.x1 + 1) / 2;
            anchorY = bbox.y1 + 1 - 3; // bbox bottom − 3
        }
        let worldScale = 1 / 3;
        if (def.size) {
            if (def.size.scale) worldScale = def.size.scale;
            else if (def.size.fitWidthTiles) worldScale = (def.size.fitWidthTiles * TILE_SIZE) / bboxW;
        }
        _loaded[key] = { img, mips, cols, anchorX, anchorY, bboxW, worldScale };
    });
    await Promise.all(jobs);
    // Deco singles: terrain-adjacent files loaded as full-res paint sources.
    const decoJobs = [];
    for (let i = 1; i <= 18; i++) {
        const n = String(i).padStart(2, '0');
        const key = 'deco_' + n;
        if (_loaded[key]) continue;
        decoJobs.push(_loadImage('assets/tinyswords/deco/' + n + '.png').then(img => {
            if (img) _loaded[key] = { img, mips: [img], cols: 1, anchorX: 0, anchorY: 0, bboxW: img.naturalWidth || 64, worldScale: 1 };
        }));
    }
    await Promise.all(decoJobs);
}

// World-space draw inside the camera transform. Returns false when the sprite
// is not loaded (caller draws the old sprite instead).
export function drawSprite(ctx, key, anim, timeSec, wx, wy, opts = {}) {
    const def = SPRITES[key];
    const rec = _loaded[key];
    if (!def || !rec) return false;
    const fw = def.frameW || rec.img.naturalWidth || rec.img.width;
    const fh = def.frameH || rec.img.naturalHeight || rec.height || rec.img.height;
    const anims = def.anims || {};
    const a = anims[anim] || anims.idle || { start: 0, count: 1, fps: 10, loop: true };
    const count = Math.max(1, a.count || 1);
    let frame;
    if (opts.frame != null) {
        frame = a.start + opts.frame;
    } else if (a.loop === false) {
        frame = a.start + Math.min(count - 1, Math.floor((timeSec || 0) * (a.fps || 10)));
    } else {
        frame = a.start + (Math.floor((timeSec || 0) * (a.fps || 10)) % count);
    }
    const scaleMul = opts.scaleMul || 1;
    const effScale = rec.worldScale * scaleMul; // world px per source px
    const zoom = (sim && sim.camera) ? sim.camera.zoom : 1;
    // Smallest MIP whose factor still covers the on-screen scale.
    const need = effScale * zoom;
    const factors = [1, 0.5, 0.25, 0.125];
    let mi = 0;
    for (let i = factors.length - 1; i >= 0; i--) {
        if (factors[i] >= need) { mi = i; break; }
    }
    const mip = rec.mips[Math.min(mi, rec.mips.length - 1)];
    const mf = factors[Math.min(mi, rec.mips.length - 1)];
    const sx = (frame % rec.cols) * fw * mf;
    const sy = Math.floor(frame / rec.cols) * fh * mf;
    const dw = fw * effScale;
    const dh = fh * effScale;
    const ax = rec.anchorX * effScale;
    const ay = rec.anchorY * effScale;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.translate(wx, wy);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.flipX) ctx.scale(-1, 1);
    // Crisp pixels up close, filtered when shrinking to kill shimmer/jaggies.
    const shrinking = need < 1;
    ctx.imageSmoothingEnabled = shrinking;
    if (shrinking) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mip, sx, sy, fw * mf, fh * mf, -ax, -ay, dw, dh);
    ctx.restore();
    return true;
}

// Road build-menu icon: the sand CENTRE tile (sheet cell col 6, row 1 — the
// (1,1) centre of the sand block), cropped from tilemap_flat.png.
export function drawRoadIcon(canvas) {
    return drawTerrainIcon(canvas, 6, 1);
}

// Crop one 64×64 cell (col,row) of tilemap_flat.png into a small canvas icon.
export function drawTerrainIcon(canvas, col, row) {
    const rec = _loaded.terrain_flat;
    if (!rec || !rec.img || !canvas) return false;
    const g = canvas.getContext('2d');
    if (!g) return false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(rec.img, col * TERRAIN_TILE, row * TERRAIN_TILE, TERRAIN_TILE, TERRAIN_TILE,
        0, 0, canvas.width, canvas.height);
    return true;
}
// Frame-0 icon fitted into a small canvas (build-menu buttons).
export function drawSpriteIcon(canvas, key) {
    const def = SPRITES[key];
    const rec = _loaded[key];
    if (!def || !rec || !canvas) return false;
    const fw = def.frameW || rec.img.naturalWidth || rec.img.width;
    const fh = def.frameH || rec.img.naturalHeight || rec.height || rec.img.height;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const pad = 2;
    const s = Math.min((canvas.width - pad * 2) / fw, (canvas.height - pad * 2) / fh);
    const dw = fw * s, dh = fh * s;
    g.drawImage(rec.img, 0, 0, fw, fh, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    return true;
}

// ---- terrain painting (static canvas, full-res sheet, 64→32 downscale) ----
// tilemap_flat.png: 10×4 tiles of 64. Grass block cols 0–3, sand block cols 5–8.
const TERRAIN_TILE = 64;
function _terrainImg() {
    return _loaded.terrain_flat ? _loaded.terrain_flat.img : null;
}

export function hasTerrain() {
    return !!_loaded.terrain_flat;
}

export function paintTerrainCell(octx, col, row, dx, dy, dw, dh) {
    const img = _terrainImg();
    if (!img) return false;
    octx.drawImage(img, col * TERRAIN_TILE, row * TERRAIN_TILE, TERRAIN_TILE, TERRAIN_TILE, dx, dy, dw, dh);
    return true;
}

// Grass CENTRE tile (1,1) for every grass tile.
export function paintGrass(octx, dx, dy) {
    return paintTerrainCell(octx, 1, 1, dx, dy, TILE_SIZE, TILE_SIZE);
}

// Sand-block road autotile from 4-neighbour road tests.
export function paintRoad(octx, hasN, hasE, hasS, hasW, dx, dy) {
    const h = (!hasW && hasE) ? 0 : (hasW && hasE) ? 1 : (hasW && !hasE) ? 2 : -1;
    const v = (!hasN && hasS) ? 0 : (hasN && hasS) ? 1 : (hasN && !hasS) ? 2 : -1;
    let col, row;
    if (h !== -1 && v !== -1) { col = h; row = v; }
    else if (h === -1 && v !== -1) { col = 3; row = v; }
    else if (v === -1 && h !== -1) { col = h; row = 3; }
    else { col = 3; row = 3; }
    return paintTerrainCell(octx, 5 + col, row, dx, dy, TILE_SIZE, TILE_SIZE);
}

// Deco scatter painted at ~half scale (64→32) onto the static canvas.
export function paintDeco(octx, num, dx, dy) {
    const n = String(num).padStart(2, '0');
    const rec = _loaded['deco_' + n];
    if (!rec) return false;
    const w = rec.img.naturalWidth || 64;
    const h = rec.img.naturalHeight || 64;
    const s = TILE_SIZE / 64; // 64→32 (tall deco like 16/17 keeps aspect)
    const dw = w * s, dh = h * s;
    octx.drawImage(rec.img, dx + (TILE_SIZE - dw) / 2, dy + (TILE_SIZE - dh), dw, dh);
    return true;
}

Object.assign(window, {
    SPRITES, SPRITE_FOR, ICON_FOR,
    loadSprites, hasSprite, getSpriteImage, drawSprite, drawSpriteIcon,
    drawRoadIcon, drawTerrainIcon,
    hasTerrain, paintTerrainCell, paintGrass, paintRoad, paintDeco,
});
