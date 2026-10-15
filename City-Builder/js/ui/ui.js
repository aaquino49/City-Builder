import {
    sim,
    runHook,
} from '../core/state.js';

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
    }

    regenerate(seed) {
        // Reset the world from a new seed (preview / new-game only).
        this.seed = seed || randomSeedString();
        this.rng = makeSeededRng(this.seed);
        this.structures = this._initStructures();
        this.tiles = this._generateTiles();
        this._spawnTrees();
        this._spawnOutcrops();
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

        const startX = Math.max(0, Math.floor(camX / TILE_SIZE));
        const startY = Math.max(0, Math.floor(camY / TILE_SIZE));
        const endX = Math.min(this.width - 1, Math.ceil((camX + canvasW / zoom) / TILE_SIZE));
        const endY = Math.min(this.height - 1, Math.ceil((camY + canvasH / zoom) / TILE_SIZE));

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

        // Draw dynamic / under-construction / active structures on top
        for (let ty = startY; ty <= endY; ty++) {
            for (let tx = startX; tx <= endX; tx++) {
                const s = this.structures[ty][tx];
                if (!s || s.isChild) continue;
                const key = s.def.key;
                
                const isDynamic = (key === 'monument' || key === 'academy' || key === 'tower' || key === 'ballista_tower' || key === 'gate');
                const isUnderConstruction = (s.progress ?? 1.0) < 1.0;
                
                // If it is static and complete, it was already drawn to staticCanvas
                if (_staticCanvas && !isDynamic && !isUnderConstruction) {
                    // Check if it is damaged; if damaged, we still need to draw the HP bar
                    if (s.hp !== undefined && !window._NON_BURNABLE.has(key)) {
                        const maxHp = getMaxHP(key);
                        const hpPct = Math.max(0, s.hp / maxHp);
                        if (hpPct < 1.0) {
                            const renderW = (s.def.width || 1) * TILE_SIZE;
                            const renderH = (s.def.height || 1) * TILE_SIZE;
                            ctx.fillStyle = 'rgba(0,0,0,0.6)';
                            ctx.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + renderH - 4, renderW - 2, 3);
                            ctx.fillStyle = hpPct > 0.6 ? '#44cc44' : hpPct > 0.3 ? '#ffaa00' : '#cc2222';
                            ctx.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + renderH - 4, (renderW - 2) * hpPct, 3);
                        }
                    }
                    continue; 
                }

                const assetKey = key === 'gate'
                    ? (s.gateOpen !== false ? 'building_gate_open' : 'building_gate_closed')
                    : s.def.assetKey;
                const asset = assets[assetKey];
                const prog = s.progress ?? 1.0;
                const w = s.def.width || 1;
                const h = s.def.height || 1;
                const renderW = w * TILE_SIZE;
                const renderH = h * TILE_SIZE;
                
                if (asset) {
                    if (prog < 1.0) ctx.globalAlpha = 0.4 + prog * 0.6;
                    ctx.drawImage(asset, tx * TILE_SIZE, ty * TILE_SIZE, renderW, renderH);
                    ctx.globalAlpha = 1.0;
                } else {
                    ctx.fillStyle = s.def.color;
                    ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, renderW, renderH);
                }

                // Padlock cue so manually locked gates are visually distinct
                if (key === 'gate' && s.manuallyLocked) {
                    ctx.save();
                    ctx.font = `${10}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.fillText('🔒', tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + 2);
                    ctx.restore();
                }

                if (prog < 1.0) {
                    ctx.fillStyle = 'rgba(0,0,0,0.55)';
                    ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE + renderH - 6, renderW - 4, 4);
                    ctx.fillStyle = '#ffdd57';
                    ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE + renderH - 6, (renderW - 4) * prog, 4);
                } else if (s.hp !== undefined && !window._NON_BURNABLE.has(key)) {
                    const maxHp = getMaxHP(key);
                    const hpPct = Math.max(0, s.hp / maxHp);
                    if (hpPct < 1.0) {
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + renderH - 4, renderW - 2, 3);
                        ctx.fillStyle = hpPct > 0.6 ? '#44cc44' : hpPct > 0.3 ? '#ffaa00' : '#cc2222';
                        ctx.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + renderH - 4, (renderW - 2) * hpPct, 3);
                    }
                } else {
                    if (key === 'academy' && gameState.activeResearch) {
                        const researchDur = gameState.activeResearch.duration ?? 15.0;
                        const progressPct = (researchDur - gameState.activeResearch.timer) / researchDur;
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE - 8, renderW - 4, 4);
                        ctx.fillStyle = '#ffb300';
                        ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE - 8, (renderW - 4) * progressPct, 4);
                    }
                }
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

        const citizenAsset = assets['citizen_sprite'];
        const viewMinX = camX - TILE_SIZE;
        const viewMinY = camY - TILE_SIZE;
        const viewMaxX = camX + canvasW / zoom + TILE_SIZE;
        const viewMaxY = camY + canvasH / zoom + TILE_SIZE;
        for (const c of citizens) {
            const drawX = typeof c.renderX === 'function' ? c.renderX() : c.x;
            const drawY = typeof c.renderY === 'function' ? c.renderY() : c.y;
            if (drawX < viewMinX || drawX > viewMaxX || drawY < viewMinY || drawY > viewMaxY) continue;
            if (c.job === 'rebel') {
                // Red tint for rebels
                ctx.globalAlpha = 0.85;
                if (citizenAsset) {
                    ctx.globalCompositeOperation = 'source-over';
                    _drawFacingSprite(ctx, citizenAsset, c, drawX, drawY);
                    ctx.fillStyle = 'rgba(200,30,30,0.55)';
                    ctx.beginPath(); ctx.arc(drawX, drawY, 8, 0, Math.PI * 2); ctx.fill();
                } else {
                    ctx.fillStyle = '#cc2222';
                    ctx.beginPath(); ctx.arc(drawX, drawY, 5, 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1.0;
            } else if (citizenAsset) {
                _drawFacingSprite(ctx, citizenAsset, c, drawX, drawY);
            } else {
                ctx.fillStyle = '#ffdd57';
                ctx.beginPath();
                ctx.arc(drawX, drawY, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

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
                    const asset = assets[def.assetKey];
                    if (asset) {
                        ctx.drawImage(asset, tx * TILE_SIZE, ty * TILE_SIZE, renderW, renderH);
                    } else {
                        ctx.fillStyle = def.color;
                        ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, renderW, renderH);
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
    { key: 'trade_guilds',          name: 'Trade Guilds',          desc: 'Tax income +1 gold per citizen per tick.',       goldCost: 180, stoneCost: 0,  ironCost: 20, woodCost: 0,  requires: 0 },
    { key: 'field_medicine',        name: 'Field Medicine',        desc: 'Military units regenerate HP 2× faster.',        goldCost: 150, stoneCost: 0,  ironCost: 0,  woodCost: 30, requires: 0 },
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
    if (s.hp !== undefined) statsLines.push(`HP: ${Math.ceil(s.hp)} / ${getMaxHP(bKey)}`);
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
        statsLines.push(`Range: ${isT2 ? (_towerCB?.tier2RangeTiles ?? 10) : (_towerCB?.rangeTiles ?? 8)} tiles`);
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
        statsLines.push(`Housing: +${s.def.housing || 4}`);
    } else if (bKey === 'tavern') {
        const adj = getAdjacencyBonus(tx, ty, 'tavern');
        statsLines.push(`Happiness bonus`);
        if (adj > 0) statsLines.push(`Adj bonus: +${adj} happiness`);
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
    if (btnDbl) btnDbl.classList.toggle('active', sim.timeScale === 2);
}
document.getElementById('btn-pause').addEventListener('click', () => {
    if (!gameState.started || sim.gameIsPaused) return;
    sim.userPaused = !sim.userPaused;
    updateTimePauseUI();
});
document.getElementById('btn-doubletime').addEventListener('click', () => {
    sim.timeScale = sim.timeScale === 2 ? 1 : 2;
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
            <div class="build-sprite-frame"><canvas data-asset="${item.assetKey || ''}" width="28" height="28"></canvas></div>
            <div class="build-item-text">
                <div class="build-item-name">${item.name}</div>
                <div class="build-item-costs">${parts.join('')}</div>
            </div>
            <div class="build-item-yield">${item.yields}</div>
        </div>`;
    }).join('');
    itemsEl.querySelectorAll('canvas[data-asset]').forEach(cv => {
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
    document.querySelectorAll('#build-items .build-btn').forEach(btn => {
        const tool = btn.dataset.tool;
        btn.classList.toggle('active', tool === gameState.selectedTool);
        if (tool === 'demolish') { btn.disabled = false; btn.classList.remove('disabled'); return; }
        if (tool === 'clear')        { const c = gameState.gold < 10;  btn.disabled = c; btn.classList.toggle('disabled', c); return; }
        if (tool === 'clear_rubble') { const c = gameState.gold < 15;  btn.disabled = c; btn.classList.toggle('disabled', c); return; }
        if (tool === 'road')         { const c = gameState.gold < ROAD_COST; btn.disabled = c; btn.classList.toggle('disabled', c); return; }
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
            const c = !(gameState.gold >= solCost && countBuildings('barracks') > 0 && citizens.some(ci => ci.job === 'idle'));
            btn.disabled = c; btn.classList.toggle('disabled', c); return;
        }
        if (tool === 'train_archer') {
            const archCost = window.UNIT_BALANCE?.archer?.goldCost ?? 40;
            const c = !(gameState.gold >= archCost && countBuildings('archery_range') > 0 && citizens.some(ci => ci.job === 'idle'));
            btn.disabled = c; btn.classList.toggle('disabled', c); return;
        }
        if (tool === 'train_knight') {
            const kGold = window.UNIT_BALANCE?.knight?.goldCost ?? 60;
            const kIron = window.UNIT_BALANCE?.knight?.ironCost ?? 20;
            const c = !(gameState.gold >= kGold && gameState.iron >= kIron && countBuildings('barracks') > 0 && citizens.some(ci => ci.job === 'idle'));
            btn.disabled = c; btn.classList.toggle('disabled', c); return;
        }
        if (tool === 'train_captain') {
            const cGold = window.UNIT_BALANCE?.captain?.goldCost ?? 150;
            const cIron = window.UNIT_BALANCE?.captain?.ironCost ?? 30;
            const hasCaptain = soldiers.some(s => s.isCaptain);
            const c = hasCaptain || !(gameState.gold >= cGold && gameState.iron >= cIron && countBuildings('barracks') > 0 && citizens.some(ci => ci.job === 'idle'));
            btn.disabled = c; btn.classList.toggle('disabled', c);
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
        btn.disabled = !canAfford;
        btn.classList.toggle('disabled', !canAfford);
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

    // Physics projectiles (arrows and bolts)
    for (const p of activeProjectiles) {
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

    // Gate HP bars (when damaged)
    for (const { tx, ty } of sim.activeGates) {
        const s = sim.grid.structures[ty][tx];
        const maxHp = getMaxHP('gate');
        if (!s || (s.hp ?? maxHp) >= maxHp) continue;
        const gx = tx * TILE_SIZE + TILE_SIZE / 2;
        const gy = ty * TILE_SIZE;
        const bw = TILE_SIZE - 4;
        ctx.fillStyle = '#333333';
        ctx.fillRect(gx - bw / 2, gy - 6, bw, 3);
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(gx - bw / 2, gy - 6, bw * ((s.hp ?? maxHp) / maxHp), 3);
    }

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

    const soldierAsset = sim.assets['citizen_soldier'];
    let renderedSoldiers = 0;
    for (const sol of soldiers) {
        if (!isVisibleUnit(sol)) continue;
        if (renderedSoldiers++ >= 200) break;
        if (soldierAsset) {
            if (sol.isCaptain) {
                // Captain: larger sprite with a gold command ring
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 1.5 / zoom;
                ctx.beginPath(); ctx.arc(sol.x, sol.y, 11, 0, Math.PI * 2); ctx.stroke();
                _drawFacingSprite(ctx, soldierAsset, sol, sol.x, sol.y, 20);
            } else {
                _drawFacingSprite(ctx, soldierAsset, sol, sol.x, sol.y);
            }
        } else {
            ctx.fillStyle = '#1a3a6a';
            ctx.beginPath(); ctx.arc(sol.x, sol.y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffdd57'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(sol.x, sol.y, 6, 0, Math.PI * 2); ctx.stroke();
        }
        const solMaxHp = sol.maxHp || 100;
        if (sol.hp < solMaxHp) {
            const bw = 16;
            ctx.fillStyle = '#333333';
            ctx.fillRect(sol.x - bw / 2, sol.y - 12, bw, 2);
            ctx.fillStyle = '#4488ff';
            ctx.fillRect(sol.x - bw / 2, sol.y - 12, bw * (sol.hp / solMaxHp), 2);
        }
    }

    const archerAsset = sim.assets['citizen_archer'];
    let renderedArchers = 0;
    for (const a of archers) {
        if (!isVisibleUnit(a)) continue;
        if (renderedArchers++ >= 150) break;
        if (archerAsset) {
            _drawFacingSprite(ctx, archerAsset, a, a.x, a.y);
        } else {
            ctx.fillStyle = '#00ccaa';
            ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, Math.PI * 2); ctx.fill();
        }
        if (a.hp < a.maxHp) {
            const bw = 14;
            ctx.fillStyle = '#333333';
            ctx.fillRect(a.x - bw / 2, a.y - 12, bw, 2);
            ctx.fillStyle = '#00ccaa';
            ctx.fillRect(a.x - bw / 2, a.y - 12, bw * (a.hp / a.maxHp), 2);
        }
    }

    const knightAsset = sim.assets['citizen_knight'];
    let renderedKnights = 0;
    for (const k of knights) {
        if (!isVisibleUnit(k)) continue;
        if (renderedKnights++ >= 100) break;
        if (knightAsset) {
            _drawFacingSprite(ctx, knightAsset, k, k.x, k.y);
        } else {
            ctx.fillStyle = '#cc8800';
            ctx.beginPath(); ctx.arc(k.x, k.y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffaa33'; ctx.lineWidth = 1.5 / zoom;
            ctx.beginPath(); ctx.arc(k.x, k.y, 6, 0, Math.PI * 2); ctx.stroke();
        }
        if (k.hp < k.maxHp) {
            const bw = 16;
            ctx.fillStyle = '#333333';
            ctx.fillRect(k.x - bw / 2, k.y - 12, bw, 2);
            ctx.fillStyle = '#cc8800';
            ctx.fillRect(k.x - bw / 2, k.y - 12, bw * (k.hp / k.maxHp), 2);
        }
    }

    // Fire overlay
    if (sim.incidentManager?.active?.type === 'fire') {
        const fireAsset = sim.assets['effect_fire'];
        const flicker = 0.75 + Math.sin(Date.now() / 100) * 0.25;
        for (const fire of sim.incidentManager.active.fires) {
            const fx = fire.tx * TILE_SIZE, fy = fire.ty * TILE_SIZE;
            ctx.globalAlpha = flicker;
            if (fireAsset) {
                ctx.drawImage(fireAsset, fx, fy, TILE_SIZE, TILE_SIZE);
            } else {
                const r = Math.floor(200 + Math.random() * 55), g2 = Math.floor(50 + Math.random() * 80);
                ctx.fillStyle = `rgba(${r},${g2},0,0.85)`;
                ctx.fillRect(fx + 2, fy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.fillStyle = `rgba(255,${Math.floor(150 + Math.random() * 100)},0,0.5)`;
                ctx.fillRect(fx + 5, fy + 5, TILE_SIZE - 10, TILE_SIZE - 10);
            }
        }
        ctx.globalAlpha = 1.0;
    }

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

    // Merchant NPC
    if (sim.merchantNPC && sim.merchantNPC.state !== 'done') {
        const merchantAsset = sim.assets['npc_merchant'];
        if (merchantAsset) {
            ctx.drawImage(merchantAsset, sim.merchantNPC.x - 8, sim.merchantNPC.y - 8, 16, 16);
        } else {
            ctx.fillStyle = '#cc8844';
            ctx.fillRect(sim.merchantNPC.x - 8, sim.merchantNPC.y - 8, 16, 16);
            ctx.strokeStyle = '#eecc77'; ctx.lineWidth = 1 / sim.camera.zoom;
            ctx.strokeRect(sim.merchantNPC.x - 8, sim.merchantNPC.y - 8, 16, 16);
        }
    }

    // Raider camps — tents beyond the border; razing them is ATTACK mode's job
    for (const camp of (sim.raiderCamps || [])) {
        if (camp.x < viewMinX || camp.x > viewMaxX || camp.y < viewMinY || camp.y > viewMaxY) continue;
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
        ctx.fillRect(camp.x - 3, camp.y - 1, 6, 9); // entrance
        // banner pole + flag
        ctx.strokeStyle = '#332211';
        ctx.beginPath(); ctx.moveTo(camp.x + 10, camp.y - 18); ctx.lineTo(camp.x + 10, camp.y + 2); ctx.stroke();
        ctx.fillStyle = '#cc2222';
        ctx.fillRect(camp.x + 10, camp.y - 18, 9, 5);
        // HP bar when damaged
        if (camp.hp < camp.maxHp) {
            const bw = 26;
            ctx.fillStyle = '#333333';
            ctx.fillRect(camp.x - bw / 2, camp.y - 22, bw, 3);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(camp.x - bw / 2, camp.y - 22, bw * Math.max(0, camp.hp / camp.maxHp), 3);
        }
    }

    let renderedRaiders = 0;
    for (const r of raiders) {
        if (!isVisibleUnit(r)) continue;
        // Covers the largest endless-mode wave plus two capped camp garrisons.
        if (renderedRaiders++ >= 300) break;
        const raiderAsset = r.type === 'torch' ? sim.assets['enemy_torch_raider']
                          : r.type === 'siege' ? sim.assets['enemy_siege_raider']
                          : sim.assets['enemy_raider'];
        ctx.save();
        ctx.globalAlpha = r._alpha;
        ctx.translate(r.x, r.y);
        // Victory-defeat spin effect only (main.js updateEffects), so raiders
        // keep their feet facing down while walking and only spin out on defeat.
        if (r._rotation) ctx.rotate(r._rotation);
        if (r._attacking) {
            const pulse = 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 120));
            ctx.strokeStyle = `rgba(255, 80, 0, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (raiderAsset) {
            // Facing flip inside the (translated) raider frame; the victory
            // spin (rotation above) composes with it naturally.
            if (r.targetX < r.x - 0.5) r._facingLeft = true;
            else if (r.targetX > r.x + 0.5) r._facingLeft = false;
            if (r._facingLeft) ctx.scale(-1, 1);
            ctx.drawImage(raiderAsset, -8, -8, 16, 16);
        } else {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
        const _rMaxHp = r.maxHp || (r.type === 'siege' ? 150 : 100);
        if (r.state === 'walking' && r.hp < _rMaxHp) {
            const bw = 16;
            ctx.fillStyle = '#333333';
            ctx.fillRect(r.x - bw / 2, r.y - 12, bw, 2);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(r.x - bw / 2, r.y - 12, bw * (r.hp / _rMaxHp), 2);
        }
    }

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
    octx.imageSmoothingEnabled = false;

    // Draw grass background from _grassCanvas
    if (_grassCanvas) {
        octx.drawImage(_grassCanvas, 0, 0);
    } else {
        _buildGrassCache();
        if (_grassCanvas) octx.drawImage(_grassCanvas, 0, 0);
    }

    // Draw non-grass tiles (roads, dirt)
    for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
            const tile = grid.tiles[ty][tx];
            if (tile !== 'tile_grass') {
                const asset = assets[tile];
                if (asset) octx.drawImage(asset, tx * T, ty * T, T, T);
            }
        }
    }

    // Draw static structures
    for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
            const s = grid.structures[ty][tx];
            if (!s || s.isChild) continue;
            const key = s.def.key;
            // monument, academy, tower, ballista_tower, gate are dynamic
            if (key === 'monument' || key === 'academy' || key === 'tower' || key === 'ballista_tower' || key === 'gate') continue;
            // Draw complete structures
            if ((s.progress ?? 1.0) >= 1.0) {
                const assetKey = s.def.assetKey;
                const asset = assets[assetKey];
                const w = s.def.width || 1;
                const h = s.def.height || 1;
                if (asset) {
                    octx.drawImage(asset, tx * T, ty * T, w * T, h * T);
                } else {
                    octx.fillStyle = s.def.color;
                    octx.fillRect(tx * T, ty * T, w * T, h * T);
                }
            }
        }
    }
    _staticCanvas = oc;
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
    octx.imageSmoothingEnabled = false;
    const x0 = Math.max(0, tx - 1), y0 = Math.max(0, ty - 1);
    const x1 = Math.min(sim.grid.width - 1, tx + w), y1 = Math.min(sim.grid.height - 1, ty + h);
    octx.clearRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    if (_grassCanvas) {
        octx.drawImage(_grassCanvas,
            x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T,
            x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    }
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const tile = sim.grid.tiles[y][x];
            if (tile !== 'tile_grass' && assets[tile]) {
                octx.drawImage(assets[tile], x * T, y * T, T, T);
            }
            const s = sim.grid.structures[y][x];
            if (!s || s.isChild) continue;
            const key = s.def.key;
            // Dynamic buildings are drawn per-frame on top of the static layer
            if (key === 'monument' || key === 'academy' || key === 'tower' || key === 'ballista_tower' || key === 'gate') continue;
            if ((s.progress ?? 1.0) < 1.0) continue;
            const asset = assets[s.def.assetKey];
            const sw = (s.def.width || 1) * T;
            const sh = (s.def.height || 1) * T;
            if (asset) {
                octx.drawImage(asset, x * T, y * T, sw, sh);
            } else {
                octx.fillStyle = s.def.color;
                octx.fillRect(x * T, y * T, sw, sh);
            }
        }
    }
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
    }, 1500);
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

    // Tavern factor (capped at +20)
    const tavernCount = sim.activeTaverns.length;
    if (tavernCount >= 2) {
        score += 20; sim.happinessFactors.push({ label: 'Taverns (2+)', signs: '+++', polarity: 'pos' });
    } else if (tavernCount === 1) {
        score += 10; sim.happinessFactors.push({ label: 'Tavern', signs: '++', polarity: 'pos' });
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
    if (gameState.happiness >= 75) return 3.0;
    if (gameState.happiness >= 40) return 5.0;
    return Infinity;
}

function formatTime(s) {
    s = Math.max(0, s);
    return `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
}

Object.assign(window, {

    rebuildStructureLists, showExpansionBanner, getAdjacencyBonus, getFoodCap,
    countBuildings, getScaledCost, calcDefense, calcHappiness, getSpawnInterval, formatTime,
    _buildStaticCache, _staticCanvas, patchStaticCache,

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
