// Pixel Dominion — Controls Feature (Work Order A)
// A1 drag-to-build lines · A2 player rally flag · A3 hotkeys & game speed.
import {
    sim, gameState, onHook,
    TILE_SIZE, BUILDINGS, ROAD_COST, GRID_WIDTH, GRID_HEIGHT,
} from '../core/state.js';

// ===================== SHARED HELPERS =====================
function _canvasEl() {
    return document.getElementById('game-canvas');
}

// Centre the camera on a world-px point, clamped to the map bounds.
function _centerCamera(worldX, worldY) {
    const cv = window.canvas || _canvasEl();
    const { zoom } = sim.camera;
    sim.camera.x = worldX - cv.width / (2 * zoom);
    sim.camera.y = worldY - cv.height / (2 * zoom);
    const maxX = Math.max(0, GRID_WIDTH * TILE_SIZE - cv.width / zoom);
    const maxY = Math.max(0, GRID_HEIGHT * TILE_SIZE - cv.height / zoom);
    sim.camera.x = Math.max(0, Math.min(maxX, sim.camera.x));
    sim.camera.y = Math.max(0, Math.min(maxY, sim.camera.y));
}

function _inTerritory(tx, ty) {
    return Math.hypot(tx - 32, ty - 32) <= window.calcTerritoryRadius();
}

// ===================== A1: DRAG-TO-BUILD LINES =====================
const _drag = {
    active: false,
    startTX: 0, startTY: 0,
    curTX: 0, curTY: 0,
    startClientX: 0, startClientY: 0,
};

// Straight line along the dominant axis from start to current tile.
function _lineTiles() {
    const { startTX, startTY, curTX, curTY } = _drag;
    const dx = curTX - startTX;
    const dy = curTY - startTY;
    const tiles = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
        const step = dx >= 0 ? 1 : -1;
        for (let x = startTX; ; x += step) {
            tiles.push({ tx: x, ty: startTY });
            if (x === curTX) break;
        }
    } else {
        const step = dy >= 0 ? 1 : -1;
        for (let y = startTY; ; y += step) {
            tiles.push({ tx: startTX, ty: y });
            if (y === curTY) break;
        }
    }
    return tiles;
}

function _canBuildTile(tool, tx, ty) {
    if (!sim.grid.inBounds(tx, ty) || !_inTerritory(tx, ty)) return false;
    if (tool === 'wall') return sim.grid.canPlace(tx, ty);
    // road: empty tile that is not already a road
    if (sim.grid.structures[ty][tx]) return false;
    return sim.grid.tiles[ty][tx] !== 'tile_road';
}

function _cancelDrag() {
    _drag.active = false;
}

// Build the committed line tile by tile through the existing click handler.
function _commitLine(tool) {
    const wallDef = BUILDINGS.wall;
    for (const { tx, ty } of _lineTiles()) {
        if (!_canBuildTile(tool, tx, ty)) continue; // skip blocked / outside — avoids error spam
        if (tool === 'wall') {
            if (gameState.gold < wallDef.cost || gameState.wood < (wallDef.woodCost || 0)) break;
        } else if (gameState.gold < ROAD_COST) {
            break; // stop at the first tile the player can no longer afford
        }
        const clientX = ((tx + 0.5) * TILE_SIZE - sim.camera.x) * sim.camera.zoom;
        const clientY = ((ty + 0.5) * TILE_SIZE - sim.camera.y) * sim.camera.zoom;
        window.handleGridClick(clientX, clientY);
    }
}

function _renderBuildGhost(ctx) {
    if (!_drag.active) return;
    const tool = gameState.selectedTool;
    if (tool !== 'wall' && tool !== 'road') return;
    const wallDef = BUILDINGS.wall;
    const zoom = sim.camera.zoom;
    let count = 0, gold = 0, wood = 0;
    for (const { tx, ty } of _lineTiles()) {
        const ok = _canBuildTile(tool, tx, ty);
        ctx.fillStyle = ok ? 'rgba(90, 200, 90, 0.35)' : 'rgba(210, 70, 70, 0.35)';
        ctx.strokeStyle = ok ? 'rgba(90, 220, 90, 0.9)' : 'rgba(230, 90, 90, 0.9)';
        ctx.lineWidth = 1 / zoom;
        ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(tx * TILE_SIZE + 0.5, ty * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        if (ok) {
            count++;
            if (tool === 'wall') { gold += wallDef.cost; wood += wallDef.woodCost || 0; }
            else gold += ROAD_COST;
        }
    }
    const label = (tool === 'wall' && wood > 0)
        ? `${count} tiles · ${gold}G [+${wood}W]`
        : `${count} tiles · ${gold}G`;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 / zoom;
    ctx.strokeStyle = 'rgba(20, 12, 6, 0.85)';
    ctx.fillStyle = '#f5e2c0';
    const lx = _drag.curTX * TILE_SIZE + TILE_SIZE / 2;
    const ly = _drag.curTY * TILE_SIZE - 8;
    ctx.strokeText(label, lx, ly);
    ctx.fillText(label, lx, ly);
}

// input.js delegates its left-button mouse lifecycle here while a build line is
// being drawn (returning true suppresses the normal camera pan / single click).
window.__pdDragBuild = {
    onDown(e) {
        const tool = gameState.selectedTool;
        if (tool !== 'wall' && tool !== 'road') return false;
        if (!gameState.started || sim.gameIsPaused || sim.userPaused) return false;
        const { tx, ty } = sim.grid.screenToGrid(e.clientX, e.clientY);
        if (!sim.grid.inBounds(tx, ty)) return false;
        _drag.active = true;
        _drag.startTX = tx; _drag.startTY = ty;
        _drag.curTX = tx; _drag.curTY = ty;
        _drag.startClientX = e.clientX; _drag.startClientY = e.clientY;
        return true;
    },
    onMove(e) {
        if (!_drag.active) return false;
        const { tx, ty } = sim.grid.screenToGrid(e.clientX, e.clientY);
        _drag.curTX = tx; _drag.curTY = ty;
        return true;
    },
    onUp(e) {
        if (!_drag.active) return false;
        const tool = gameState.selectedTool;
        _drag.active = false;
        if (Math.hypot(e.clientX - _drag.startClientX, e.clientY - _drag.startClientY) < 5) {
            // A short press is still a normal single click
            if (window.handleGridClick) window.handleGridClick(e.clientX, e.clientY);
            return true;
        }
        _commitLine(tool);
        return true;
    },
};

// ===================== A2: PLAYER RALLY FLAG =====================
let _rallyArmed = false;

function _rallyButton() {
    return document.getElementById('btn-rally');
}

function _updateRallyButton() {
    const btn = _rallyButton();
    if (btn) btn.classList.toggle('active', _rallyArmed || !!sim.rallyPoint);
}

function _setCursor() {
    const cv = _canvasEl();
    if (cv) cv.style.cursor = _rallyArmed ? 'crosshair' : 'default';
}

function _disarmRally() {
    if (!_rallyArmed) return;
    _rallyArmed = false;
    _setCursor();
    _updateRallyButton();
}

function _initRally() {
    const btn = _rallyButton();
    if (btn) {
        btn.addEventListener('click', () => {
            if (sim.rallyPoint) {
                sim.rallyPoint = null;
                _rallyArmed = false;
            } else {
                _rallyArmed = !_rallyArmed;
            }
            _setCursor();
            _updateRallyButton();
        });
    }
    // Owns canvas clicks while armed; core handleGridClick calls this after bounds check.
    sim.clickInterceptor = (tx, ty) => {
        if (!_rallyArmed) return false;
        if (window.isFriendlyWalkable(tx, ty) && _inTerritory(tx, ty)) {
            sim.rallyPoint = { tx, ty };
            _rallyArmed = false;
            _setCursor();
            _updateRallyButton();
            if (window.playTapSFX) window.playTapSFX();
            return true;
        }
        if (window.playErrorSFX) window.playErrorSFX();
        if (window.spawnFloat) window.spawnFloat(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE, 'Invalid rally point', '#ff2222', 1.2);
        return true; // stay armed
    };
    _updateRallyButton();
}

function _renderRallyFlag(ctx) {
    if (!sim.rallyPoint) return;
    const { tx, ty } = sim.rallyPoint;
    const zoom = sim.camera.zoom;
    const px = tx * TILE_SIZE + TILE_SIZE / 2;
    const pyBase = ty * TILE_SIZE + TILE_SIZE - 3;
    const pyTop = ty * TILE_SIZE - 6;
    ctx.save();
    ctx.globalAlpha = sim.combatMode === 'defend' ? 1.0 : 0.4;
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(px, pyBase);
    ctx.lineTo(px, pyTop);
    ctx.stroke();
    const wave = Math.sin(performance.now() / 180) * 2.5;
    ctx.fillStyle = '#8c2c1c';
    ctx.beginPath();
    ctx.moveTo(px, pyTop);
    ctx.lineTo(px + 15, pyTop + 4 + wave);
    ctx.lineTo(px, pyTop + 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ===================== A3: HOTKEYS & GAME SPEED =====================
function _setSpeed(v) {
    sim.timeScale = Math.max(1, Math.min(3, v));
    if (window.updateTimePauseUI) window.updateTimePauseUI();
}

function _findAction() {
    const cv = window.canvas || _canvasEl();
    const walkers = window.raiders.filter(r => r.state === 'walking' && !r.isCampGuard);
    if (walkers.length > 0) {
        let sx = 0, sy = 0;
        for (const r of walkers) { sx += r.x; sy += r.y; }
        _centerCamera(sx / walkers.length, sy / walkers.length);
        return;
    }
    const camps = sim.raiderCamps || [];
    if (camps.length > 0) {
        const cx = sim.camera.x + cv.width / (2 * sim.camera.zoom);
        const cy = sim.camera.y + cv.height / (2 * sim.camera.zoom);
        let best = camps[0], bestD = Infinity;
        for (const c of camps) {
            const d = (c.x - cx) * (c.x - cx) + (c.y - cy) * (c.y - cy);
            if (d < bestD) { bestD = d; best = c; }
        }
        _centerCamera(best.x, best.y);
        return;
    }
    const wx = sim.camera.x + cv.width / (2 * sim.camera.zoom);
    const wy = sim.camera.y + cv.height / (2 * sim.camera.zoom);
    if (window.spawnFloat) window.spawnFloat(wx, wy, 'All quiet', '#ffdd57', 1.2);
}

window.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!gameState.started) return;
    const key = e.key;
    if (key === '-' || key === '_') { _setSpeed((sim.timeScale || 1) - 1); return; }
    if (key === '=' || key === '+') { _setSpeed((sim.timeScale || 1) + 1); return; }
    if (key === 'f' || key === 'F') { _findAction(); return; }
    if (key === 'h' || key === 'H' || key === 'Home') { _centerCamera(32.5 * TILE_SIZE, 32.5 * TILE_SIZE); return; }
    if (key === 'Escape') { _cancelDrag(); _disarmRally(); return; }
});

// Right-click / focus loss cancels any in-progress build drag or rally arming.
window.addEventListener('contextmenu', () => { _cancelDrag(); _disarmRally(); });
window.addEventListener('blur', () => { _cancelDrag(); });

// ===================== HOOKS =====================
onHook('renderWorld', ctx => {
    _renderBuildGhost(ctx);
    _renderRallyFlag(ctx);
});
onHook('frame', () => {
    // Re-assert the crosshair so core cursor resets can't hide rally arming.
    if (_rallyArmed && !sim.isDragging) {
        const cv = _canvasEl();
        if (cv && cv.style.cursor !== 'crosshair') cv.style.cursor = 'crosshair';
    }
});
onHook('save', data => {
    data.ext = data.ext || {};
    data.ext.controls = {
        rallyPoint: sim.rallyPoint ? { tx: sim.rallyPoint.tx, ty: sim.rallyPoint.ty } : null,
    };
});
onHook('load', data => {
    const rp = data.ext && data.ext.controls ? data.ext.controls.rallyPoint : null;
    sim.rallyPoint = (rp && Number.isFinite(rp.tx) && Number.isFinite(rp.ty))
        ? { tx: rp.tx, ty: rp.ty }
        : null;
    _rallyArmed = false;
    _updateRallyButton();
});
onHook('newGame', () => {
    sim.rallyPoint = null;
    _rallyArmed = false;
    _updateRallyButton();
});
onHook('uiRefresh', _updateRallyButton);

_initRally();
