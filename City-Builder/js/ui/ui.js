import {
    sim,
    runHook,
} from '../core/state.js';
import {
    SPRITES, SPRITE_FOR, ICON_FOR,
    drawSprite, hasSprite, getSpriteImage, drawSpriteIcon, drawRoadIcon,
    hasTerrain, paintGrass, paintRoad, paintDeco,
} from '../render/sprites.js';

// Pixel Dominion — UI & Renderer Module

// ===================== GAME GRID CLASS =====================
export let _staticCanvas = null;
export let _grassCanvas = null;

// Directional facing via horizontal flip — the safe replacement for the removed
// whole-sprite rotation (which read as characters tipping over). Facing is
// inferred from the unit's current move target and remembered while idle.
function _drawFacingSprite(ctx, asset, u, drawX, drawY, size = 16) {
    if (u.targetX < u.x - 0.5) u._facingLeft = true;
    else if (u.targetX > u.x + 0.5) u._facingLeft = false;
    if (u._facingLeft) {
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.scale(-1, 1);
        ctx.drawImage(asset, -size / 2, -size / 2, size, size);
        ctx.restore();
    } else {
        ctx.drawImage(asset, drawX - size / 2, drawY - size / 2, size, size);
    }
}

export function makeSeededRng(seedString) {
    // cyrb53 string hash → mulberry32 PRNG; returns () => float in [0,1).
    const s = String(seedString || '');
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
        const ch = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    let a = 4294967296 - (2097151 & (h2 >>> 0));
    if (a <= 0) a += 4294967295;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function randomSeedString() {
    // 6 chars from an unambiguous alphabet (no 0/O/1/I).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

// ===================== TINY SWORDS DEPTH-SORTED WORLD PASS =====================
// Every visible drawable goes into one reused array, sorted by ground-y so that
// things lower on screen overlap things behind them (units walk behind towers).
// Entries are recycled via _drawFree — no per-frame allocation of arrays or
// entry objects after warmup. Kind codes (not strings) keep the hot loop lean.
const DK_STRUCT = 0, DK_NATURE = 1, DK_CIT = 2, DK_SOL = 3, DK_ARC = 4,
      DK_KNI = 5, DK_RAID = 6, DK_CAMP = 7, DK_MERCH = 8, DK_SHEEP = 9;
const _drawList = [];
const _drawFree = [];
function _emitDraw(k, y, o, tx, ty) {
    const e = _drawFree.pop() || {};
    e.k = k; e.y = y; e.o = o; e.tx = tx; e.ty = ty;
    _drawList.push(e);
}
function _drawCmp(a, b) { return a.y - b.y; }

function _facingLeft(u) {
    if (u.targetX < u.x - 0.5) u._facingLeft = true;
    else if (u.targetX > u.x + 0.5) u._facingLeft = false;
    return !!u._facingLeft;
}

// True when the unit's base position moved since the last drawn frame (0.05px
// threshold). Citizen idle-sway render offsets are ignored on purpose so that
// fidgeting in place reads as idle rather than running.
function _movedSinceDraw(u, x, y) {
    const lx = u._sprLX, ly = u._sprLY;
    let moved = false;
    if (lx !== undefined && ly !== undefined) {
        const dx = x - lx, dy = y - ly;
        moved = dx * dx + dy * dy > 0.0025;
    }
    u._sprLX = x; u._sprLY = y;
    return moved;
}

function _structSpriteKey(s, tx, ty) {
    const key = s.def.key;
    // Tier-2 re-skins only exist for houses and towers; look the upgrade map up
    // solely for those (avoids per-frame string keys for every structure).
    if (key === 'house') return sim.tier2Upgrades[tx + ',' + ty] ? SPRITE_FOR.house_t2 : SPRITE_FOR.house;
    if (key === 'tower') return sim.tier2Upgrades[tx + ',' + ty] ? SPRITE_FOR.tower_t2 : SPRITE_FOR.tower;
    if (key === 'monument') return (s.progress ?? 1.0) < 1.0 ? SPRITE_FOR.monument_construction : SPRITE_FOR.monument;
    if (key === 'academy') return (s.progress ?? 1.0) < 1.0 ? SPRITE_FOR.academy_construction : SPRITE_FOR.academy;
    if (key === 'rubble') return SPRITE_FOR.rubble;
    if (key === 'mine') return SPRITE_FOR.mine;
    if (key === 'quarry') return SPRITE_FOR.quarry;
    if (key === 'archery_range') return SPRITE_FOR.archery_range;
    if (key === 'ballista_tower') return SPRITE_FOR.ballista_tower;
    if (key === 'barracks') return SPRITE_FOR.barracks;
    if (key === 'farm') return SPRITE_FOR.farm;
    if (key === 'granary') return SPRITE_FOR.granary;
    if (key === 'lumberyard') return SPRITE_FOR.lumberyard;
    if (key === 'market') return SPRITE_FOR.market;
    if (key === 'tavern') return SPRITE_FOR.tavern;
    return null; // no Tiny Swords sprite yet — old sprite at today's size/position
}

// True when this building type offers a tier-2 upgrade AND this tile bought it.
function _isTier2(key, tx, ty) {
    const T2 = window.TIER2_UPGRADES;
    return !!(T2 && T2[key] && sim.tier2Upgrades[tx + ',' + ty]);
}

// Small gold star badge for tier-2 buildings (no separate art). Outlined so it
// reads on any background; drawn in world px so it scales with zoom.
function _drawTier2Star(ctx, x, y, r = 4.5) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#5a3c00';
    ctx.stroke();
    ctx.restore();
}

// Badge at the drawn sprite's top-right. World width comes from the manifest
// fitWidthTiles value; height keeps the source aspect (custom PNGs are cropped
// to their opaque pixels, so the full image ≈ the bbox the scale was built on).
function _drawTier2BadgeFor(ctx, sprKey, tx, ty, w = 1, h = 1) {
    const img = getSpriteImage(sprKey);
    const def = SPRITES[sprKey];
    const fit = def && def.size ? def.size.fitWidthTiles : 0;
    if (!img || !fit) {
        _drawTier2Star(ctx, (tx + w) * TILE_SIZE - 5, ty * TILE_SIZE + 6);
        return;
    }
    const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    const worldW = fit * TILE_SIZE;
    const worldH = worldW * (ih / iw);
    const cx = (tx + w / 2) * TILE_SIZE;
    const by = (ty + h) * TILE_SIZE;
    _drawTier2Star(ctx, cx + worldW / 2 - 3, by - worldH + 4);
}

// ---- connected walls (G2): a wall tile's look depends on its 4 neighbours
// (N/E/S/W) that are walls OR gates. Masks are cached in sim.wallMasks by
// rebuildStructureLists (walls change rarely) rather than computed per frame.
const WALL_N = 1, WALL_E = 2, WALL_S = 4, WALL_W = 8;
function _isWallOrGateAt(tx, ty) {
    if (!sim.grid || !sim.grid.inBounds(tx, ty)) return false;
    let s = sim.grid.structures[ty] ? sim.grid.structures[ty][tx] : null;
    if (!s) return false;
    if (s.isChild) s = sim.grid.structures[s.parentY] ? sim.grid.structures[s.parentY][s.parentX] : null;
    if (!s) return false;
    return s.def.key === 'wall' || s.def.key === 'gate';
}
function _wallMaskLive(tx, ty) {
    let m = 0;
    if (_isWallOrGateAt(tx, ty - 1)) m |= WALL_N;
    if (_isWallOrGateAt(tx + 1, ty)) m |= WALL_E;
    if (_isWallOrGateAt(tx, ty + 1)) m |= WALL_S;
    if (_isWallOrGateAt(tx - 1, ty)) m |= WALL_W;
    return m;
}
function _wallMaskAt(tx, ty) {
    if (sim.wallMasks) {
        const m = sim.wallMasks[tx + ',' + ty];
        if (m !== undefined) return m;
    }
    return _wallMaskLive(tx, ty);
}
function _recomputeWallMasks() {
    // Live neighbour tests (never the old cache — a new wall changes the masks
    // of the walls already standing next to it).
    const masks = {};
    const walls = sim.activeWalls || [];
    const gates = sim.activeGates || [];
    for (let i = 0; i < walls.length; i++) {
        const { tx, ty } = walls[i];
        masks[tx + ',' + ty] = _wallMaskLive(tx, ty);
    }
    for (let i = 0; i < gates.length; i++) {
        const { tx, ty } = gates[i];
        masks[tx + ',' + ty] = _wallMaskLive(tx, ty);
    }
    sim.wallMasks = masks;
}
// World-space wall painter (inside the camera transform). Returns false when
// the custom art hasn't loaded, so the caller falls back to the old sprite.
function _drawWallTiny(ctx, s, tx, ty) {
    const mask = sim.wallMasks && sim.wallMasks[tx + ',' + ty] !== undefined
        ? sim.wallMasks[tx + ',' + ty] : _wallMaskAt(tx, ty);
    const hasH = !!(mask & (WALL_E | WALL_W));
    const hasV = !!(mask & (WALL_N | WALL_S));
    const x0 = tx * TILE_SIZE, y0 = ty * TILE_SIZE, y1 = y0 + TILE_SIZE;
    if (hasH && !hasV) {
        // Horizontal run: wall_h spans exactly one tile width, bottom on the
        // tile's bottom edge. X/width snap to whole world px with a 1px overlap
        // so runs look continuous at any zoom.
        const img = getSpriteImage('wall_h');
        if (!img || !hasSprite('wall_h')) return false;
        const iw = img.naturalWidth || 62, ih = img.naturalHeight || 31;
        const dx = Math.round(x0) - 0.5;
        const dw = TILE_SIZE + 1;
        const dh = dw * (ih / iw);
        ctx.drawImage(img, dx, y1 - dh, dw, dh);
        if (_isTier2('wall', tx, ty)) _drawTier2Star(ctx, x0 + TILE_SIZE - 4, y1 - dh + 4);
        return true;
    }
    if (hasV && !hasH) {
        // Vertical run: mid piece fills the tile; caps where the run ends.
        const mid = getSpriteImage('wall_v_mid');
        if (!mid || !hasSprite('wall_v_mid')) return false;
        const w = Math.round(0.7 * TILE_SIZE);
        const dx = Math.round((tx + 0.5) * TILE_SIZE - w / 2);
        ctx.drawImage(mid, dx, y0, w, TILE_SIZE);
        let topY = y0;
        if (!(mask & WALL_N)) {
            const top = getSpriteImage('wall_v_top');
            if (top && hasSprite('wall_v_top')) {
                const dh = w * ((top.naturalHeight || 38) / (top.naturalWidth || 44));
                ctx.drawImage(top, dx, y0 - dh + 1, w, dh); // cap rises into the tile above
                topY = y0 - dh + 1;
            }
        }
        if (!(mask & WALL_S)) {
            const bot = getSpriteImage('wall_v_bottom');
            if (bot && hasSprite('wall_v_bottom')) {
                const dh = w * ((bot.naturalHeight || 44) / (bot.naturalWidth || 44));
                ctx.drawImage(bot, dx, y1 - dh, w, dh); // front face sits on the tile bottom
            }
        }
        if (_isTier2('wall', tx, ty)) _drawTier2Star(ctx, dx + w - 2, topY + 5);
        return true;
    }
    // Corner / T-junction / cross / isolated → wall_post.
    const post = getSpriteImage('wall_post');
    if (!post || !hasSprite('wall_post')) return false;
    const dw = 0.95 * TILE_SIZE;
    const dh = dw * ((post.naturalHeight || 75) / (post.naturalWidth || 56));
    const dx = (tx + 0.5) * TILE_SIZE - dw / 2;
    ctx.drawImage(post, dx, y1 - dh, dw, dh);
    if (_isTier2('wall', tx, ty)) _drawTier2Star(ctx, dx + dw - 2, y1 - dh + 5);
    return true;
}
function _drawGateTiny(ctx, s, tx, ty) {
    const key = s.gateOpen !== false ? 'gate_open' : 'gate_closed';
    const img = getSpriteImage(key);
    if (!img || !hasSprite(key)) return false;
    // Same footprint as wall_h (64 → TILE_SIZE wide), bottom on the tile bottom.
    const dw = TILE_SIZE;
    const dh = dw * ((img.naturalHeight || 63) / (img.naturalWidth || 64));
    const y1 = (ty + 1) * TILE_SIZE;
    ctx.drawImage(img, tx * TILE_SIZE, y1 - dh, dw, dh);
    if (_isTier2('gate', tx, ty)) _drawTier2Star(ctx, tx * TILE_SIZE + TILE_SIZE - 4, y1 - dh + 4);
    return true;
}

function _drawStructTiny(ctx, assets, s, tx, ty) {
    const w = s.def.width || 1;
    const h = s.def.height || 1;
    const key = s.def.key;
    // Connected walls and gates paint from the cached neighbour mask (HP bar,
    // padlock and depth sort are handled by the shared passes around this).
    if (key === 'wall' && _drawWallTiny(ctx, s, tx, ty)) return;
    if (key === 'gate' && _drawGateTiny(ctx, s, tx, ty)) return;
    const spr = _structSpriteKey(s, tx, ty);
    const prog = s.progress ?? 1.0;
    if (spr && hasSprite(spr)) {
        if (prog < 1.0) ctx.globalAlpha = 0.4 + prog * 0.6;
        drawSprite(ctx, spr, 'idle', 0, (tx + w / 2) * TILE_SIZE, (ty + h) * TILE_SIZE);
        if (prog < 1.0) ctx.globalAlpha = 1.0;
        else if (_isTier2(key, tx, ty)) _drawTier2BadgeFor(ctx, spr, tx, ty, w, h);
        return;
    }
    const assetKey = s.def.key === 'gate'
        ? (s.gateOpen !== false ? 'building_gate_open' : 'building_gate_closed')
        : s.def.assetKey;
    const asset = assets[assetKey];
    if (prog < 1.0) ctx.globalAlpha = 0.4 + prog * 0.6;
    if (asset) {
        ctx.drawImage(asset, tx * TILE_SIZE, ty * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE);
    } else {
        ctx.fillStyle = s.def.color;
        ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE);
    }
    if (prog < 1.0) ctx.globalAlpha = 1.0;
}

function _drawNatureTiny(ctx, assets, s, tx, ty, now) {
    const key = s.def.key;
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    const by = (ty + 1) * TILE_SIZE;
    if (key === 'obstacle_tree') {
        // Per-tile phase offset so a forest doesn't sway in lockstep.
        if (drawSprite(ctx, SPRITE_FOR.tree, 'sway', now + ((tx * 13 + ty * 7) & 3) * 0.25, cx, by)) return;
        const asset = assets['obstacle_tree'];
        if (asset) ctx.drawImage(asset, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        return;
    }
    if (key === 'stone_deposit') {
        if (drawSprite(ctx, SPRITE_FOR.stone_deposit, 'idle', 0, cx, by)) return;
        const asset = assets['obstacle_stone'];
        if (asset) ctx.drawImage(asset, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        else { ctx.fillStyle = '#6e7275'; ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE); }
        return;
    }
    // Custom iron-vein art; old obstacle_iron below is only the fallback.
    if (key === 'iron_vein') {
        if (drawSprite(ctx, SPRITE_FOR.iron_vein, 'idle', 0, cx, by)) return;
    }
    const asset = assets['obstacle_iron'];
    if (asset) ctx.drawImage(asset, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    else { ctx.fillStyle = '#b2b9c0'; ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE); }
}

function _drawCitizenTiny(ctx, assets, c, now) {
    if (c.job === 'hiding' && c._phase === 'hidden') return; // inside a house
    const moved = _movedSinceDraw(c, c.x, c.y);
    const rebel = c.job === 'rebel';
    let anim = moved ? 'run' : 'idle';
    if (!rebel) {
        if (c.job === 'builder' && c._phase === 'building') anim = 'build';
        else if ((c.job === 'woodcutter' || c.job === 'stone_miner' || c.job === 'iron_miner') && c._phase === 'work') anim = 'chop';
        else if (c._phase === 'returning') anim = moved ? 'carry_run' : 'carry_idle';
    }
    const dx = (typeof c.renderX === 'function') ? c.renderX() : c.x;
    const dy = (typeof c.renderY === 'function') ? c.renderY() : c.y;
    if (drawSprite(ctx, rebel ? SPRITE_FOR.rebel : SPRITE_FOR.citizen, anim, now, dx, dy, { flipX: _facingLeft(c) })) return;
    const citizenAsset = assets['citizen_sprite'];
    if (citizenAsset) {
        if (rebel) {
            ctx.globalAlpha = 0.85;
            _drawFacingSprite(ctx, citizenAsset, c, dx, dy);
            ctx.fillStyle = 'rgba(200,30,30,0.55)';
            ctx.beginPath(); ctx.arc(dx, dy, 8, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1.0;
        } else {
            _drawFacingSprite(ctx, citizenAsset, c, dx, dy);
        }
    } else {
        ctx.fillStyle = rebel ? '#cc2222' : '#ffdd57';
        ctx.beginPath(); ctx.arc(dx, dy, rebel ? 5 : 4, 0, Math.PI * 2); ctx.fill();
    }
}

function _drawSoldierTiny(ctx, assets, sol, now, zoom) {
    const moved = _movedSinceDraw(sol, sol.x, sol.y);
    const attacking = (now - (sol._meleeT || -99)) < 0.3;
    const anim = attacking ? 'attack' : (moved ? 'run' : 'idle');
    let key = SPRITE_FOR.soldier, scaleMul = 1;
    if (sol.isCaptain) { key = SPRITE_FOR.captain; scaleMul = 1.25; }
    else if (sol.isMilitia) key = SPRITE_FOR.militia;
    if (sol.isCaptain) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath(); ctx.arc(sol.x, sol.y, 11, 0, Math.PI * 2); ctx.stroke();
    }
    if (drawSprite(ctx, key, anim, now, sol.x, sol.y, { flipX: _facingLeft(sol), scaleMul })) return;
    const soldierAsset = assets['citizen_soldier'];
    const militiaAsset = assets['citizen_sprite'];
    if (sol.isMilitia) {
        if (militiaAsset) _drawFacingSprite(ctx, militiaAsset, sol, sol.x, sol.y);
        else { ctx.fillStyle = '#ffdd57'; ctx.beginPath(); ctx.arc(sol.x, sol.y, 4, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#6b4a2a';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.moveTo(sol.x + 4, sol.y - 9);
        ctx.lineTo(sol.x + 8, sol.y + 7);
        ctx.stroke();
    } else if (soldierAsset) {
        _drawFacingSprite(ctx, soldierAsset, sol, sol.x, sol.y, sol.isCaptain ? 20 : 16);
    } else {
        ctx.fillStyle = '#1a3a6a';
        ctx.beginPath(); ctx.arc(sol.x, sol.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffdd57'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sol.x, sol.y, 6, 0, Math.PI * 2); ctx.stroke();
    }
}

function _drawArcherTiny(ctx, assets, a, now) {
    const moved = _movedSinceDraw(a, a.x, a.y);
    const anim = (now - (a._shootT || -99)) < 0.6 ? 'shoot' : (moved ? 'run' : 'idle');
    if (drawSprite(ctx, SPRITE_FOR.archer, anim, now, a.x, a.y, { flipX: _facingLeft(a) })) return;
    const archerAsset = assets['citizen_archer'];
    if (archerAsset) {
        _drawFacingSprite(ctx, archerAsset, a, a.x, a.y);
    } else {
        ctx.fillStyle = '#00ccaa';
        ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, Math.PI * 2); ctx.fill();
    }
}

function _drawKnightTiny(ctx, assets, k, now) {
    const moved = _movedSinceDraw(k, k.x, k.y);
    const attacking = (now - (k._meleeT || -99)) < 0.3;
    const anim = attacking ? 'attack' : (moved ? 'run' : 'idle');
    if (drawSprite(ctx, SPRITE_FOR.knight, anim, now, k.x, k.y, { flipX: _facingLeft(k) })) return;
    const knightAsset = assets['citizen_knight'];
    if (knightAsset) {
        _drawFacingSprite(ctx, knightAsset, k, k.x, k.y);
    } else {
        ctx.fillStyle = '#cc8800';
        ctx.beginPath(); ctx.arc(k.x, k.y, 6, 0, Math.PI * 2); ctx.fill();
    }
}

function _drawRaiderTiny(ctx, assets, r, now) {
    const moved = _movedSinceDraw(r, r.x, r.y);
    let key = SPRITE_FOR.raider_normal;
    if (r.isCampGuard) key = SPRITE_FOR.camp_guard;
    else if (r.type === 'torch') key = SPRITE_FOR.raider_torch;
    else if (r.type === 'siege') key = SPRITE_FOR.raider_siege;
    let anim = moved ? 'run' : 'idle';
    if (r._attacking) anim = (r.type === 'siege' && !r.isCampGuard) ? 'throw' : 'attack';
    if (r.targetX < r.x - 0.5) r._facingLeft = true;
    else if (r.targetX > r.x + 0.5) r._facingLeft = false;
    if (r._attacking) {
        const pulse = 0.45 + 0.55 * Math.abs(Math.sin(now * 1000 / 120));
        ctx.strokeStyle = 'rgba(255, 80, 0, ' + pulse.toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 11, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (drawSprite(ctx, key, anim, now, r.x, r.y,
            { flipX: !!r._facingLeft, rotation: r._rotation || 0, alpha: r._alpha })) return;
    const raiderAsset = r.type === 'torch' ? assets['enemy_torch_raider']
                      : r.type === 'siege' ? assets['enemy_siege_raider']
                      : assets['enemy_raider'];
    ctx.save();
    ctx.globalAlpha = r._alpha;
    ctx.translate(r.x, r.y);
    if (r._rotation) ctx.rotate(r._rotation);
    if (raiderAsset) {
        if (r._facingLeft) ctx.scale(-1, 1);
        ctx.drawImage(raiderAsset, -8, -8, 16, 16);
    } else {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
}

function _drawMerchantTiny(ctx, assets, m, now) {
    const lastX = m._sprLX;
    _movedSinceDraw(m, m.x, m.y);
    if (lastX !== undefined) {
        if (m.x < lastX - 0.05) m._facingLeft = true;
        else if (m.x > lastX + 0.05) m._facingLeft = false;
    }
    const moving = m.state === 'approaching' || m.state === 'departing';
    if (drawSprite(ctx, SPRITE_FOR.merchant, moving ? 'carry_run' : 'carry_idle',
            now, m.x, m.y, { flipX: !!m._facingLeft })) return;
    const merchantAsset = assets['npc_merchant'];
    if (merchantAsset) {
        ctx.drawImage(merchantAsset, m.x - 8, m.y - 8, 16, 16);
    } else {
        ctx.fillStyle = '#cc8844';
        ctx.fillRect(m.x - 8, m.y - 8, 16, 16);
    }
}

function _drawCampTiny(ctx, assets, camp, zoom) {
    const drew = drawSprite(ctx, SPRITE_FOR.camp, 'idle', 0, camp.x, camp.y + TILE_SIZE / 2);
    if (!drew) {
        ctx.fillStyle = '#4a2c1a';
        ctx.beginPath();
        ctx.moveTo(camp.x, camp.y - 13);
        ctx.lineTo(camp.x + 12, camp.y + 8);
        ctx.lineTo(camp.x - 12, camp.y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2a180c';
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
        ctx.fillStyle = '#20120a';
        ctx.fillRect(camp.x - 3, camp.y - 1, 6, 9);
    }
    // Banner pole + flag and the damaged HP bar stay for readability.
    ctx.strokeStyle = '#332211';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath(); ctx.moveTo(camp.x + 10, camp.y - 18); ctx.lineTo(camp.x + 10, camp.y + 2); ctx.stroke();
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(camp.x + 10, camp.y - 18, 9, 5);
    if (camp.hp < camp.maxHp) {
        const bw = 26;
        ctx.fillStyle = '#333333';
        ctx.fillRect(camp.x - bw / 2, camp.y - 22, bw, 3);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(camp.x - bw / 2, camp.y - 22, bw * Math.max(0, camp.hp / camp.maxHp), 3);
    }
}

function _drawSheepTiny(ctx, sh, now) {
    drawSprite(ctx, 'sheep_idle', 'idle', now + (sh.phase || 0), sh.x, sh.y, { flipX: !!sh.flip });
}

function _drawEntry(ctx, assets, e, now, zoom) {
    switch (e.k) {
        case DK_STRUCT: _drawStructTiny(ctx, assets, e.o, e.tx, e.ty); break;
        case DK_NATURE: _drawNatureTiny(ctx, assets, e.o, e.tx, e.ty, now); break;
        case DK_CIT: _drawCitizenTiny(ctx, assets, e.o, now); break;
        case DK_SOL: _drawSoldierTiny(ctx, assets, e.o, now, zoom); break;
        case DK_ARC: _drawArcherTiny(ctx, assets, e.o, now); break;
        case DK_KNI: _drawKnightTiny(ctx, assets, e.o, now, zoom); break;
        case DK_RAID: _drawRaiderTiny(ctx, assets, e.o, now); break;
        case DK_CAMP: _drawCampTiny(ctx, assets, e.o, zoom); break;
        case DK_MERCH: _drawMerchantTiny(ctx, assets, e.o, now); break;
        default: _drawSheepTiny(ctx, e.o, now); break;
    }
}

// Collect every visible drawable into the reused _drawList. Bounds already
// include a 1–3 tile margin so tall sprites overlapping the viewport are kept.
function _collectDrawList(x0, x1, y0, y1, viewMinX, viewMinY, viewMaxX, viewMaxY) {
    const grid = sim.grid;
    for (let ty = y0; ty <= y1; ty++) {
        const row = grid.structures[ty];
        for (let tx = x0; tx <= x1; tx++) {
            const s = row[tx];
            if (!s || s.isChild) continue;
            const key = s.def.key;
            if (key === 'obstacle_tree' || key === 'stone_deposit' || key === 'iron_vein') {
                _emitDraw(DK_NATURE, (ty + 1) * TILE_SIZE, s, tx, ty);
            } else {
                _emitDraw(DK_STRUCT, (ty + (s.def.height || 1)) * TILE_SIZE, s, tx, ty);
            }
        }
    }
    for (let i = 0; i < citizens.length; i++) {
        const c = citizens[i];
        if (c.job === 'hiding' && c._phase === 'hidden') continue;
        const dx = (typeof c.renderX === 'function') ? c.renderX() : c.x;
        const dy = (typeof c.renderY === 'function') ? c.renderY() : c.y;
        if (dx < viewMinX || dx > viewMaxX || dy < viewMinY || dy > viewMaxY) continue;
        _emitDraw(DK_CIT, dy, c, 0, 0);
    }
    const unitLists = [[soldiers, DK_SOL, 200], [archers, DK_ARC, 150], [knights, DK_KNI, 100]];
    for (let li = 0; li < unitLists.length; li++) {
        const list = unitLists[li][0], kind = unitLists[li][1], cap = unitLists[li][2];
        let n = 0;
        for (let i = 0; i < list.length; i++) {
            const u = list[i];
            if (u.x < viewMinX || u.x > viewMaxX || u.y < viewMinY || u.y > viewMaxY) continue;
            if (n++ >= cap) break;
            _emitDraw(kind, u.y, u, 0, 0);
        }
    }
    let rn = 0;
    for (let i = 0; i < raiders.length; i++) {
        const r = raiders[i];
        if (r.x < viewMinX || r.x > viewMaxX || r.y < viewMinY || r.y > viewMaxY) continue;
        if (rn++ >= 300) break;
        _emitDraw(DK_RAID, r.y, r, 0, 0);
    }
    const camps = sim.raiderCamps || [];
    for (let i = 0; i < camps.length; i++) {
        const camp = camps[i];
        if (camp.x < viewMinX || camp.x > viewMaxX || camp.y < viewMinY || camp.y > viewMaxY) continue;
        _emitDraw(DK_CAMP, camp.y + TILE_SIZE / 2, camp, 0, 0);
    }
    const m = sim.merchantNPC;
    if (m && m.state !== 'done' && m.x >= viewMinX && m.x <= viewMaxX && m.y >= viewMinY && m.y <= viewMaxY) {
        _emitDraw(DK_MERCH, m.y, m, 0, 0);
    }
    const sheep = window.__pdSheep;
    if (sheep) {
        for (let i = 0; i < sheep.length; i++) {
            const sh = sheep[i];
            if (sh.x < viewMinX || sh.x > viewMaxX || sh.y < viewMinY || sh.y > viewMaxY) continue;
            _emitDraw(DK_SHEEP, sh.y, sh, 0, 0);
        }
    }
}

export class GameGrid {
    constructor(width = GRID_WIDTH, height = GRID_HEIGHT, seed) {
        this.width = width;
        this.height = height;
        this.seed = seed || randomSeedString();
        this.rng = makeSeededRng(this.seed);
        this.camera = { x: 0, y: 0, zoom: 1.0 };
        this.tiles = this._generateTiles();
        this.structures = this._initStructures();
        this._spawnTrees();
        this._spawnOutcrops();
        this.generateDeco();
    }

    regenerate(seed) {
        // Reset the world from a new seed (preview / new-game only).
        this.seed = seed || randomSeedString();
        this.rng = makeSeededRng(this.seed);
        this.structures = this._initStructures();
        this.tiles = this._generateTiles();
        this._spawnTrees();
        this._spawnOutcrops();
        this.generateDeco();
    }

    // Purely visual scenery: ~7% of empty grass tiles get a deco sprite, picked
    // with a seeded RNG so the same map seed always grows the same scenery.
    // Deco never blocks placement; it is cleared when a structure/road lands on it.
    generateDeco() {
        this.deco = Array.from({ length: this.height }, () => new Array(this.width).fill(0));
        const rng = makeSeededRng(this.seed + ':deco');
        for (let ty = 0; ty < this.height; ty++) {
            for (let tx = 0; tx < this.width; tx++) {
                if (this.tiles[ty][tx] !== 'tile_grass' || this.structures[ty][tx]) continue;
                if (rng() >= 0.07) continue;
                const r = rng();
                let n;
                if (r < 0.40) n = 7 + Math.floor(rng() * 3);       // bushes 07–09
                else if (r < 0.60) n = 4 + Math.floor(rng() * 2);  // small rocks 04–05
                else if (r < 0.75) n = 1 + Math.floor(rng() * 3);  // mushrooms 01–03
                else if (r < 0.90) n = 10 + Math.floor(rng() * 2); // sprouts 10–11
                else n = 12 + Math.floor(rng() * 2);               // pumpkins 12–13
                this.deco[ty][tx] = n;
            }
        }
    }

    _generateTiles() {
        const tiles = [];
        for (let y = 0; y < this.height; y++) {
            tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                tiles[y][x] = 'tile_grass';
            }
        }
        return tiles;
    }

    _initStructures() {
        return Array.from({ length: this.height }, () => new Array(this.width).fill(null));
    }

    // Trees grow in forest clusters (plus light scatter) instead of a uniform
    // 5% sprinkle, so each map has distinct wooded regions worth building near.
    // The starting territory (radius ~6 around center) is kept mostly clear.
    _spawnTrees() {
        const clusterCount = 5 + Math.floor(this.rng() * 4);
        for (let c = 0; c < clusterCount; c++) {
            const ccx = 4 + this.rng() * (this.width - 8);
            const ccy = 4 + this.rng() * (this.height - 8);
            const radius = 3 + this.rng() * 5;
            const r0 = Math.floor(radius);
            for (let dy = -r0; dy <= r0; dy++) {
                for (let dx = -r0; dx <= r0; dx++) {
                    const tx = Math.round(ccx + dx), ty = Math.round(ccy + dy);
                    if (!this.inBounds(tx, ty)) continue;
                    if (this.tiles[ty][tx] !== 'tile_grass' || this.structures[ty][tx]) continue;
                    if (Math.hypot(tx - 32, ty - 32) < 6) continue; // keep the start clear-ish
                    const dist = Math.hypot(dx, dy);
                    if (dist > radius) continue;
                    if (this.rng() < 0.55 * (1 - dist / (radius + 1))) {
                        this.structures[ty][tx] = { def: TREE_DEF };
                    }
                }
            }
        }
        // Light scatter everywhere else so lone trees still dot the map
        for (let ty = 0; ty < this.height; ty++) {
            for (let tx = 0; tx < this.width; tx++) {
                if (this.tiles[ty][tx] === 'tile_grass' && !this.structures[ty][tx] && this.rng() < 0.015) {
                    this.structures[ty][tx] = { def: TREE_DEF };
                }
            }
        }
    }

    // Stone/iron surface in small veins of 2–5 deposits rather than lone tiles,
    // making quarry/mine placement a real siting decision.
    _spawnOutcrops() {
        const spawnVein = (def, veins, minSize, maxSize) => {
            for (let v = 0; v < veins; v++) {
                let tx = Math.floor(4 + this.rng() * (this.width - 8));
                let ty = Math.floor(4 + this.rng() * (this.height - 8));
                if (Math.hypot(tx - 32, ty - 32) < 5) continue; // not on the town center
                const size = minSize + Math.floor(this.rng() * (maxSize - minSize + 1));
                for (let n = 0; n < size; n++) {
                    if (this.inBounds(tx, ty) && this.tiles[ty][tx] === 'tile_grass' && !this.structures[ty][tx]) {
                        this.structures[ty][tx] = { def, hp: 5 };
                    }
                    tx += Math.floor(this.rng() * 3) - 1;
                    ty += Math.floor(this.rng() * 3) - 1;
                }
            }
        };
        spawnVein(STONE_DEP_DEF, 8, 2, 5);
        spawnVein(IRON_VEIN_DEF, 5, 2, 4);
    }

    inBounds(tx, ty) {
        return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
    }

    screenToGrid(screenX, screenY) {
        const worldX = screenX / this.camera.zoom + this.camera.x;
        const worldY = screenY / this.camera.zoom + this.camera.y;
        return {
            tx: Math.floor(worldX / TILE_SIZE),
            ty: Math.floor(worldY / TILE_SIZE),
        };
    }

    canPlace(tx, ty, w = 1, h = 1) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const targetTX = tx + dx;
                const targetTY = ty + dy;
                if (!this.inBounds(targetTX, targetTY)) return false;
                const tile = this.tiles[targetTY][targetTX];
                if ((tile !== 'tile_grass' && tile !== 'tile_dirt') || this.structures[targetTY][targetTX]) return false;
            }
        }
        return true;
    }

    place(tx, ty, def) {
        if (!this.inBounds(tx, ty)) return;
        const w = def.width || 1;
        const h = def.height || 1;
        const entry = { def };
        this.structures[ty][tx] = entry;
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (dx === 0 && dy === 0) continue;
                this.structures[ty + dy][tx + dx] = { def, isChild: true, parentX: tx, parentY: ty };
            }
        }
    }

    demolish(tx, ty) {
        if (!this.inBounds(tx, ty)) return null;
        let s = this.structures[ty][tx];
        if (!s) return null;
        let parentTX = tx;
        let parentTY = ty;
        if (s.isChild) {
            parentTX = s.parentX;
            parentTY = s.parentY;
            s = this.structures[parentTY][parentTX];
        }
        if (!s) return null;
        const w = s.def.width || 1;
        const h = s.def.height || 1;
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                this.structures[parentTY + dy][parentTX + dx] = null;
            }
        }
        return s;
    }

    render(ctx, assets, { hoverTile = null, selectedTool = null, buildings = {}, citizens = [] } = {}) {
        const { x: camX, y: camY, zoom } = this.camera;
        const canvasW = ctx.canvas.width;
        const canvasH = ctx.canvas.height;

        // Tile bounds carry a margin so tall sprites overlapping the viewport edge
        // are still collected into the depth-sorted pass (towers reach ~3 tiles up).
        const startX = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
        const startY = Math.max(0, Math.floor(camY / TILE_SIZE) - 3);
        const endX = Math.min(this.width - 1, Math.ceil((camX + canvasW / zoom) / TILE_SIZE) + 1);
        const endY = Math.min(this.height - 1, Math.ceil((camY + canvasH / zoom) / TILE_SIZE) + 1);

        ctx.save();
        ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
        ctx.imageSmoothingEnabled = false;

        // Draw pre-rendered static background & structures (viewport culled)
        if (_staticCanvas) {
            const sx = Math.max(0, camX);
            const sy = Math.max(0, camY);
            const sw = Math.min(_staticCanvas.width - sx, canvasW / zoom);
            const sh = Math.min(_staticCanvas.height - sy, canvasH / zoom);
            if (sw > 0 && sh > 0) {
                ctx.drawImage(_staticCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
            }
        } else {
            // Fallback to grass canvas + individual tiles if staticCanvas isn't built yet
            if (_grassCanvas) ctx.drawImage(_grassCanvas, 0, 0);
            for (let ty = startY; ty <= endY; ty++) {
                for (let tx = startX; tx <= endX; tx++) {
                    const tile = this.tiles[ty][tx];
                    if (tile === 'tile_grass') continue;
                    const asset = assets[tile];
                    if (asset) ctx.drawImage(asset, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // Depth-sorted world pass: structures, nature, units, camps, merchant and
        // sheep in one list ordered by ground-y (units hide behind tall towers).
        _collectDrawList(startX, endX, startY, endY,
            camX - 96, camY - 96, camX + canvasW / zoom + 96, camY + canvasH / zoom + 96);
        _drawList.sort(_drawCmp);
        const _nowSec = performance.now() / 1000;
        for (let _di = 0; _di < _drawList.length; _di++) {
            _drawEntry(ctx, assets, _drawList[_di], _nowSec, zoom);
        }
        for (let _di = 0; _di < _drawList.length; _di++) _drawFree.push(_drawList[_di]);
        _drawList.length = 0;

        // Overlays drawn after the sorted pass: structure HP / construction /
        // research bars and the locked-gate padlock.
        for (let ty = startY; ty <= endY; ty++) {
            for (let tx = startX; tx <= endX; tx++) {
                const s = this.structures[ty][tx];
                if (!s || s.isChild) continue;
                const key = s.def.key;
                const renderW = (s.def.width || 1) * TILE_SIZE;
                const renderH = (s.def.height || 1) * TILE_SIZE;
                if (key === 'gate' && s.manuallyLocked) {
                    ctx.save();
                    ctx.font = `${10}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.fillText('🔒', tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + 2);
                    ctx.restore();
                }
                const prog = s.progress ?? 1.0;
                if (prog < 1.0) {
                    ctx.fillStyle = 'rgba(0,0,0,0.55)';
                    ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE + renderH - 6, renderW - 4, 4);
                    ctx.fillStyle = '#ffdd57';
                    ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE + renderH - 6, (renderW - 4) * prog, 4);
                } else if (s.hp !== undefined && !window._NON_BURNABLE.has(key)) {
                    const maxHp = getMaxHP(key, tx, ty);
                    const hpPct = Math.max(0, s.hp / maxHp);
                    if (hpPct < 1.0) {
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + renderH - 4, renderW - 2, 3);
                        ctx.fillStyle = hpPct > 0.6 ? '#44cc44' : hpPct > 0.3 ? '#ffaa00' : '#cc2222';
                        ctx.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + renderH - 4, (renderW - 2) * hpPct, 3);
                    }
                } else if (key === 'academy' && gameState.activeResearch) {
                    const researchDur = gameState.activeResearch.duration ?? 15.0;
                    const progressPct = (researchDur - gameState.activeResearch.timer) / researchDur;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE - 8, renderW - 4, 4);
                    ctx.fillStyle = '#ffb300';
                    ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE - 8, (renderW - 4) * progressPct, 4);
                }
            }
        }

        // Unit HP bars sit above the new, taller sprites (old offsets when the
        // Tiny Swords sheet failed to load and the 16px fallback draws instead).
        {
            const tall = hasSprite(SPRITE_FOR.soldier);
            const viewMinX = camX - 96, viewMinY = camY - 96;
            const viewMaxX = camX + canvasW / zoom + 96, viewMaxY = camY + canvasH / zoom + 96;
            const bar = (x, y, w, frac, color) => {
                ctx.fillStyle = '#333333';
                ctx.fillRect(x - w / 2, y, w, 2);
                ctx.fillStyle = color;
                ctx.fillRect(x - w / 2, y, w * frac, 2);
            };
            for (const sol of soldiers) {
                if (sol.x < viewMinX || sol.x > viewMaxX || sol.y < viewMinY || sol.y > viewMaxY) continue;
                const max = sol.maxHp || 100;
                if (sol.hp >= max) continue;
                bar(sol.x, sol.y - (tall ? (sol.isCaptain ? 58 : 50) : 12), 16, sol.hp / max, '#4488ff');
            }
            for (const a of archers) {
                if (a.x < viewMinX || a.x > viewMaxX || a.y < viewMinY || a.y > viewMaxY) continue;
                if (a.hp >= a.maxHp) continue;
                bar(a.x, a.y - (tall ? 48 : 12), 14, a.hp / a.maxHp, '#00ccaa');
            }
            for (const k of knights) {
                if (k.x < viewMinX || k.x > viewMaxX || k.y < viewMinY || k.y > viewMaxY) continue;
                if (k.hp >= k.maxHp) continue;
                bar(k.x, k.y - (tall ? 50 : 12), 16, k.hp / k.maxHp, '#cc8800');
            }
            for (const r of raiders) {
                if (r.state !== 'walking' || r.x < viewMinX || r.x > viewMaxX || r.y < viewMinY || r.y > viewMaxY) continue;
                const max = r.maxHp || (r.type === 'siege' ? 150 : 100);
                if (r.hp >= max) continue;
                bar(r.x, r.y - (tall ? 48 : 12), 16, r.hp / max, '#ff4444');
            }
        }

        // Locked Territory Shading — darken everything outside the territory circle in a
        // single even-odd fill (outer viewport rect + inner circle hole) instead of testing
        // and filling each visible tile. Cutout is centered/radiused to match the golden
        // boundary circle drawn below.
        const R = window.calcTerritoryRadius ? window.calcTerritoryRadius() : 3;
        const _shadeX = camX - TILE_SIZE, _shadeY = camY - TILE_SIZE;
        const _shadeW = canvasW / zoom + TILE_SIZE * 2, _shadeH = canvasH / zoom + TILE_SIZE * 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.rect(_shadeX, _shadeY, _shadeW, _shadeH);
        ctx.arc(32.5 * TILE_SIZE, 32.5 * TILE_SIZE, R * TILE_SIZE, 0, Math.PI * 2);
        ctx.fill('evenodd');

        // Golden Boundary Circle
        ctx.strokeStyle = 'rgba(255, 221, 87, 0.6)';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([8, 8]);
        ctx.shadowColor = 'rgba(255, 221, 87, 0.8)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(32.5 * TILE_SIZE, 32.5 * TILE_SIZE, R * TILE_SIZE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        if (hoverTile && selectedTool && selectedTool !== 'demolish' && selectedTool !== 'clear' && selectedTool !== 'clear_rubble') {
            const { tx, ty } = hoverTile;
            if (this.inBounds(tx, ty)) {
                const def = buildings[selectedTool];
                if (def) {
                    const w = def.width || 1;
                    const h = def.height || 1;
                    const renderW = w * TILE_SIZE;
                    const renderH = h * TILE_SIZE;
                    // Validity-aware ghost: green wash when placeable, red with a reason when not
                    const placeable = this.canPlace(tx, ty, w, h);
                    const affordable = selectedTool === 'road'
                        ? gameState.gold >= ROAD_COST
                        : gameState.gold >= getScaledCost(selectedTool)
                            && gameState.wood >= (def.woodCost || 0)
                            && gameState.iron >= (def.ironCost || 0)
                            && gameState.stone >= (def.stoneCost || 0);
                    const inTerritory = Math.hypot(tx - 32, ty - 32) <= R;
                    const ok = placeable && affordable && inTerritory;
                    ctx.globalAlpha = 0.55;
                    // Tiny Swords preview when one is mapped for this building
                    // (walls/gates preview their single-tile look: wall_post /
                    // gate_closed). Roads preview the sand autotile instead.
                    const ghostSpr = SPRITE_FOR[selectedTool];
                    if (selectedTool === 'road' && hasTerrain()) {
                        const isR = (x, y) => (x === tx && y === ty)
                            || (this.inBounds(x, y) && this.tiles[y][x] === 'tile_road');
                        ctx.save();
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        paintRoad(ctx, isR(tx, ty - 1), isR(tx + 1, ty),
                            isR(tx, ty + 1), isR(tx - 1, ty), tx * TILE_SIZE, ty * TILE_SIZE);
                        ctx.restore();
                    } else if (typeof ghostSpr === 'string' && hasSprite(ghostSpr)) {
                        drawSprite(ctx, ghostSpr, 'idle', performance.now() / 1000,
                            (tx + w / 2) * TILE_SIZE, (ty + h) * TILE_SIZE);
                    } else {
                        const asset = assets[def.assetKey];
                        if (asset) {
                            ctx.drawImage(asset, tx * TILE_SIZE, ty * TILE_SIZE, renderW, renderH);
                        } else {
                            ctx.fillStyle = def.color;
                            ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, renderW, renderH);
                        }
                    }
                    ctx.fillStyle = ok ? 'rgba(80, 220, 100, 0.28)' : 'rgba(220, 60, 40, 0.38)';
                    ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, renderW, renderH);
                    ctx.globalAlpha = 1.0;
                    if (!ok) {
                        const reason = !inTerritory ? 'Outside territory' : !placeable ? 'Blocked' : 'Cannot afford';
                        ctx.save();
                        ctx.font = `bold ${11 / zoom}px monospace`;
                        ctx.textAlign = 'center';
                        ctx.lineWidth = 3 / zoom;
                        ctx.strokeStyle = '#000';
                        ctx.fillStyle = '#ff8877';
                        const lx = (tx + w / 2) * TILE_SIZE;
                        const ly = (ty + h) * TILE_SIZE + 12 / zoom;
                        ctx.strokeText(reason, lx, ly);
                        ctx.fillText(reason, lx, ly);
                        ctx.restore();
                    }
                }
            }
        }

        if (hoverTile) {
            const { tx, ty } = hoverTile;
            if (this.inBounds(tx, ty)) {
                let w = 1, h = 1;
                if (selectedTool && buildings[selectedTool]) {
                    w = buildings[selectedTool].width || 1;
                    h = buildings[selectedTool].height || 1;
                }
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2 / zoom;
                ctx.strokeRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + 1, w * TILE_SIZE - 2, h * TILE_SIZE - 2);

                // Adjacency bonus preview for eligible buildings
                if (selectedTool === 'farm' || selectedTool === 'lumberyard' || selectedTool === 'quarry' || selectedTool === 'mine' || selectedTool === 'tavern') {
                    const bonus = getAdjacencyBonus(tx, ty, selectedTool);
                    if (bonus > 0) {
                        const unit = selectedTool === 'farm'
                            ? 'food'
                            : selectedTool === 'lumberyard'
                                ? 'wood'
                                : selectedTool === 'quarry'
                                    ? 'stone'
                                    : selectedTool === 'mine'
                                        ? 'iron'
                                        : 'happiness';
                        const label = `+${bonus % 1 === 0 ? bonus : bonus.toFixed(1)} ${unit} adj`;
                        ctx.save();
                        ctx.font = `bold ${11 / zoom}px monospace`;
                        ctx.textAlign = 'center';
                        ctx.lineWidth = 2 / zoom;
                        ctx.strokeStyle = '#000';
                        ctx.fillStyle = '#ffffaa';
                        const lx = (tx + 0.5) * TILE_SIZE;
                        const ly = ty * TILE_SIZE - 3 / zoom;
                        ctx.strokeText(label, lx, ly);
                        ctx.fillText(label, lx, ly);
                        ctx.restore();
                    }
                }
            }
        }

        ctx.restore();
    }
}


// ===================== TECH & RESEARCH UI =====================
export function openResearchModal() {
    sim.gameIsPaused = true;
    updateResearchModalUI();
    document.getElementById('research-modal').classList.add('open');
}

function closeResearchModal() {
    sim.gameIsPaused = false;
    document.getElementById('research-modal').classList.remove('open');
}
// Single source of truth for research entries: name, description, costs, and
// prerequisites (previously duplicated between UPGRADES_INFO and UPGRADES_COSTS).
// `requires` = number of completed researches needed before this one unlocks.
const RESEARCH_DEFS = [
    { key: 'reinforced_masonry',    name: 'Reinforced Masonry',    desc: 'Increases all walls and gates max HP by +100.', goldCost: 150, stoneCost: 50, ironCost: 0,  woodCost: 0,  requires: 0 },
    { key: 'steel_bows',            name: 'Steel Bows',            desc: 'Increases Archer attack damage by +5.',          goldCost: 150, stoneCost: 0,  ironCost: 50, woodCost: 0,  requires: 0 },
    { key: 'heavy_armor',           name: 'Heavy Armor',           desc: 'Increases Knight max HP by +50.',                goldCost: 200, stoneCost: 0,  ironCost: 80, woodCost: 0,  requires: 2 },
    { key: 'crop_rotation',         name: 'Crop Rotation',         desc: 'Increases Farm food yield by +2.',               goldCost: 100, stoneCost: 0,  ironCost: 0,  woodCost: 50, requires: 0 },
    { key: 'ballistic_engineering', name: 'Ballistic Engineering', desc: 'Ballista range +3 tiles, bolt damage +15.',      goldCost: 200, stoneCost: 0,  ironCost: 50, woodCost: 0,  requires: 2 },
    { key: 'iron_discipline',       name: 'Iron Discipline',       desc: 'Soldiers spawn with +25 max HP (100→125).',      goldCost: 150, stoneCost: 0,  ironCost: 40, woodCost: 0,  requires: 0 },
    { key: 'trade_guilds',          name: 'Trade Guilds',          desc: 'Tax income +50% (+0.5 gold per citizen per tick).', goldCost: 180, stoneCost: 0,  ironCost: 20, woodCost: 0,  requires: 0 },
    { key: 'field_medicine',        name: 'Field Medicine',        desc: 'Military units regenerate HP 2× faster.',        goldCost: 150, stoneCost: 0,  ironCost: 0,  woodCost: 30, requires: 0 },
    { key: 'masonry_crews',         name: 'Masonry Crews',         desc: 'Repairs twice as fast and cost no wood.',      goldCost: 150, stoneCost: 60, ironCost: 0,  woodCost: 0,  requires: 4 },
    { key: 'watchtowers',           name: 'Watchtowers',           desc: 'Arrow towers gain +2 tiles of range.',         goldCost: 180, stoneCost: 60, ironCost: 0,  woodCost: 0,  requires: 4 },
    { key: 'militia_drills',        name: 'Militia Drills',        desc: 'Militia have 100 HP and full soldier damage.', goldCost: 120, stoneCost: 0,  ironCost: 30, woodCost: 0,  requires: 4 },
    { key: 'preserved_stores',      name: 'Preserved Stores',      desc: 'Winter food drain ×1.75 instead of ×2.5.',    goldCost: 160, stoneCost: 0,  ironCost: 0,  woodCost: 60, requires: 4 },
];

function countCompletedResearch() {
    return Object.values(gameState.upgrades || {}).filter(Boolean).length;
}

export function updateResearchModalUI() {
    const listEl = document.getElementById('research-upgrades-list');
    if (!listEl) return;

    const completedCount = countCompletedResearch();
    listEl.innerHTML = RESEARCH_DEFS.map(upg => {
        const isUnlocked = gameState.upgrades && gameState.upgrades[upg.key];
        const isResearching = gameState.activeResearch && gameState.activeResearch.upgradeKey === upg.key;

        let statusHtml = '';
        let progressOverlay = '';

        if (isUnlocked) {
            statusHtml = '<span class="upgrade-card-status unlocked">✓ UNLOCKED</span>';
        } else if (isResearching) {
            const researchDur = gameState.activeResearch.duration ?? 15.0;
            const timeRemaining = Math.ceil(gameState.activeResearch.timer);
            const pct = ((researchDur - gameState.activeResearch.timer) / researchDur) * 100;
            statusHtml = `<span class="upgrade-card-status researching">RESEARCHING (${timeRemaining}s — resumes on close)</span>`;
            progressOverlay = `<div class="upgrade-progress-overlay" style="width: ${pct}%"></div>`;
        } else {
            const goldOk = gameState.gold >= upg.goldCost;
            const woodOk = gameState.wood >= upg.woodCost;
            const stoneOk = gameState.stone >= upg.stoneCost;
            const ironOk = gameState.iron >= upg.ironCost;
            const canAfford = goldOk && woodOk && stoneOk && ironOk;
            const busy = gameState.activeResearch !== null && gameState.activeResearch !== undefined;
            const prereqMet = completedCount >= (upg.requires || 0);

            if (!prereqMet) {
                statusHtml = `<button class="scroll-btn upgrade-card-btn" disabled>NEEDS ${upg.requires} TECH</button>`;
            } else if (busy) {
                statusHtml = '<button class="scroll-btn upgrade-card-btn" disabled>QUEUED</button>';
            } else if (!canAfford) {
                statusHtml = '<button class="scroll-btn upgrade-card-btn danger" disabled>LOCKED</button>';
            } else {
                statusHtml = `<button class="scroll-btn upgrade-card-btn wine" onclick="startResearch('${upg.key}')">RESEARCH</button>`;
            }
        }

        const costParts = [];
        if (upg.goldCost > 0) costParts.push(`<span class="build-cost-gold">◈ ${upg.goldCost}</span>`);
        if (upg.woodCost > 0) costParts.push(`<span class="build-cost-wood">◆ ${upg.woodCost}</span>`);
        if (upg.stoneCost > 0) costParts.push(`<span class="build-cost-stone">⬟ ${upg.stoneCost}</span>`);
        if (upg.ironCost > 0) costParts.push(`<span class="build-cost-iron">◇ ${upg.ironCost}</span>`);

        return `<div class="upgrade-card">
            ${progressOverlay}
            <div class="upgrade-card-info">
                <div class="upgrade-card-name">${upg.name}</div>
                <div class="upgrade-card-desc">${upg.desc}</div>
                <div class="upgrade-card-cost">${costParts.join('')}</div>
            </div>
            <div class="upgrade-card-action">
                ${statusHtml}
            </div>
        </div>`;
    }).join('');
}

function startResearch(upgradeKey) {
    if (gameState.activeResearch) return;

    const def = RESEARCH_DEFS.find(u => u.key === upgradeKey);
    if (!def) return;
    if (gameState.upgrades?.[upgradeKey]) return;
    if (countCompletedResearch() < (def.requires || 0)) return;

    if (gameState.gold < def.goldCost || gameState.wood < def.woodCost || gameState.stone < def.stoneCost || gameState.iron < def.ironCost) return;

    gameState.gold -= def.goldCost;
    gameState.wood -= def.woodCost;
    gameState.stone -= def.stoneCost;
    gameState.iron -= def.ironCost;

    // Research takes longer as the tech base grows (30s → 60s cap), so raid
    // cadence and research order become real decisions instead of a vending machine.
    const duration = Math.min(60, 30 + 10 * countCompletedResearch());
    gameState.activeResearch = {
        upgradeKey,
        timer: duration,
        duration,
    };

    playBuildSFX();
    refreshUI();
    updateResearchModalUI();
}

function updateResearch(dtSec) {
    if (!gameState.activeResearch) return;
    
    gameState.activeResearch.timer = Math.max(0, gameState.activeResearch.timer - dtSec);
    if (gameState.activeResearch.timer <= 0) {
        const key = gameState.activeResearch.upgradeKey;
        gameState.upgrades[key] = true;
        gameState.activeResearch = null;
        
        applyUpgradeEffects(key);
        playResearchCompleteSFX();
        refreshUI();
        updateResearchModalUI();
    }
}

function applyUpgradeEffects(key) {
    if (key === 'reinforced_masonry') {
        for (let ty = 0; ty < sim.grid.height; ty++) {
            for (let tx = 0; tx < sim.grid.width; tx++) {
                const s = sim.grid.structures[ty][tx];
                if (s) {
                    if (s.def.key === 'wall') {
                        s.hp = (s.hp ?? 100) + 100;
                    } else if (s.def.key === 'gate') {
                        s.hp = (s.hp ?? 250) + 100;
                    }
                }
            }
        }
    } else if (key === 'heavy_armor') {
        for (const k of knights) {
            k.maxHp = 200;
            k.hp += 50;
        }
    } else if (key === 'crop_rotation') {
        refreshUI();
    } else if (key === 'ballistic_engineering') {
        rebuildStructureLists();
    }
}


// ===================== DIPLOMACY MODAL =====================
export function showDiplomacyModal(event) {
    const modal = document.getElementById('diplomacy-modal');
    if (!modal) return;
    document.getElementById('diplomacy-desc').textContent = event.description;
    const btnA = document.getElementById('diplomacy-option-a');
    const btnB = document.getElementById('diplomacy-option-b');
    btnA.innerHTML = `<span class="dipl-label">${event.optionA.label}</span><span class="dipl-cost">${event.optionA.cost}</span>`;
    btnB.innerHTML = `<span class="dipl-label">${event.optionB.label}</span><span class="dipl-cost">${event.optionB.cost}</span>`;
    btnA.onclick = () => chooseDiplomacyOption('A');
    btnB.onclick = () => chooseDiplomacyOption('B');
    modal.classList.add('open');
}

function chooseDiplomacyOption(opt) {
    if (!sim.incidentManager || !sim.incidentManager.active || sim.incidentManager.active.type !== 'diplomacy') return;
    const event = sim.incidentManager.active.event;
    const choice = opt === 'A' ? event.optionA : event.optionB;
    choice.apply();
    sim.incidentManager._endIncident();
    sim.gameIsPaused = false;
    const modal = document.getElementById('diplomacy-modal');
    if (modal) modal.classList.remove('open');
    refreshUI();
}

// ===================== BUILDING CLICK PANELS =====================
export function closeBuildingPanel() {
    sim.buildingPanelOpen = false;
    const panel = document.getElementById('building-panel');
    if (panel) panel.classList.remove('open');
}

function openBuildingPanel(tx, ty) {
    let s = sim.grid.structures[ty]?.[tx];
    if (!s) return;
    if (s.isChild) {
        tx = s.parentX;
        ty = s.parentY;
        s = sim.grid.structures[ty]?.[tx];
    }
    if (!s || !BUILDINGS[s.def.key]) return;

    const panel = document.getElementById('building-panel');
    if (!panel) return;

    sim.buildingPanelTX = tx;
    sim.buildingPanelTY = ty;
    sim.buildingPanelOpen = true;

    const bKey = s.def.key;
    const k2 = `${tx},${ty}`;
    const isT2 = !!sim.tier2Upgrades[k2];
    const seasonIdx = SEASONS.indexOf(gameState.season);

    document.getElementById('building-panel-name').textContent = BUILDINGS[bKey]?.label || bKey;

    const statsLines = [];
    if (s.hp !== undefined) statsLines.push(`HP: ${Math.ceil(s.hp)} / ${getMaxHP(bKey, tx, ty)}`);
    // Staffing readout for workplaces — answers "why is this farm idle?"
    const _panelJobFor = { farm: 'farmer', lumberyard: 'woodcutter', quarry: 'stone_miner', mine: 'iron_miner' }[bKey];
    if (_panelJobFor && s.def.maxWorkers) {
        const workerCount = citizens.filter(c => c.job === _panelJobFor && c._workTX === tx && c._workTY === ty).length;
        statsLines.push(`Workers: ${workerCount} / ${s.def.maxWorkers}`);
    }
    if (bKey === 'farm') {
        const passive = window.PRODUCTION_BALANCE?.farmPassiveFoodPerCycle ?? 1;
        const cycleSec = window.PRODUCTION_BALANCE?.farmCycleSec ?? 2.0;
        const farmBaseFood = window.PRODUCTION_BALANCE?.farmBaseFoodPerCycle ?? 6;
        const base = farmBaseFood * SEASON_MODIFIERS[seasonIdx].foodYieldMult;
        const crop = gameState.upgrades?.crop_rotation ? 2 : 0;
        const passiveCrop = gameState.upgrades?.crop_rotation ? 0.5 : 0;
        const adj  = getAdjacencyBonus(tx, ty, 'farm');
        const t2   = isT2 ? 2 : 0;
        statsLines.push(`Passive: +${(passive + passiveCrop).toFixed(1)} / ${cycleSec.toFixed(0)}s`);
        statsLines.push(`Food: +${(base + crop + adj + t2).toFixed(1)} / 2s`);
        if (adj > 0) statsLines.push(`Adj bonus: +${adj.toFixed(1)} food`);
    } else if (bKey === 'lumberyard') {
        const base = 10 * SEASON_MODIFIERS[seasonIdx].woodYieldMult;
        const adj  = getAdjacencyBonus(tx, ty, 'lumberyard');
        const t2   = isT2 ? 2 : 0;
        statsLines.push(`Wood: +${(base + adj + t2).toFixed(1)} / trip`);
        if (adj > 0) statsLines.push(`Adj bonus: +${adj.toFixed(0)} wood`);
    } else if (bKey === 'quarry') {
        const adj  = getAdjacencyBonus(tx, ty, 'quarry');
        statsLines.push(`Stone: +${10 + adj} / trip`);
        if (adj > 0) statsLines.push(`Adj bonus: +${adj.toFixed(0)} stone`);
    } else if (bKey === 'mine') {
        const adj  = getAdjacencyBonus(tx, ty, 'mine');
        const t2   = isT2 ? 2 : 0;
        statsLines.push(`Iron: +${10 + adj + t2} / trip`);
        if (adj > 0) statsLines.push(`Adj bonus: +${adj.toFixed(0)} iron`);
    } else if (bKey === 'granary') {
        statsLines.push(`Food cap: +${isT2 ? 350 : 200}`);
    } else if (bKey === 'barracks') {
        const solCost = Math.round((window.UNIT_BALANCE?.soldier?.goldCost ?? 40) * (sim.soldierCostMult || 1));
        statsLines.push(`Trains soldiers (${solCost}G)`);
        // Same bonus stack as main.js trainSoldier so the panel never goes stale.
        let _solHp = window.UNIT_BALANCE?.soldier?.baseHp ?? 100;
        if (gameState.upgrades?.iron_discipline) _solHp += window.UNIT_BALANCE?.soldier?.ironDisciplineHpBonus ?? 25;
        if (isT2) _solHp += window.UNIT_BALANCE?.soldier?.barracksTier2HpBonus ?? 25;
        statsLines.push(`Soldier HP: ${_solHp}`);
    } else if (bKey === 'tower') {
        const _towerCB = window.COMBAT_BALANCE?.tower;
        const _watchBonus = gameState.upgrades?.watchtowers ? 2 : 0;
        statsLines.push(`Range: ${(isT2 ? (_towerCB?.tier2RangeTiles ?? 10) : (_towerCB?.rangeTiles ?? 8)) + _watchBonus} tiles`);
        statsLines.push(`Damage: ${isT2 ? (_towerCB?.tier2Damage ?? 20) : (_towerCB?.damage ?? 15)} / shot`);
    } else if (bKey === 'ballista_tower') {
        const _bt = (sim.activeBallistaTowers || []).find(e => e.tx === tx && e.ty === ty);
        const _bRange = _bt?.range ?? 16;
        const _bDmg = _bt?.damage ?? 75;
        const _bInt = window.COMBAT_BALANCE?.ballista?.fireIntervalSec ?? 8.0;
        statsLines.push(`Range: ${_bRange} tiles`);
        statsLines.push(`Damage: ${_bDmg} / bolt`);
        statsLines.push(`Fires every ${_bInt}s`);
    } else if (bKey === 'house') {
        statsLines.push(`Housing: +${isT2 ? 6 : (s.def.housing || 4)}`);
    } else if (bKey === 'tavern') {
        const adj = getAdjacencyBonus(tx, ty, 'tavern');
        statsLines.push(`Happiness bonus`);
        if (adj > 0) statsLines.push(`Adj bonus: +${adj} happiness`);
    } else if (bKey === 'wall' || bKey === 'gate') {
        // Walls/gates always report HP (the generic line above covers damaged
        // ones; this covers the undamaged case where hp may be undefined).
        if (s.hp === undefined) statsLines.push(`HP: ${getMaxHP(bKey, tx, ty)} / ${getMaxHP(bKey, tx, ty)}`);
    }

    document.getElementById('building-panel-stats').innerHTML = statsLines.map(l => `<div>${l}</div>`).join('');

    const upgradeBtn = document.getElementById('building-panel-upgrade');
    const upgCfg = TIER2_UPGRADES[bKey];
    if (upgCfg && !isT2) {
        const parts = [];
        if (upgCfg.goldCost)  parts.push(`${upgCfg.goldCost}G`);
        if (upgCfg.woodCost)  parts.push(`${upgCfg.woodCost}W`);
        if (upgCfg.stoneCost) parts.push(`${upgCfg.stoneCost}S`);
        upgradeBtn.textContent = `▲ ${upgCfg.name}: ${parts.join(' ')}`;
        upgradeBtn.disabled = false;
        upgradeBtn.classList.remove('hidden', 'panel-btn-upgraded');
        upgradeBtn.onclick = () => {
            const ptx = sim.buildingPanelTX, pty = sim.buildingPanelTY;
            const cfg = TIER2_UPGRADES[sim.grid.structures[pty]?.[ptx]?.def.key];
            if (!cfg) return;
            if (gameState.gold < cfg.goldCost || gameState.wood < cfg.woodCost || gameState.stone < cfg.stoneCost) {
                spawnFloat(ptx * TILE_SIZE + TILE_SIZE / 2, pty * TILE_SIZE, 'Insufficient resources!', '#ff4444', 1.2);
                return;
            }
            gameState.gold  -= cfg.goldCost;
            gameState.wood  -= cfg.woodCost;
            gameState.stone -= cfg.stoneCost;
            sim.tier2Upgrades[`${ptx},${pty}`] = true;
            // Stone Rampart / Iron-Bound Gate raise max HP — heal the bonus now.
            const _upgS = sim.grid.structures[pty]?.[ptx];
            if (_upgS && _upgS.hp !== undefined) {
                if (_upgS.def.key === 'wall') _upgS.hp += 100;
                else if (_upgS.def.key === 'gate') _upgS.hp += 150;
            }
            rebuildStructureLists();
            refreshUI();
            flashAutosave();
            closeBuildingPanel();
        };
    } else if (upgCfg && isT2) {
        upgradeBtn.textContent = '✓ Tier 2 Applied';
        upgradeBtn.disabled = true;
        upgradeBtn.classList.remove('hidden');
        upgradeBtn.classList.add('panel-btn-upgraded');
        upgradeBtn.onclick = null;
    } else {
        upgradeBtn.classList.add('hidden');
    }

    const demolishBtn = document.getElementById('building-panel-demolish');
    demolishBtn.onclick = () => {
        const ptx = sim.buildingPanelTX, pty = sim.buildingPanelTY;
        const ds = sim.grid.structures[pty]?.[ptx];
        closeBuildingPanel();
        if (ds && BUILDINGS[ds.def.key]) {
            const dw = ds.def.width || 1;
            const dh = ds.def.height || 1;
            gameState.gold    += Math.floor(getScaledCost(ds.def.key) * 0.5);
            if (ds.def.key === 'house') gameState.housesBuilt = Math.max(0, (gameState.housesBuilt || 0) - 1);
            else if (ds.def.key === 'farm') gameState.farmsBuilt = Math.max(0, (gameState.farmsBuilt || 0) - 1);
            gameState.housing = Math.max(0, gameState.housing - (ds.def.housing || 0));
            delete sim.tier2Upgrades[`${ptx},${pty}`];
            sim.grid.demolish(ptx, pty);
            sim.grid.structures[pty][ptx] = { def: RUBBLE_DEF, decayTimer: DAY_DURATION };
            playDemolishSFX();
            patchStaticCache(ptx, pty, dw, dh);
            rebuildStructureLists();
            refreshUI();
        }
    };

    // Position panel near the tile, clamped to viewport
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width  / canvas.width;
    const scaleY = rect.height / canvas.height;
    const canvasPxX = (tx * TILE_SIZE + TILE_SIZE) * sim.camera.zoom - sim.camera.x * sim.camera.zoom;
    const canvasPxY = (ty * TILE_SIZE)             * sim.camera.zoom - sim.camera.y * sim.camera.zoom;
    const viewX = rect.left + canvasPxX * scaleX + 8;
    const viewY = rect.top  + canvasPxY * scaleY;

    panel.style.left = Math.min(Math.max(viewX, 4), window.innerWidth  - 210) + 'px';
    panel.style.top  = Math.min(Math.max(viewY, 4), window.innerHeight - 220) + 'px';
    panel.classList.add('open');
}

// ===================== LEADERBOARD & SCORE =====================
export // ===================== HIGH SCORE LEADERBOARD =====================
const LEADERBOARD_KEY = 'pixel_dominion_highscores';

// Player-typed names are rendered via innerHTML — escape them (stored XSS guard)
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getHighScores() {
    try {
        const raw = localStorage.getItem(LEADERBOARD_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

function saveHighScores(scores) {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores.slice(0, 5)));
}

function isHighScore(score) {
    const scores = getHighScores();
    if (scores.length < 5) return true;
    return score > scores[scores.length - 1].score;
}

function addHighScoreEntry(name, score, day, raiders, gold) {
    const scores = getHighScores();
    scores.push({ name, score, day, raiders, gold, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    saveHighScores(scores);
    updateLeaderboardDisplays();
}

function updateLeaderboardDisplays() {
    const scores = getHighScores();
    
    const body = document.getElementById('leaderboard-body');
    if (body) {
        body.innerHTML = scores.map((s, i) => `<tr>
            <td>${i + 1}</td>
            <td class="highlight">${escapeHtml(s.name)}</td>
            <td>${s.day}</td>
            <td>${s.raiders}</td>
            <td>${s.gold}</td>
            <td class="highlight">${s.score}</td>
        </tr>`).join('');
        for (let i = scores.length; i < 5; i++) {
            body.innerHTML += `<tr>
                <td>${i + 1}</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
            </tr>`;
        }
    }
    
    const startBody = document.getElementById('start-leaderboard-body');
    if (startBody) {
        startBody.innerHTML = scores.map((s, i) => `<tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(s.name)}</td>
            <td>${s.day}</td>
            <td>${s.raiders}</td>
            <td>${s.gold}</td>
            <td>${s.score}</td>
        </tr>`).join('');
        for (let i = scores.length; i < 5; i++) {
            startBody.innerHTML += `<tr>
                <td>${i + 1}</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
            </tr>`;
        }
    }
}

export function calculateCurrentScore() {
    const days = gameState.day || 1;
    const raiders = gameState.raidersDefeated || 0;
    const gold = gameState.gold || 0;
    return Math.round(days * 100 + raiders * 20 + gold * 0.1);
}

export function triggerVictory(reason = 'default') {
    gameState.victoryAchieved = true; // guard: never re-trigger per frame
    sim.gameIsPaused = true;
    playVictorySFX();
    // Victory offers CONTINUE REIGN (endless mode)
    document.getElementById('game-over-continue')?.classList.remove('hidden');
    
    const days = gameState.day || 1;
    const citizenCount = citizens.length;
    const raidersCount = gameState.raidersDefeated || 0;
    const gold = gameState.gold || 0;
    const finalScore = calculateCurrentScore();
    
    const titleEl = document.getElementById('game-over-title');
    const subtitleEl = document.getElementById('game-over-subtitle');
    const sealEl = document.getElementById('game-over-seal');
    const statsEl = document.getElementById('game-over-stats');
    const victoryMessages = {
        monument: {
            subtitle: 'The Monument is complete. Your dominion will be remembered.',
            condition: 'Monument completed',
        },
        wave10: {
            subtitle: 'Wave 10 has broken against your defenses. The final raid is survived.',
            condition: 'Wave 10 survived',
        },
        wave10_breached: {
            subtitle: 'The final raid breached your walls, yet your dominion endures.',
            condition: 'Wave 10 endured',
        },
        default: {
            subtitle: 'Your dominion stands triumphant.',
            condition: 'Victory achieved',
        },
    };
    const victory = victoryMessages[reason] || victoryMessages.default;
    
    if (titleEl) titleEl.textContent = "VICTORY ACHIEVED!";
    if (subtitleEl) subtitleEl.textContent = victory.subtitle;
    if (sealEl) {
        sealEl.textContent = "✺";
        sealEl.className = "game-over-wax-seal victory";
    }
    
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="modal-body-line">Victory Condition: <strong>${victory.condition}</strong></div>
            <div class="modal-body-line">Days Survived: <strong>${days}</strong></div>
            <div class="modal-body-line">Total Citizens: <strong>${citizenCount}</strong></div>
            <div class="modal-body-line">Raiders Defeated: <strong>${raidersCount}</strong></div>
            <div class="modal-body-line">Gold in Vault: <strong>${gold}◈</strong></div>
            <div class="modal-body-line">Final Score: <strong>${finalScore}</strong></div>
        `;
    }
    
    const entryPanel = document.getElementById('leaderboard-entry-panel');
    if (isHighScore(finalScore)) {
        if (entryPanel) entryPanel.classList.remove('hidden');
        const nameInput = document.getElementById('leaderboard-name-input');
        if (nameInput) {
            nameInput.value = "";
            nameInput.placeholder = "King/Queen " + Math.floor(Math.random() * 8999 + 1000);
        }
    } else {
        if (entryPanel) entryPanel.classList.add('hidden');
    }
    
    updateLeaderboardDisplays();
    document.getElementById('game-over-modal').classList.add('open');
    runHook('gameOver', { victory: true });
}

function triggerDefeat() {
    sim.gameIsPaused = true;
    playDefeatSFX();
    // No continuing from a total collapse
    document.getElementById('game-over-continue')?.classList.add('hidden');
    
    const days = gameState.day || 1;
    const raidersCount = gameState.raidersDefeated || 0;
    const gold = gameState.gold || 0;
    const finalScore = calculateCurrentScore();
    
    const titleEl = document.getElementById('game-over-title');
    const subtitleEl = document.getElementById('game-over-subtitle');
    const sealEl = document.getElementById('game-over-seal');
    const statsEl = document.getElementById('game-over-stats');
    
    if (titleEl) titleEl.textContent = "DOMINION FALLEN!";
    if (subtitleEl) subtitleEl.textContent = "Total collapse: no citizens or defenders remain to carry the dominion forward.";
    if (sealEl) {
        sealEl.textContent = "✗";
        sealEl.className = "game-over-wax-seal defeat";
    }
    
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="modal-body-line">Defeat Cause: <strong>Total collapse</strong></div>
            <div class="modal-body-line">Days Survived: <strong>${days}</strong></div>
            <div class="modal-body-line">Raiders Defeated: <strong>${raidersCount}</strong></div>
            <div class="modal-body-line">Gold Gathered: <strong>${gold}◈</strong></div>
            <div class="modal-body-line">Final Score: <strong>${finalScore}</strong></div>
        `;
    }
    
    const entryPanel = document.getElementById('leaderboard-entry-panel');
    if (isHighScore(finalScore)) {
        if (entryPanel) entryPanel.classList.remove('hidden');
        const nameInput = document.getElementById('leaderboard-name-input');
        if (nameInput) {
            nameInput.value = "";
            nameInput.placeholder = "King/Queen " + Math.floor(Math.random() * 8999 + 1000);
        }
    } else {
        if (entryPanel) entryPanel.classList.add('hidden');
    }
    
    updateLeaderboardDisplays();
    document.getElementById('game-over-modal').classList.add('open');
    runHook('gameOver', { victory: false });
}


// ===================== RAID HUD =====================
// Runs every frame — cache DOM nodes and last-written strings so identical
// frames produce zero DOM mutations (textContent writes always replace the node).
const _raidHudEls = {};
const _raidHudCache = {};
function _hudEl(id) {
    if (!(id in _raidHudEls)) _raidHudEls[id] = document.getElementById(id);
    return _raidHudEls[id];
}
function _hudText(id, text) {
    const el = _hudEl(id);
    if (el && _raidHudCache[id] !== text) { _raidHudCache[id] = text; el.textContent = text; }
}
function _hudClass(id, cls, on) {
    const el = _hudEl(id);
    const key = id + '.' + cls;
    if (el && _raidHudCache[key] !== on) { _raidHudCache[key] = on; el.classList.toggle(cls, on); }
}

export function updateRaidHUD() {
    const finalRaidWave = window.FINAL_RAID_WAVE ?? 10;
    const endless = !!window.gameState?.endless;
    const waveNum = endless ? (sim.raidCount ?? 0) + 1 : Math.min((sim.raidCount ?? 0) + 1, finalRaidWave);
    _hudText('raid-wave-indicator', endless
        ? `WAVE ${waveNum}/∞`
        : `WAVE ${waveNum}/${finalRaidWave}${waveNum === finalRaidWave ? ' FINAL' : ''}`);
    if (sim.raidActive) {
        _hudText('res-raid-timer', formatTime(sim.raidActiveTimer));
        _hudText('raid-eyebrow', '⚔ RAID ⚔');
        _hudClass('raid-warning', 'active', true);
        _hudClass('raid-scroll', 'warning', true);
    } else if (sim.scoutPhase) {
        _hudText('res-raid-timer', formatTime(sim.scoutTimer));
        _hudClass('raid-warning', 'active', true);
        _hudClass('raid-scroll', 'warning', true);
        _hudText('raid-eyebrow', '⚑ SCOUTS SPOTTED ⚑');
    } else if (sim.raidQueued) {
        // Queued for dusk — live countdown to dusk (dayTimer 42) instead of a
        // frozen 00:00, so the player can see the raid is still coming.
        _hudText('res-raid-timer', formatTime(Math.max(0, 42 - (sim.dayTimer ?? 0))));
        _hudClass('raid-warning', 'active', true);
        _hudClass('raid-scroll', 'warning', true);
        _hudText('raid-eyebrow', '⚑ RAID AT DUSK ⚑');
    } else {
        _hudText('res-raid-timer', formatTime(sim.raidTimer));
        const isWarn = !sim.gameIsPaused && sim.raidTimer <= 30 && sim.raidTimer > 0;
        _hudClass('raid-warning', 'active', isWarn);
        _hudClass('raid-scroll', 'warning', isWarn);
        _hudText('raid-eyebrow', isWarn ? '⚔ RAID APPROACHES ⚔' : 'NEXT RAID');
        if (isWarn) {
            if (!sim.raidWarningPlayed) { sim.raidWarningPlayed = true; playRaidWarningSFX(); }
        } else {
            if (sim.raidTimer > 30 || sim.raidTimer <= 0) sim.raidWarningPlayed = false;
        }
    }
}


// ===================== GENERIC MODAL =====================
export function showModal(isVictory, lines) {
    sim.eventLog.push({ day: gameState.day, season: gameState.season, title: isVictory ? 'RAID REPELLED' : 'RAID LOST', desc: lines.slice(0, 4).join(' · ') });
    if (sim.eventLog.length > 80) sim.eventLog.splice(0, sim.eventLog.length - 80);
    sim.gameIsPaused = true;
    const sealEl     = document.getElementById('raid-seal');
    const titleEl    = document.getElementById('modal-title');
    const subtitleEl = document.getElementById('raid-subtitle');
    const bodyEl     = document.getElementById('modal-body');
    if (sealEl) {
        sealEl.textContent = isVictory ? '✚' : '✗';
        sealEl.className = 'raid-wax-seal ' + (isVictory ? 'victory' : 'defeat');
    }
    if (titleEl) {
        titleEl.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
        titleEl.className = 'raid-modal-title ' + (isVictory ? 'victory' : 'defeat');
    }
    if (subtitleEl) {
        subtitleEl.textContent = isVictory
            ? 'Your walls held strong against the raiders.'
            : 'The gate has fallen. Rebuild what you can.';
    }
    if (bodyEl) bodyEl.innerHTML = lines.map(l => `<div class="modal-body-line">${l}</div>`).join('');
    document.getElementById('raid-modal').classList.add('open');
    stopRaidWarningSFX();
    playRaidResultSFX(isVictory);
}


// ===================== TIME HUD =====================
export function updateTimePauseUI() {
    const pauseOverlay = document.getElementById('pause-overlay');
    const btnPause = document.getElementById('btn-pause');
    const btnDbl = document.getElementById('btn-doubletime');
    if (pauseOverlay) pauseOverlay.classList.toggle('active', sim.userPaused);
    if (btnPause) { btnPause.textContent = sim.userPaused ? '▶' : '⏸'; btnPause.classList.toggle('active', sim.userPaused); }
    if (btnDbl) {
        btnDbl.classList.toggle('active', sim.timeScale > 1);
        btnDbl.textContent = '×' + (sim.timeScale || 1);
    }
}
document.getElementById('btn-pause').addEventListener('click', () => {
    if (!gameState.started || sim.gameIsPaused) return;
    sim.userPaused = !sim.userPaused;
    updateTimePauseUI();
});
document.getElementById('btn-doubletime').addEventListener('click', () => {
    sim.timeScale = sim.timeScale >= 3 ? 1 : (sim.timeScale || 1) + 1;
    updateTimePauseUI();
});


// ===================== RESOURCE BAR & BUILD MENU =====================
export // --- UI ---
function updateResourceUI() {
    // Cache last-written values so unchanged chips produce no DOM mutations
    const cache = updateResourceUI._cache || (updateResourceUI._cache = {});
    const set = (id, text, cls) => {
        const el = document.getElementById(id);
        if (!el) return;
        const t = String(text);
        if (cache[id] !== t) { cache[id] = t; el.textContent = t; }
        if (cls !== undefined) {
            const cn = 'chip-value' + (cls ? ' ' + cls : '');
            if (cache[id + '.c'] !== cn) { cache[id + '.c'] = cn; el.className = cn; }
        }
    };
    set('res-gold',      `${Math.round(gameState.gold)}`, 'treasure');
    set('res-housing',   gameState.housing);
    set('res-defense',   gameState.defense);
    set('res-citizens',  `${citizens.length} / ${gameState.housing}`);
    set('res-soldiers',  soldiers.length);
    const archersEl = document.getElementById('res-archers');
    const knightsEl = document.getElementById('res-knights');
    if (archersEl) archersEl.textContent = archers.length;
    if (knightsEl) knightsEl.textContent = knights.length;
    const foodSt = gameState.food < 10 ? 'critical' : gameState.food < gameState.population ? 'low' : gameState.food > gameState.population * 3 ? 'healthy' : '';
    const foodDisplay = `${Math.round(gameState.food)}`;
    set('res-food',      `${foodDisplay} / ${getFoodCap()}`, foodSt);
    const hapSt = gameState.happiness < 30 ? 'critical' : gameState.happiness < 60 ? 'low' : 'healthy';
    set('res-happiness', `${Math.round(gameState.happiness)}%`, hapSt);
    const happyIconEl = document.querySelector('.happy-icon');
    if (happyIconEl) happyIconEl.textContent = gameState.happiness < 50 ? '☹' : '♥';
    const woodEl  = document.getElementById('res-wood');
    const stoneEl = document.getElementById('res-stone');
    const ironEl  = document.getElementById('res-iron');
    if (woodEl)  { woodEl.textContent  = Math.round(gameState.wood);  woodEl.className  = 'chip-value' + (gameState.wood  < 20 ? ' low' : ''); }
    if (stoneEl) { stoneEl.textContent = Math.round(gameState.stone); stoneEl.className = 'chip-value' + (gameState.stone < 10 ? ' low' : ''); }
    if (ironEl)  { ironEl.textContent  = Math.round(gameState.iron);  ironEl.className  = 'chip-value' + (gameState.iron  === 0 ? ' critical' : ''); }
}

// ===================== BUILD MENU (parchment) =====================
const BUILD_ITEMS = [
    { key: 'house',          name: 'House',          cat: 'civic',    yields: '+4 Housing',    assetKey: 'building_house' },
    { key: 'farm',           name: 'Farm',           cat: 'civic',    yields: '+10 Food',       assetKey: 'building_farm' },
    { key: 'granary',        name: 'Granary',        cat: 'civic',    yields: '+200 Food Cap',  assetKey: 'building_granary' },
    { key: 'tavern',         name: 'Tavern',         cat: 'civic',    yields: '+Happiness',     assetKey: 'building_tavern' },
    { key: 'market',         name: 'Market',         cat: 'civic',    yields: 'Trade anytime',  assetKey: 'building_warehouse' },
    { key: 'road',           name: 'Road',           cat: 'civic',    yields: '2× Speed',       assetKey: 'tile_road' },
    { key: 'academy',        name: 'Academy',        cat: 'civic',    yields: 'Research',       assetKey: 'building_academy' },
    { key: 'monument',       name: 'Monument',       cat: 'civic',    yields: 'Win Game',       assetKey: 'building_monument' },
    { key: 'clear',          name: 'Clear Tree',     cat: 'civic',    yields: '10G / tree',     assetKey: 'obstacle_tree' },
    { key: 'clear_rubble',   name: 'Clear Rubble',   cat: 'civic',    yields: '15G / ruin',     assetKey: 'building_rubble' },
    { key: 'lumberyard',     name: 'Lumber Yard',    cat: 'industry', yields: 'Wood / min',     assetKey: 'building_lumberyard' },
    { key: 'quarry',         name: 'Quarry',         cat: 'industry', yields: 'Stone / min',    assetKey: 'building_quarry' },
    { key: 'mine',           name: 'Mine',           cat: 'industry', yields: 'Iron / min',     assetKey: 'building_mine' },
    { key: 'wall',           name: 'Wall',           cat: 'military', yields: '+2 Defense',     assetKey: 'building_wall' },
    { key: 'gate',           name: 'Gate',           cat: 'military', yields: '+3 Defense',     assetKey: 'building_gate_open' },
    { key: 'tower',          name: 'Tower',          cat: 'military', yields: '+10 Defense',    assetKey: 'building_tower' },
    { key: 'barracks',       name: 'Barracks',       cat: 'military', yields: 'Train units',    assetKey: 'building_barracks' },
    { key: 'archery_range',  name: 'Archery Range',  cat: 'military', yields: 'Train archers',  assetKey: 'building_archery_range' },
    { key: 'ballista_tower', name: 'Ballista Twr',   cat: 'military', yields: '+15 Defense',    assetKey: 'building_ballistatower' },
    { key: 'train_soldier',  name: 'Train Soldier',  cat: 'military', yields: '+5 DEF',         assetKey: 'citizen_soldier' },
    { key: 'train_archer',   name: 'Train Archer',   cat: 'military', yields: 'Ranged unit',    assetKey: 'citizen_archer' },
    { key: 'train_knight',   name: 'Train Knight',   cat: 'military', yields: 'Heavy unit',     assetKey: 'citizen_knight' },
    { key: 'train_captain',  name: 'Train Captain',  cat: 'military', yields: 'Aura +25% dmg',  assetKey: 'citizen_soldier' },
    { key: 'demolish',       name: 'Demolish',       cat: '_always',  yields: 'Refund 50%',     assetKey: null },
];

let _buildTab = 'all';

function renderBuildMenu(tab) {
    _buildTab = tab || _buildTab;
    document.querySelectorAll('.build-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === _buildTab);
    });
    const itemsEl = document.getElementById('build-items');
    if (!itemsEl) return;
    const visible = BUILD_ITEMS.filter(item => {
        if (_buildTab === 'all' || item.cat === '_always') return true;
        return item.cat === _buildTab;
    });
    itemsEl.innerHTML = visible.map(item => {
        const def = BUILDINGS[item.key];
        const hotkeyIdx = window._BUILD_SHORTCUT_TOOLS.indexOf(item.key);
        const hotkey = item.key === 'demolish' ? '0'
            : (hotkeyIdx >= 0 ? String(hotkeyIdx + 1) : '');
        const UB = window.UNIT_BALANCE;
        const soldierCost = Math.round((UB?.soldier?.goldCost ?? 40) * (sim.soldierCostMult || 1));
        const specialCosts = {
            clear: [10,0,0,0], clear_rubble: [15,0,0,0], road: [ROAD_COST,0,0,0], demolish: [0,0,0,0],
            train_soldier: [soldierCost,0,0,0],
            train_archer: [UB?.archer?.goldCost ?? 40,0,0,0],
            train_knight: [UB?.knight?.goldCost ?? 60,0,UB?.knight?.ironCost ?? 20,0],
            train_captain: [UB?.captain?.goldCost ?? 150,0,UB?.captain?.ironCost ?? 30,0],
        };
        let cost, woodCost, ironCost, stoneCost;
        if (def) {
            cost = getScaledCost(item.key); woodCost = def.woodCost || 0; ironCost = def.ironCost || 0; stoneCost = def.stoneCost || 0;
        } else {
            [cost, woodCost, ironCost, stoneCost] = specialCosts[item.key] || [0,0,0,0];
        }
        const parts = [];
        if (cost > 0)      parts.push(`<span class="build-cost-gold">◈ ${cost}</span>`);
        if (woodCost > 0)  parts.push(`<span class="build-cost-wood">◆ ${woodCost}</span>`);
        if (stoneCost > 0) parts.push(`<span class="build-cost-stone">⬟ ${stoneCost}</span>`);
        if (ironCost > 0)  parts.push(`<span class="build-cost-iron">◇ ${ironCost}</span>`);
        return `<div class="build-btn" data-tool="${item.key}">
            ${hotkey ? `<span class="build-hotkey">${hotkey}</span>` : ''}
            <div class="build-sprite-frame"><canvas data-asset="${item.assetKey || ''}" width="28" height="28"></canvas></div>
            <div class="build-item-text">
                <div class="build-item-name">${item.name}</div>
                <div class="build-item-costs">${parts.join('')}</div>
            </div>
            <div class="build-item-yield">${item.yields}</div>
        </div>`;
    }).join('');
    itemsEl.querySelectorAll('canvas[data-asset]').forEach(cv => {
        // Tiny Swords icon when one is mapped for this tool, else the old icon.
        const tool = cv.closest('.build-btn')?.dataset.tool;
        // Roads use the sand centre tile cropped from tilemap_flat.png.
        if (tool === 'road' && hasTerrain() && drawRoadIcon(cv)) return;
        const spr = tool ? ICON_FOR[tool] : null;
        if (spr && hasSprite(spr) && drawSpriteIcon(cv, spr)) return;
        const key = cv.dataset.asset;
        if (!key || !sim.assets[key]) return;
        const ctx2 = cv.getContext('2d');
        ctx2.imageSmoothingEnabled = false;
        ctx2.drawImage(sim.assets[key], 0, 0, 28, 28);
    });
    updateBuildMenu();
}

export function updateCombatModeUI() {
    const defendBtn = document.getElementById('btn-defend-mode');
    const attackBtn = document.getElementById('btn-attack-mode');
    if (!defendBtn || !attackBtn) return;
    const mode = sim.combatMode || 'defend';
    defendBtn.classList.toggle('active', mode === 'defend');
    attackBtn.classList.toggle('active', mode === 'attack');
    defendBtn.setAttribute('aria-pressed', mode === 'defend' ? 'true' : 'false');
    attackBtn.setAttribute('aria-pressed', mode === 'attack' ? 'true' : 'false');
}

export function _updateDayPhaseGlyph() {
    const el = document.getElementById('day-phase-glyph');
    if (!el) return;
    const data = { dawn: { g: '🌅', c: '#f4a460' }, day: { g: '☀', c: '#ffd700' }, dusk: { g: '🌇', c: '#ff8c00' }, night: { g: '🌙', c: '#aaaaff' } };
    const d = data[sim.dayPhase];
    if (d) { el.textContent = d.g; el.style.color = d.c; }
}

export function updateDaySeason() {
    const seasonGlyphs = { Spring: '✿', Summer: '☀', Autumn: '✦', Winter: '❄' };
    const seasonColors = { Spring: '#4a6b2a', Summer: '#d4a838', Autumn: '#a8521c', Winter: '#7a9ab0' };
    const s = gameState.season || 'Spring';
    const dayEl   = document.getElementById('day-num');
    const glyphEl = document.getElementById('season-glyph');
    const nameEl  = document.getElementById('season-name');
    if (dayEl)   dayEl.textContent = gameState.day || 1;
    if (glyphEl) { glyphEl.textContent = seasonGlyphs[s] || '✿'; glyphEl.style.color = seasonColors[s] || '#4a6b2a'; }
    if (nameEl)  nameEl.textContent = s;
}

function updateBuildMenu() {
    // WHY-titles explain disabled buttons; only touch the DOM when changed (runs often).
    const setDis = (btn, dis, reason) => {
        btn.disabled = dis;
        btn.classList.toggle('disabled', dis);
        const t = dis ? (reason || '') : '';
        if (btn.title !== t) btn.title = t;
    };
    const shorts = (pairs) => {
        // pairs: [[have, need, label], ...] → "Need 35 more gold, 10 more iron"
        const missing = [];
        for (const [have, need, label] of pairs) {
            if (have < need) missing.push(`${Math.ceil(need - have)} more ${label}`);
        }
        return missing.length ? `Need ${missing.join(', ')}` : '';
    };
    const NO_IDLE = 'No idle folk — build houses or free up workers';
    document.querySelectorAll('#build-items .build-btn').forEach(btn => {
        const tool = btn.dataset.tool;
        btn.classList.toggle('active', tool === gameState.selectedTool);
        if (tool === 'demolish') { setDis(btn, false, ''); return; }
        if (tool === 'clear')        { const c = gameState.gold < 10;  setDis(btn, c, shorts([[gameState.gold, 10, 'gold']])); return; }
        if (tool === 'clear_rubble') { const c = gameState.gold < 15;  setDis(btn, c, shorts([[gameState.gold, 15, 'gold']])); return; }
        if (tool === 'road')         { const c = gameState.gold < ROAD_COST; setDis(btn, c, shorts([[gameState.gold, ROAD_COST, 'gold']])); return; }
        if (tool === 'train_soldier') {
            // Cost reflects the diplomacy soldier-price penalty (_soldierCostMult);
            // previously the button enabled at 40G while trainSoldier() silently
            // required 60G during the penalty.
            const solCost = Math.round((window.UNIT_BALANCE?.soldier?.goldCost ?? 40) * (sim.soldierCostMult || 1));
            const costsEl = btn.querySelector('.build-item-costs');
            if (costsEl) {
                const html = `<span class="build-cost-gold">◈ ${solCost}</span>`;
                if (costsEl.dataset.cache !== html) { costsEl.dataset.cache = html; costsEl.innerHTML = html; }
            }
            // Most fundamental reason first: structure → idle folk → resources.
            if (countBuildings('barracks') <= 0) { setDis(btn, true, 'Build a Barracks first'); return; }
            if (!citizens.some(ci => ci.job === 'idle')) { setDis(btn, true, NO_IDLE); return; }
            const c = !(gameState.gold >= solCost);
            setDis(btn, c, shorts([[gameState.gold, solCost, 'gold']])); return;
        }
        if (tool === 'train_archer') {
            const archCost = window.UNIT_BALANCE?.archer?.goldCost ?? 40;
            if (countBuildings('archery_range') <= 0) { setDis(btn, true, 'Build an Archery Range first'); return; }
            if (!citizens.some(ci => ci.job === 'idle')) { setDis(btn, true, NO_IDLE); return; }
            const c = !(gameState.gold >= archCost);
            setDis(btn, c, shorts([[gameState.gold, archCost, 'gold']])); return;
        }
        if (tool === 'train_knight') {
            const kGold = window.UNIT_BALANCE?.knight?.goldCost ?? 60;
            const kIron = window.UNIT_BALANCE?.knight?.ironCost ?? 20;
            if (countBuildings('barracks') <= 0) { setDis(btn, true, 'Build a Barracks first'); return; }
            if (!citizens.some(ci => ci.job === 'idle')) { setDis(btn, true, NO_IDLE); return; }
            const c = !(gameState.gold >= kGold && gameState.iron >= kIron);
            setDis(btn, c, shorts([[gameState.gold, kGold, 'gold'], [gameState.iron, kIron, 'iron']])); return;
        }
        if (tool === 'train_captain') {
            const cGold = window.UNIT_BALANCE?.captain?.goldCost ?? 150;
            const cIron = window.UNIT_BALANCE?.captain?.ironCost ?? 30;
            const hasCaptain = soldiers.some(s => s.isCaptain);
            if (hasCaptain) { setDis(btn, true, 'Only one Captain per city'); }
            else if (countBuildings('barracks') <= 0) { setDis(btn, true, 'Build a Barracks first'); }
            else if (!citizens.some(ci => ci.job === 'idle')) { setDis(btn, true, NO_IDLE); }
            else {
                const c = !(gameState.gold >= cGold && gameState.iron >= cIron);
                setDis(btn, c, shorts([[gameState.gold, cGold, 'gold'], [gameState.iron, cIron, 'iron']]));
            }
            const yieldEl = btn.querySelector('.build-item-yield');
            if (yieldEl) {
                const label = hasCaptain ? '✓ Commissioned' : 'Aura +25% dmg';
                if (yieldEl.textContent !== label) yieldEl.textContent = label;
            }
            return;
        }
        const def = BUILDINGS[tool];
        if (!def) return;
        const cost = getScaledCost(tool);
        const woodCost = def.woodCost || 0;
        const ironCost = def.ironCost || 0;
        const stoneCost = def.stoneCost || 0;
        const costsEl = btn.querySelector('.build-item-costs');
        if (costsEl) {
            const parts = [];
            if (cost > 0)      parts.push(`<span class="build-cost-gold">◈ ${cost}</span>`);
            if (woodCost > 0)  parts.push(`<span class="build-cost-wood">◆ ${woodCost}</span>`);
            if (stoneCost > 0) parts.push(`<span class="build-cost-stone">⬟ ${stoneCost}</span>`);
            if (ironCost > 0)  parts.push(`<span class="build-cost-iron">◇ ${ironCost}</span>`);
            // Costs only change when housesBuilt/farmsBuilt scale — skip the
            // innerHTML rebuild (layout work) on the frames where they haven't.
            const newCosts = parts.join('');
            if (costsEl.dataset.cache !== newCosts) {
                costsEl.dataset.cache = newCosts;
                costsEl.innerHTML = newCosts;
            }
        }
        const canAfford = gameState.gold >= cost && gameState.wood >= woodCost && gameState.iron >= ironCost && gameState.stone >= stoneCost;
        setDis(btn, !canAfford, shorts([[gameState.gold, cost, 'gold'], [gameState.wood, woodCost, 'wood'], [gameState.stone, stoneCost, 'stone'], [gameState.iron, ironCost, 'iron']]));
    });
}

export function refreshUI() {
    gameState.defense = calcDefense();
    updateResourceUI();
    updateBuildMenu();
    runHook('uiRefresh');
}

// Build item click (event delegation on container)
document.getElementById('build-items').addEventListener('click', e => {
    const btn = e.target.closest('.build-btn');
    if (!btn || btn.disabled || btn.classList.contains('disabled')) return;
    const tool = btn.dataset.tool;
    if (tool === 'train_soldier') { trainSoldier(); return; }
    if (tool === 'train_archer')  { trainArcher();  return; }
    if (tool === 'train_knight')  { trainKnight();  return; }
    if (tool === 'train_captain') { window.trainCaptain?.(); return; }
    gameState.selectedTool = gameState.selectedTool === tool ? null : tool;
    updateBuildMenu();
});

// Build tab click
document.getElementById('build-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.build-tab');
    if (!tab) return;
    renderBuildMenu(tab.dataset.tab);
});


// ===================== GRASS RENDERING =====================
export function _buildGrassCache() {
    const W = sim.grid.width, H = sim.grid.height, T = TILE_SIZE;
    const oc = document.createElement('canvas');
    oc.width = W * T;
    oc.height = H * T;
    const octx = oc.getContext('2d');
    if (hasTerrain()) {
        // Tiny Swords grass CENTRE tile (1,1), 64→32 downscale with filtering.
        octx.imageSmoothingEnabled = true;
        octx.imageSmoothingQuality = 'high';
        for (let ty = 0; ty < H; ty++) {
            for (let tx = 0; tx < W; tx++) {
                if (sim.grid.tiles[ty][tx] !== 'tile_grass') continue;
                paintGrass(octx, tx * T, ty * T);
            }
        }
        _grassCanvas = oc;
        return;
    }
    octx.imageSmoothingEnabled = false;
    for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
            if (sim.grid.tiles[ty][tx] !== 'tile_grass') continue;
            const r = seededRand(tx * 1000 + ty);
            octx.fillStyle = r() < 0.5 ? '#5e8a3e' : '#658f44';
            octx.fillRect(tx * T, ty * T, T, T);
            for (let i = 0; i < 4; i++) {
                octx.fillStyle = i % 2 === 0 ? '#4a7a30' : '#3f6a28';
                octx.fillRect(tx * T + Math.floor(r() * (T - 4)), ty * T + Math.floor(r() * (T - 4)), 4, 4);
            }
            for (let i = 0; i < 2; i++) {
                octx.fillStyle = i % 2 === 0 ? '#7aa252' : '#88ad60';
                octx.fillRect(tx * T + Math.floor(r() * (T - 4)), ty * T + Math.floor(r() * (T - 4)), 3, 3);
            }
        }
    }
    _grassCanvas = oc;
}


// ===================== RENDERING PIPELINE =====================
// Torch-glow sprite, rendered once and reused every frame
let _glowSprite = null;
function _getGlowSprite() {
    if (_glowSprite) return _glowSprite;
    const c = document.createElement('canvas');
    c.width = 96; c.height = 96;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    grad.addColorStop(0, 'rgba(255,180,60,0.35)');
    grad.addColorStop(1, 'rgba(255,100,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 96);
    _glowSprite = c;
    return c;
}

export function renderWorldOverlay() {
    if (!gameState.started) return;
    const { x: camX, y: camY, zoom } = sim.camera;
    const viewMinX = camX - TILE_SIZE;
    const viewMinY = camY - TILE_SIZE;
    const viewMaxX = camX + canvas.width / zoom + TILE_SIZE;
    const viewMaxY = camY + canvas.height / zoom + TILE_SIZE;
    const isVisibleUnit = u => u.x >= viewMinX && u.x <= viewMaxX && u.y >= viewMinY && u.y <= viewMaxY;
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
    ctx.imageSmoothingEnabled = false;

    for (const p of projectiles) {
        const t = p.timer / p.duration;
        ctx.globalAlpha = Math.max(0, 1.0 - t);
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.moveTo(p.fromX, p.fromY);
        ctx.lineTo(p.toX, p.toY);
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Physics projectiles: bolts keep their tracer; arrows are drawn as Tiny
    // Swords sprites (rotated to the velocity) by the fx feature module.
    for (const p of activeProjectiles) {
        if (p.type === 'arrow') continue;
        const trailX = p.x - p.vx * 0.05;
        const trailVy = p.vy - p.g * 0.05;
        const trailY = p.y - trailVy * 0.05;
        ctx.strokeStyle = p.type === 'bolt' ? '#cc8800' : '#ddaa55';
        ctx.lineWidth = (p.type === 'bolt' ? 3 : 1.5) / zoom;
        ctx.beginPath();
        ctx.moveTo(trailX, trailY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }

    // Gate HP bars now draw in the GameGrid overlay pass (raised with the rest
    // of the structure bars); particles, drought, badges and projectiles below
    // keep their existing order after the sorted pass.

    // Batch particles by type so shared canvas state (fillStyle / strokeStyle / lineWidth /
    // font) is set once per group rather than re-set per particle. globalAlpha still varies
    // per particle. Three linear passes over a small array — no allocation.
    ctx.fillStyle = '#aaaaaa';
    for (const p of particles) {
        if (p.type !== 'puff') continue;
        ctx.globalAlpha = p.alpha;
        const radius = 4 + (p.timer / p.duration) * 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 3 / zoom;
    for (const p of particles) {
        if (p.type !== 'slash') continue;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.moveTo(p.x - 10, p.y - 10);
        ctx.lineTo(p.x + 10, p.y + 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x + 10, p.y - 10);
        ctx.lineTo(p.x - 10, p.y + 10);
        ctx.stroke();
    }
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    for (const p of particles) {
        if (p.type !== 'floating_text') continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color || '#ff2222';
        // Eased rise with slight horizontal drift so stacked hits stay readable
        const t = p.timer / p.duration;
        const ease = 1 - (1 - t) * (1 - t);
        const curY = p.y - ease * 24;
        const curX = p.x + (p.driftX || 0) * ease;
        ctx.fillText(p.text, curX, curY);
    }
    ctx.globalAlpha = 1.0;

    // Soldiers, archers and knights now draw inside the GameGrid depth-sorted
    // pass (with HP bars raised above the taller sprites).

    // Burning buildings now draw as Tiny Swords fire via the fx feature module
    // (renderWorld hook); the old effect_fire tile wash is retired.

    // Drought overlay on farms using activeFarms
    if (sim.droughtActive) {
        const droughtAsset = sim.assets['effect_drought'];
        for (const farm of sim.activeFarms) {
            const { tx, ty } = farm;
            const s = sim.grid.structures[ty]?.[tx];
            if (!s || s.def.key !== 'farm') continue;
            ctx.globalAlpha = 0.65;
            if (droughtAsset) {
                ctx.drawImage(droughtAsset, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = '#7a5220';
                ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // Unstaffed-workplace badges — a "!" over completed farms/lumberyards/
    // quarries/mines with zero assigned workers (suppressed during raids when
    // everyone is hiding, which would flag every workplace at once).
    if (!sim.raidActive && !sim.scoutPhase && sim.jobfulStructures?.length) {
        const _staffJobKeys = { farm: 'farmer', lumberyard: 'woodcutter', quarry: 'stone_miner', mine: 'iron_miner' };
        const staffed = new Set();
        for (const c of citizens) {
            if (c._workTX >= 0 && _staffJobKeys[sim.grid.structures[c._workTY]?.[c._workTX]?.def?.key] === c.job) {
                staffed.add(c._workTX + ',' + c._workTY);
            }
        }
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3 / zoom;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#ffdd57';
        for (const { tx, ty } of sim.jobfulStructures) {
            const s = sim.grid.structures[ty]?.[tx];
            if (!s || (s.progress ?? 1.0) < 1.0) continue;
            if (staffed.has(tx + ',' + ty)) continue;
            const bx = tx * TILE_SIZE + TILE_SIZE / 2;
            const by = ty * TILE_SIZE - 2;
            if (bx < viewMinX || bx > viewMaxX || by < viewMinY || by > viewMaxY) continue;
            ctx.strokeText('!', bx, by);
            ctx.fillText('!', bx, by);
        }
    }

    // Merchant NPC and raider camps now draw inside the GameGrid depth-sorted
    // pass (merchant as a pawn, camps as goblin houses).

    // Raiders now draw inside the GameGrid depth-sorted pass (torch/torch/tnt
    // sprites, victory spin and defeat slide preserved via rotation/alpha).

    runHook('renderWorld', ctx);
    ctx.restore();
}

let _lastSnowTime = 0;

function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hoverTile = sim.grid.screenToGrid(sim.mouseScreenX, sim.mouseScreenY);
    const savedCamX = sim.camera.x, savedCamY = sim.camera.y;
    sim.camera.x += sim.shakeX; sim.camera.y += sim.shakeY;
    sim.grid.render(ctx, sim.assets, { hoverTile, selectedTool: gameState.selectedTool, buildings: ALL_DEFS, citizens });
    renderWorldOverlay();
    sim.camera.x = savedCamX; sim.camera.y = savedCamY;

    // Torch glow — pre-rendered glow sprite drawn additively on towers/gates during
    // dusk/night (replaces a per-tower per-frame createRadialGradient allocation).
    if ((sim.dayPhase === 'night' || sim.dayPhase === 'dusk') && (sim.overlayAlpha > 0.01)) {
        const _glowScale = sim.dayPhase === 'dusk' ? 0.5 : 1.0;
        const { zoom } = sim.camera;
        const camX = savedCamX, camY = savedCamY;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = _glowScale;
        const glow = _getGlowSprite();
        for (const list of [sim.activeTowers, sim.activeGates]) {
            for (const { tx, ty } of list) {
                const sx = (tx * TILE_SIZE + TILE_SIZE / 2) * zoom - camX * zoom;
                const sy = (ty * TILE_SIZE + TILE_SIZE / 2) * zoom - camY * zoom;
                ctx.drawImage(glow, sx - 48, sy - 48);
            }
        }
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }

    // Darkness overlay — screen-space tinted fillRect, alpha lerped in update()
    if (sim.overlayAlpha > 0.001) {
        const _phaseColor = { dawn: '0,0,40', day: null, dusk: '255,100,0', night: '0,0,20' }[sim.dayPhase];
        if (_phaseColor) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = `rgba(${_phaseColor},${sim.overlayAlpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Off-screen raid indicators — red arrows at the screen edge pointing toward
    // raider groups the camera can't see, so the player always knows where the
    // attack is coming from (the map is far larger than the viewport).
    if (sim.raidActive) _drawRaidDirectionArrows();

    // Snow overlay — screen-space, always updated but only drawn in Winter
    if (sim.snowParticles.length > 0) {
        const _drawSnow = SEASON_MODIFIERS[SEASONS.indexOf(gameState.season)].snowOverlay;
        // Time-based fall so speed is identical at any frame rate; frozen while paused
        const now = performance.now();
        const dt = Math.min(0.1, (now - _lastSnowTime) / 1000);
        _lastSnowTime = now;
        const _snowPaused = sim.userPaused || sim.gameIsPaused;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < sim.snowParticles.length; i++) {
            const p = sim.snowParticles[i];
            if (_drawSnow) {
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            if (!_snowPaused) {
                p.y += p.speed * dt * 60;
                p.x += p.drift * dt * 60;
            }
            if (p.y > canvas.height) {
                p.y = -4;
                p.x = Math.random() * canvas.width;
            }
            if (p.x < -4) p.x = canvas.width + 4;
            else if (p.x > canvas.width + 4) p.x = -4;
        }
        ctx.globalAlpha = 1.0;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); runHook('renderScreen', ctx);
}


// Buckets off-screen walking raiders into 8 compass directions (relative to the
// view center) and draws one edge arrow + count per occupied direction.
const _raidArrowBuckets = new Array(8);
function _drawRaidDirectionArrows() {
    const { zoom } = sim.camera;
    const cw = canvas.width, ch = canvas.height;
    const viewCX = sim.camera.x + cw / (2 * zoom);
    const viewCY = sim.camera.y + ch / (2 * zoom);
    _raidArrowBuckets.fill(0);
    let anyOffscreen = false;
    for (const r of raiders) {
        if (r.state !== 'walking') continue;
        const sx = (r.x - sim.camera.x) * zoom;
        const sy = (r.y - sim.camera.y) * zoom;
        if (sx >= 0 && sx <= cw && sy >= 0 && sy <= ch) continue; // visible
        const ang = Math.atan2(r.y - viewCY, r.x - viewCX);
        const bucket = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
        _raidArrowBuckets[bucket]++;
        anyOffscreen = true;
    }
    if (!anyOffscreen) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const inset = 42;
    const halfW = cw / 2 - inset, halfH = ch / 2 - inset;
    for (let b = 0; b < 8; b++) {
        const count = _raidArrowBuckets[b];
        if (!count) continue;
        const ang = b * (Math.PI / 4);
        const dirX = Math.cos(ang), dirY = Math.sin(ang);
        // Ray-box intersection from screen center to the inset screen edge
        const t = Math.min(
            dirX !== 0 ? Math.abs(halfW / dirX) : Infinity,
            dirY !== 0 ? Math.abs(halfH / dirY) : Infinity);
        const px = cw / 2 + dirX * t;
        const py = ch / 2 + dirY * t;
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 250));
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#dd2222';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-8, -9);
        ctx.lineTo(-8, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-ang);
        ctx.globalAlpha = 1.0;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(String(count), 0, -14);
        ctx.fillText(String(count), 0, -14);
        ctx.restore();
    }
}

// Bind to window for global compatibility

// ===================== MISSED CALCULATIONS & UI HELPERS =====================
export function _buildStaticCache() {
    const grid = sim.grid;
    const assets = sim.assets;
    if (!grid || !assets) return;
    const W = grid.width, H = grid.height, T = TILE_SIZE;
    const oc = document.createElement('canvas');
    oc.width = W * T;
    oc.height = H * T;
    const octx = oc.getContext('2d');
    // Filtered downscales (64→32 tilemap art) stay clean; nothing else baked here.
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';

    // Draw grass background from _grassCanvas
    if (_grassCanvas) {
        octx.drawImage(_grassCanvas, 0, 0);
    } else {
        _buildGrassCache();
        if (_grassCanvas) octx.drawImage(_grassCanvas, 0, 0);
    }

    // Terrain only: roads (sand-block autotile) and deco scatter. Structures
    // draw per-frame in the depth-sorted pass so tall sprites can overlap units.
    _paintTerrainInto(octx, 0, 0, W - 1, H - 1);
    _staticCanvas = oc;
}

// Paint grass/roads/deco for a tile rectangle into a static-canvas context.
function _paintTerrainInto(octx, x0, y0, x1, y1) {
    const grid = sim.grid;
    const assets = sim.assets;
    const T = TILE_SIZE;
    const useTinyRoads = hasTerrain();
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const tile = grid.tiles[y][x];
            if (tile === 'tile_road' && useTinyRoads) {
                paintRoad(octx,
                    grid.inBounds(x, y - 1) && grid.tiles[y - 1][x] === 'tile_road',
                    grid.inBounds(x + 1, y) && grid.tiles[y][x + 1] === 'tile_road',
                    grid.inBounds(x, y + 1) && grid.tiles[y + 1][x] === 'tile_road',
                    grid.inBounds(x - 1, y) && grid.tiles[y][x - 1] === 'tile_road',
                    x * T, y * T);
            } else if (tile !== 'tile_grass' && assets[tile]) {
                octx.drawImage(assets[tile], x * T, y * T, T, T);
            } else if (tile !== 'tile_grass' && _grassCanvas) {
                octx.drawImage(_grassCanvas, x * T, y * T, T, T, x * T, y * T, T, T);
            }
            // Deco is purely visual scenery on empty grass tiles.
            const d = grid.deco && grid.deco[y] ? grid.deco[y][x] : 0;
            if (d && tile === 'tile_grass' && !grid.structures[y][x]) {
                paintDeco(octx, d, x * T, y * T);
            }
        }
    }
}

// Repaint only the tiles around a mutated structure instead of re-rendering the
// whole 2048×2048 static canvas (which caused a frame hitch on every build,
// demolition, fire loss, and rubble decay). Pads by 1 tile so neighbours whose
// sprites overlap the region repaint cleanly.
export function patchStaticCache(tx, ty, w = 1, h = 1) {
    const assets = sim.assets;
    if (!_staticCanvas || !sim.grid || !assets) return; // full build happens at init/load
    const T = TILE_SIZE;
    const octx = _staticCanvas.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    const x0 = Math.max(0, tx - 1), y0 = Math.max(0, ty - 1);
    const x1 = Math.min(sim.grid.width - 1, tx + w), y1 = Math.min(sim.grid.height - 1, ty + h);
    octx.clearRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    if (_grassCanvas) {
        octx.drawImage(_grassCanvas,
            x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T,
            x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    }
    // Deco under a new structure/road is trampled (cleared + repainted as bare
    // terrain). The 1-tile pad repaints road autotiles around the mutation.
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            if (sim.grid.structures[y][x] || sim.grid.tiles[y][x] === 'tile_road') {
                if (sim.grid.deco && sim.grid.deco[y]) sim.grid.deco[y][x] = 0;
            }
        }
    }
    _paintTerrainInto(octx, x0, y0, x1, y1);
}

export function rebuildStructureLists() {
    const activeTowers = [];
    const activeBallistaTowers = [];
    const activeGates = [];
    const activeFarms = [];
    const activeMonuments = [];
    const activeWalls = [];
    const activePillageable = [];
    const activeHouses = [];
    const activeGranaries = [];
    const activeTaverns = [];
    const activeRubble = [];
    const activeBarracks = [];
    const activeArcheryRanges = [];
    const buildingCounts = {};
    const jobfulStructures = [];
    const underConstruction = [];
    for (let ty = 0; ty < sim.grid.height; ty++) {
        for (let tx = 0; tx < sim.grid.width; tx++) {
            const s = sim.grid.structures[ty][tx];
            if (!s || s.isChild) continue;
            const key = s.def.key;
            if ((key === 'lumberyard' || key === 'quarry' || key === 'mine') && (s.progress ?? 1.0) < 1.0) {
                s.progress = 1.0;
            }
            buildingCounts[key] = (buildingCounts[key] || 0) + 1;
            if (key === 'tower')          activeTowers.push({ tx, ty });
            if (key === 'ballista_tower') {
                const bRange  = gameState.upgrades?.ballistic_engineering ? 19 : 16;
                const bDamage = gameState.upgrades?.ballistic_engineering ? 90 : 75;
                activeBallistaTowers.push({ tx, ty, range: bRange, damage: bDamage });
            }
            if (key === 'gate')           activeGates.push({ tx, ty });
            if (key === 'farm')           activeFarms.push({ tx, ty });
            if (key === 'monument')       activeMonuments.push({ tx, ty });
            if (key === 'wall')           activeWalls.push({ tx, ty });
            if (key === 'house')          activeHouses.push({ tx, ty });
            if (key === 'granary')        activeGranaries.push({ tx, ty });
            if (key === 'tavern')         activeTaverns.push({ tx, ty });
            if (key === 'rubble')         activeRubble.push({ tx, ty });
            if (key === 'barracks')       activeBarracks.push({ tx, ty });
            if (key === 'archery_range')  activeArcheryRanges.push({ tx, ty });
            if (_PILLAGEABLE.has(key))    activePillageable.push({ tx, ty });
            if (s.def.maxWorkers)         jobfulStructures.push({ tx, ty, def: s.def });
            if ((s.progress ?? 1.0) < 1.0) underConstruction.push({ tx, ty });
        }
    }
    Object.assign(sim, {
        activeTowers, activeBallistaTowers, activeGates, activeFarms, activeMonuments,
        activeWalls, activePillageable, activeHouses, activeGranaries, activeTaverns,
        activeRubble, activeBarracks, activeArcheryRanges,
        buildingCounts, jobfulStructures, underConstruction
    });
    // Wall neighbour masks for the connected renderer (walls change rarely, so
    // the per-frame pass just reads this cache).
    _recomputeWallMasks();
    // Housing is derived so every destroy/demolish path stays correct:
    // 4 per house + 2 extra per tier-2 (Stone Cottage) house.
    let _t2Houses = 0;
    for (const h of activeHouses) {
        if (sim.tier2Upgrades[`${h.tx},${h.ty}`]) _t2Houses++;
    }
    gameState.housing = activeHouses.length * 4 + _t2Houses * 2;
    // Prune fire timers of demolished/destroyed towers (covers every removal path)
    if (window.towerFireTimers) {
        const validTimerIds = new Set();
        for (const { tx, ty } of activeTowers) validTimerIds.add(`${tx}_${ty}`);
        for (const { tx, ty } of activeBallistaTowers) validTimerIds.add(`bt_${tx}_${ty}`);
        for (const id of Object.keys(window.towerFireTimers)) {
            if (!validTimerIds.has(id)) delete window.towerFireTimers[id];
        }
    }
    // NOTE: the static canvas is no longer rebuilt here. Mutation sites call
    // patchStaticCache(tx, ty, w, h); init/load call _buildStaticCache() once.
}
export function showExpansionBanner() {
    // Route through the shared banner queue so it never overlaps another banner.
    if (typeof window.queueBanner === 'function') window.queueBanner({ kind: 'expansion' });
}

// Show/hide the expansion banner DOM for the given duration; called by the queue.
export function _showExpansionBannerDOM(durationMs) {
    const banner = document.getElementById('expansion-banner');
    if (!banner) return;
    if (sim.expansionBannerTimer) clearTimeout(sim.expansionBannerTimer);

    banner.style.display = 'block';
    banner.offsetHeight; // force reflow
    banner.classList.add('active');

    sim.expansionBannerTimer = setTimeout(() => {
        banner.classList.remove('active');
        setTimeout(() => {
            if (!banner.classList.contains('active')) {
                banner.style.display = 'none';
            }
        }, 500);
    }, durationMs ?? 1500);
}

export function getAdjacencyBonus(tx, ty, buildingType) {
    const dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
    let count = 0;
    for (const {dx, dy} of dirs) {
        const nx = tx + dx, ny = ty + dy;
        if (!sim.grid.inBounds(nx, ny)) continue;
        const s = sim.grid.structures[ny][nx];
        if (!s) continue;
        const k = s.def.key;
        if (buildingType === 'farm'       && k === 'farm')                              count++;
        if (buildingType === 'lumberyard' && k === 'obstacle_tree')                     count++;
        if (buildingType === 'quarry'     && k === 'stone_deposit')                       count++;
        if (buildingType === 'mine'       && k === 'iron_vein')                           count++;
        if (buildingType === 'tavern'     && k === 'house')                             count++;
    }
    switch (buildingType) {
        case 'farm':      return count * 1.5; // was 0.5 — too small vs 13.5 base to plan around
        case 'lumberyard': return count * 1.0;
        case 'quarry':    return count * 1.0;
        case 'mine':      return count * 1.0;
        case 'tavern':    return count * 3;
        default:          return 0;
    }
}

export function getFoodCap() {
    let cap = FOOD_CAP_BASE;
    for (const g of sim.activeGranaries) {
        const key = `${g.tx},${g.ty}`;
        cap += sim.tier2Upgrades[key] ? 350 : FOOD_CAP_PER_GRANARY;
    }
    return cap;
}
export function countBuildings(key) {
    // Reads the tally maintained by rebuildStructureLists — no grid scan.
    return sim.buildingCounts[key] || 0;
}

function getScaledCost(key) {
    const def = BUILDINGS[key];
    if (!def) return Infinity;
    let cost = def.cost;
    if (key === 'house') cost += (gameState.housesBuilt || 0) * 5;
    else if (key === 'farm') cost += (gameState.farmsBuilt || 0) * 5;
    return cost;
}

function calcDefense() {
    // Derived from the maintained active-structure lists — no grid scan.
    return sim.activeWalls.length * 2 + sim.activeTowers.length * 10 + sim.activeGates.length * 3
         + sim.activeBallistaTowers.length * 15
         + soldiers.length * 5 + archers.length * 8 + knights.length * 10;
}

function calcHappiness() {
    sim.happinessFactors = [];
    if (gameState.population === 0) return 100;
    let score = 45;
    const pop = gameState.population;
    const food = gameState.food;

    // Food factor (mutually exclusive tiers)
    if (food === 0) {
        score -= 25; sim.happinessFactors.push({ label: 'No Food', signs: '---', polarity: 'neg' });
    } else if (food < pop * 0.5) {
        score -= 15; sim.happinessFactors.push({ label: 'Food Scarce', signs: '--', polarity: 'neg' });
    } else if (food < pop) {
        score -= 5;  sim.happinessFactors.push({ label: 'Food Low', signs: '-', polarity: 'neg' });
    } else if (food < pop * 2) {
        score += 15; sim.happinessFactors.push({ label: 'Food Adequate', signs: '++', polarity: 'pos' });
    } else {
        score += 25; sim.happinessFactors.push({ label: 'Food Surplus', signs: '+++', polarity: 'pos' });
    }

    // Tavern factor (base capped at +20; +5 per tier-2 Grand Hall, combined cap +25)
    const tavernCount = sim.activeTaverns.length;
    let _tavernBase = 0;
    if (tavernCount >= 2) {
        _tavernBase = 20; sim.happinessFactors.push({ label: 'Taverns (2+)', signs: '+++', polarity: 'pos' });
    } else if (tavernCount === 1) {
        _tavernBase = 10; sim.happinessFactors.push({ label: 'Tavern', signs: '++', polarity: 'pos' });
    }
    let _t2Taverns = 0;
    for (const t of sim.activeTaverns) {
        if (sim.tier2Upgrades[`${t.tx},${t.ty}`]) _t2Taverns++;
    }
    const _tavernTotal = Math.min(25, _tavernBase + _t2Taverns * 5);
    score += _tavernTotal;
    if (_t2Taverns > 0 && _tavernTotal > _tavernBase) {
        sim.happinessFactors.push({ label: `Grand Hall${_t2Taverns > 1 ? 's' : ''} (+${_tavernTotal - _tavernBase})`, signs: '++', polarity: 'pos' });
    }

    // Tavern adjacency bonus (capped — house-ringed tavern farms were an exploit
    // that permanently locked in the fast spawn tier)
    let tavernAdjBonus = 0;
    for (const t of sim.activeTaverns) tavernAdjBonus += getAdjacencyBonus(t.tx, t.ty, 'tavern');
    tavernAdjBonus = Math.min(9, tavernAdjBonus);
    if (tavernAdjBonus > 0) {
        score += tavernAdjBonus;
        const adjSigns = tavernAdjBonus >= 12 ? '+++' : tavernAdjBonus >= 6 ? '++' : '+';
        sim.happinessFactors.push({ label: `Tavern Adj +${tavernAdjBonus}`, signs: adjSigns, polarity: 'pos' });
    }

    // Winter penalty
    if (gameState.season === 'Winter') {
        score -= 5; sim.happinessFactors.push({ label: 'Winter', signs: '-', polarity: 'neg' });
    }

    // Drought penalty
    if (sim.droughtActive) {
        score -= 8; sim.happinessFactors.push({ label: 'Drought', signs: '-', polarity: 'neg' });
    }

    // Grief penalty
    if (sim.griefPenalty > 0) {
        score -= sim.griefPenalty;
        const griefSigns = sim.griefPenalty > 10 ? '---' : sim.griefPenalty > 5 ? '--' : '-';
        sim.happinessFactors.push({ label: 'Grief', signs: griefSigns, polarity: 'neg' });
    }

    // Recent events (decaying morale modifier from diplomacy choices)
    if (Math.abs(sim.moraleModifier) >= 0.5) {
        score += sim.moraleModifier;
        const m = sim.moraleModifier;
        const moraleSigns = m >= 12 ? '+++' : m >= 5 ? '++' : m > 0 ? '+' : m <= -12 ? '---' : m <= -5 ? '--' : '-';
        sim.happinessFactors.push({ label: 'Recent Events', signs: moraleSigns, polarity: m > 0 ? 'pos' : 'neg' });
    }

    // Fire penalty (count active fires from incidentManager)
    const fireCount = (sim.incidentManager?.active?.type === 'fire') ? (sim.incidentManager.active.fires?.length ?? 0) : 0;
    if (fireCount > 0) {
        const fireDmg = Math.min(18, fireCount * 6);
        score -= fireDmg;
        const fireSigns = fireCount >= 3 ? '---' : fireCount === 2 ? '--' : '-';
        sim.happinessFactors.push({ label: 'Fire', signs: fireSigns, polarity: 'neg' });
    }

    // Overcrowding penalty
    if (pop > gameState.housing) {
        const excess = pop - gameState.housing;
        score -= Math.min(20, excess * 4);
        const crowdSigns = excess >= 5 ? '---' : excess >= 3 ? '--' : '-';
        sim.happinessFactors.push({ label: 'Overcrowded', signs: crowdSigns, polarity: 'neg' });
    }

    // Garrison pressure penalty
    if ((soldiers.length + archers.length + knights.length) > pop * 0.5) {
        score -= 12; sim.happinessFactors.push({ label: 'Garrison Heavy', signs: '--', polarity: 'neg' });
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

function getSpawnInterval() {
    const EB = window.ECONOMY_BALANCE;
    if (gameState.happiness >= 75) return EB?.spawnIntervalHappySec ?? 6;
    if (gameState.happiness >= 40) return EB?.spawnIntervalContentSec ?? 10;
    return Infinity;
}

function formatTime(s) {
    s = Math.max(0, s);
    return `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
}

Object.assign(window, {

    rebuildStructureLists, showExpansionBanner, _showExpansionBannerDOM, getAdjacencyBonus, getFoodCap,
    countBuildings, getScaledCost, calcDefense, calcHappiness, getSpawnInterval, formatTime,
    _buildStaticCache, _staticCanvas, patchStaticCache, _recomputeWallMasks, _wallMaskAt,

    GameGrid, makeSeededRng, randomSeedString, openResearchModal, closeResearchModal, showDiplomacyModal, chooseDiplomacyOption,
    closeBuildingPanel, openBuildingPanel, updateResearchModalUI, startResearch, updateResearch,
    applyUpgradeEffects, getHighScores, saveHighScores, isHighScore, addHighScoreEntry,
    updateLeaderboardDisplays, calculateCurrentScore, triggerVictory, triggerDefeat,
    updateRaidHUD, showModal, updateTimePauseUI, updateResourceUI, renderBuildMenu,
    updateCombatModeUI, _updateDayPhaseGlyph, updateDaySeason, updateBuildMenu, refreshUI,
    _buildGrassCache, renderWorldOverlay, render
});


// ===================== ASSET LOADER =====================
export class AssetLoader {
    constructor() { this.assets = {}; }

    _createFallbackCanvas(color, w = 16, h = 16) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.fillStyle = color;
        cx.fillRect(0, 0, w, h);
        return c;
    }

    _createRoadFallback() {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const cx = c.getContext('2d');
        cx.fillStyle = '#888888';
        cx.fillRect(0, 0, 16, 16);
        cx.strokeStyle = '#666666';
        cx.lineWidth = 1;
        cx.strokeRect(1, 1, 6, 6);
        cx.strokeRect(9, 1, 6, 6);
        cx.strokeRect(1, 9, 6, 6);
        cx.strokeRect(9, 9, 6, 6);
        return c;
    }

    _createTreeFallback() {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const cx = c.getContext('2d');
        cx.fillStyle = '#2d5a1b';
        cx.beginPath();
        cx.moveTo(8, 1); cx.lineTo(15, 12); cx.lineTo(1, 12);
        cx.closePath();
        cx.fill();
        cx.fillStyle = '#6b3d2c';
        cx.fillRect(6, 12, 4, 4);
        return c;
    }

    _createCircleFallback(color, size = 16, radius = 4) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const cx = c.getContext('2d');
        cx.fillStyle = color;
        cx.beginPath();
        cx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
        cx.fill();
        return c;
    }

    // BFS flood-fill: strip edge-connected background pixels to transparency
    _stripBg(img) {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return img;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, w, h);
        const px = d.data;
        const bgR = px[0], bgG = px[1], bgB = px[2];
        const tol = 40;
        const near = i => {
            const dr = px[i]-bgR, dg = px[i+1]-bgG, db = px[i+2]-bgB;
            return dr*dr + dg*dg + db*db < tol*tol;
        };
        const vis = new Uint8Array(w * h);
        const q = [];
        const seed = (x, y) => {
            const idx = y * w + x;
            if (!vis[idx] && near(idx * 4)) { vis[idx] = 1; q.push(idx); }
        };
        for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
        for (let y = 1; y < h - 1; y++) { seed(0, y); seed(w - 1, y); }
        while (q.length) {
            const idx = q.pop();
            px[idx * 4 + 3] = 0;
            const x = idx % w, y = (idx / w) | 0;
            if (x > 0   && !vis[idx-1] && near((idx-1)*4)) { vis[idx-1] = 1; q.push(idx-1); }
            if (x < w-1 && !vis[idx+1] && near((idx+1)*4)) { vis[idx+1] = 1; q.push(idx+1); }
            if (y > 0   && !vis[idx-w] && near((idx-w)*4)) { vis[idx-w] = 1; q.push(idx-w); }
            if (y < h-1 && !vis[idx+w] && near((idx+w)*4)) { vis[idx+w] = 1; q.push(idx+w); }
        }
        cx.putImageData(d, 0, 0);
        return c;
    }

    async _loadStripped(name, src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => { this.assets[name] = this._stripBg(img); resolve(true); };
            img.onerror = () => { console.warn(`Asset "${src}" not found, using fallback.`); resolve(false); };
            img.src = src;
        });
    }

    async _loadImage(name, src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => { this.assets[name] = img; resolve(true); };
            img.onerror = () => { console.warn(`Asset "${src}" not found, using fallback.`); resolve(false); };
            img.src = src;
        });
    }

    async loadAll() {
        if (!await this._loadImage('tile_grass', 'assets/sprites/tile_grass.png'))
            this.assets['tile_grass'] = this._createFallbackCanvas('#4a8c3f');
        if (!await this._loadImage('tile_dirt', 'assets/sprites/tile_dirt.png'))
            this.assets['tile_dirt'] = this._createFallbackCanvas('#8B6532');
        if (!await this._loadImage('building_house', 'assets/sprites/building_house.png'))
            this.assets['building_house'] = this._createFallbackCanvas('#d9534f', 16, 16);
        if (!await this._loadImage('building_tower', 'assets/sprites/building_tower.png'))
            this.assets['building_tower'] = this._createFallbackCanvas('#0275d8', 16, 32);
        if (!await this._loadImage('building_wall', 'assets/sprites/building_wall.png'))
            this.assets['building_wall'] = this._createFallbackCanvas('#777777', 16, 16);
        if (!await this._loadImage('building_farm', 'assets/sprites/building_farm.png'))
            this.assets['building_farm'] = this._createFallbackCanvas('#f0ad4e', 16, 16);
        if (!await this._loadImage('building_granary', 'assets/sprites/building_granary.png'))
            this.assets['building_granary'] = this._createFallbackCanvas('#8B6914', 16, 16);
        if (!await this._loadImage('building_tavern', 'assets/sprites/building_tavern.png'))
            this.assets['building_tavern'] = this._createFallbackCanvas('#b8860b', 16, 16);
        if (!await this._loadImage('citizen_sprite', 'assets/sprites/citizen_sprite.png'))
            this.assets['citizen_sprite'] = this._createCircleFallback('#ffdd57', 16, 4);
        if (!await this._loadImage('obstacle_tree', 'assets/sprites/obstacle_tree.png'))
            this.assets['obstacle_tree'] = this._createTreeFallback();
        if (!await this._loadImage('tile_road', 'assets/sprites/tile_road.png'))
            this.assets['tile_road'] = this._createRoadFallback();
        if (!await this._loadStripped('building_barracks', 'assets/sprites/building_barracks.png'))
            this.assets['building_barracks'] = this._createFallbackCanvas('#6d4c41', 16, 16);
        if (!await this._loadImage('citizen_soldier', 'assets/sprites/citizen_soldier.png')) {
            const c = document.createElement('canvas');
            c.width = 16; c.height = 16;
            const cx = c.getContext('2d');
            cx.fillStyle = '#1a3a6a';
            cx.beginPath(); cx.arc(8, 8, 6, 0, Math.PI * 2); cx.fill();
            cx.strokeStyle = '#ffdd57'; cx.lineWidth = 1.5;
            cx.beginPath(); cx.arc(8, 8, 6, 0, Math.PI * 2); cx.stroke();
            this.assets['citizen_soldier'] = c;
        }
        if (!await this._loadImage('building_rubble', 'assets/sprites/building_rubble.png')) {
            const c = document.createElement('canvas');
            c.width = 16; c.height = 16;
            const cx = c.getContext('2d');
            cx.fillStyle = '#444444';
            cx.fillRect(1, 8, 6, 5);
            cx.fillRect(9, 9, 5, 4);
            cx.fillRect(4, 5, 7, 4);
            cx.fillStyle = '#666666';
            cx.fillRect(2, 9, 3, 3);
            cx.fillRect(10, 10, 3, 2);
            this.assets['building_rubble'] = c;
        }
        if (!await this._loadImage('enemy_raider', 'assets/sprites/enemy_raider.png')) {
            const c = document.createElement('canvas');
            c.width = 16; c.height = 16;
            const cx = c.getContext('2d');
            cx.fillStyle = '#ff0000';
            cx.beginPath();
            cx.arc(8, 8, 5, 0, Math.PI * 2);
            cx.fill();
            cx.strokeStyle = '#000000';
            cx.lineWidth = 1;
            cx.stroke();
            this.assets['enemy_raider'] = c;
        }
        if (!await this._loadImage('enemy_torch_raider', 'assets/sprites/enemy_torch_raider.png')) {
            const c = document.createElement('canvas'); c.width = 16; c.height = 16;
            const cx = c.getContext('2d');
            cx.fillStyle = '#5a1a00';
            cx.beginPath(); cx.arc(8, 8, 5, 0, Math.PI * 2); cx.fill();
            cx.strokeStyle = '#221100'; cx.lineWidth = 1; cx.stroke();
            cx.fillStyle = '#ff6600'; cx.fillRect(11, 3, 3, 5);
            cx.fillStyle = '#ffcc00'; cx.fillRect(12, 2, 2, 3);
            this.assets['enemy_torch_raider'] = c;
        }
        if (!await this._loadImage('enemy_siege_raider', 'assets/sprites/enemy_siege_raider.png')) {
            const c = document.createElement('canvas'); c.width = 16; c.height = 16;
            const cx = c.getContext('2d');
            cx.fillStyle = '#444444';
            cx.fillRect(3, 4, 10, 10);
            cx.fillStyle = '#666666';
            cx.fillRect(2, 4, 3, 5); cx.fillRect(11, 4, 3, 5);
            cx.fillStyle = '#888888';
            cx.fillRect(4, 11, 8, 3);
            this.assets['enemy_siege_raider'] = c;
        }
        if (!await this._loadImage('building_lumberyard', 'assets/sprites/building_lumberyard.png'))
            this.assets['building_lumberyard'] = this._createFallbackCanvas('#8B6914', 16, 16);
        if (!await this._loadImage('building_quarry', 'assets/sprites/building_quarry.png'))
            this.assets['building_quarry'] = this._createFallbackCanvas('#7a6a5a', 16, 16);
        if (!await this._loadImage('building_mine', 'assets/sprites/building_mine.png'))
            this.assets['building_mine'] = this._createFallbackCanvas('#4a4a4a', 16, 16);
        if (!await this._loadImage('building_warehouse', 'assets/sprites/building_warehouse.png'))
            this.assets['building_warehouse'] = this._createFallbackCanvas('#8B7355', 16, 16);
        if (!await this._loadImage('obstacle_stone', 'assets/sprites/obstacle_stone.png'))
            this.assets['obstacle_stone'] = this._createFallbackCanvas('#6e7275', 16, 16);
        if (!await this._loadImage('obstacle_iron', 'assets/sprites/obstacle_iron.png'))
            this.assets['obstacle_iron'] = this._createFallbackCanvas('#b2b9c0', 16, 16);
        if (!await this._loadImage('building_gate_open', 'assets/sprites/building_gate_open.png'))
            this.assets['building_gate_open'] = this._createFallbackCanvas('#8B7355', 16, 16);
        if (!await this._loadImage('building_gate_closed', 'assets/sprites/building_gate_closed.png'))
            this.assets['building_gate_closed'] = this._createFallbackCanvas('#5a4828', 16, 16);
        if (!await this._loadImage('building_archery_range', 'assets/sprites/building_archery_range.png'))
            this.assets['building_archery_range'] = this._createFallbackCanvas('#4a6a3a', 16, 16);
        if (!await this._loadImage('building_ballistatower', 'assets/sprites/building_ballistatower.png'))
            this.assets['building_ballistatower'] = this._createFallbackCanvas('#4a3a2a', 16, 32);
        if (!await this._loadImage('citizen_archer', 'assets/sprites/citizen_archer.png'))
            this.assets['citizen_archer'] = this._createCircleFallback('#00ccaa', 16, 5);
        if (!await this._loadImage('citizen_knight', 'assets/sprites/citizen_knight.png'))
            this.assets['citizen_knight'] = this._createCircleFallback('#cc8800', 16, 6);
        if (!await this._loadImage('building_academy', 'assets/sprites/building_academy.png'))
            this.assets['building_academy'] = this._createFallbackCanvas('#9c27b0', 16, 16);
        if (!await this._loadImage('building_monument', 'assets/sprites/building_monument.png'))
            this.assets['building_monument'] = this._createFallbackCanvas('#00bcd4', 32, 32);
        if (!await this._loadImage('effect_fire', 'assets/sprites/effect_fire.png')) {
            const c = document.createElement('canvas'); c.width = 16; c.height = 16;
            const cx = c.getContext('2d');
            cx.fillStyle = '#ff6600'; cx.fillRect(2, 4, 12, 10);
            cx.fillStyle = '#ffaa00'; cx.fillRect(4, 6, 8, 8);
            cx.fillStyle = '#ffff44'; cx.fillRect(6, 9, 4, 5);
            this.assets['effect_fire'] = c;
        }
        if (!await this._loadImage('effect_drought', 'assets/sprites/effect_drought.png')) {
            const c = document.createElement('canvas'); c.width = 16; c.height = 16;
            const cx = c.getContext('2d');
            cx.fillStyle = '#8B5a1a'; cx.fillRect(0, 0, 16, 16);
            cx.strokeStyle = '#5a3000'; cx.lineWidth = 1;
            cx.beginPath(); cx.moveTo(4,4); cx.lineTo(4,12); cx.stroke();
            cx.beginPath(); cx.moveTo(8,2); cx.lineTo(8,14); cx.stroke();
            cx.beginPath(); cx.moveTo(12,5); cx.lineTo(12,11); cx.stroke();
            this.assets['effect_drought'] = c;
        }
        if (!await this._loadImage('npc_merchant', 'assets/sprites/npc_merchant.png')) {
            const c = document.createElement('canvas'); c.width = 16; c.height = 16;
            const cx = c.getContext('2d');
            cx.fillStyle = '#cc8844'; cx.fillRect(3, 4, 10, 10);
            cx.fillStyle = '#eecc77'; cx.fillRect(4, 2, 8, 4);
            cx.fillStyle = '#884400'; cx.fillRect(5, 11, 2, 4); cx.fillRect(9, 11, 2, 4);
            this.assets['npc_merchant'] = c;
        }
        if (!await this._loadImage('ui_event_banner', 'assets/sprites/ui_event_banner.png'))
            this.assets['ui_event_banner'] = this._createFallbackCanvas('#3a2010', 128, 32);
        return this.assets;
    }
}

// Rebind to window to include AssetLoader
window.AssetLoader = AssetLoader;
