// Pixel Dominion — Minimap (Work Order B1).
// Parchment-framed 176×176 panel (bottom-left) with a 160×160 canvas (64 tiles at 2.5px).
// Base layer cached offscreen at ~4Hz; units/viewport drawn live every frame.
import { sim, gameState, onHook } from '../core/state.js';

const TILE_PX = 2.5; // 160 / 64
const MAP_PX = 160;

const panel = document.createElement('div');
panel.id = 'minimap-panel';
panel.classList.add('hidden');
const mapCanvas = document.createElement('canvas');
mapCanvas.id = 'minimap-canvas';
mapCanvas.width = MAP_PX;
mapCanvas.height = MAP_PX;
const toggle = document.createElement('button');
toggle.id = 'minimap-toggle';
toggle.textContent = '▾';
toggle.title = 'Collapse map';
const tabLabel = document.createElement('span');
tabLabel.id = 'minimap-tab-label';
tabLabel.textContent = 'MAP';
panel.appendChild(mapCanvas);
panel.appendChild(toggle);
panel.appendChild(tabLabel);
document.getElementById('game-container').appendChild(panel);

toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const collapsed = panel.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '▸' : '▾';
});

const mctx = mapCanvas.getContext('2d');
const base = document.createElement('canvas');
base.width = MAP_PX;
base.height = MAP_PX;
const bctx = base.getContext('2d');
let baseTimer = 0;

const w2m = (wx) => (wx / window.TILE_SIZE) * TILE_PX; // world px → minimap px

function redrawBase() {
    const grid = sim.grid;
    if (!grid) return;
    for (let ty = 0; ty < 64; ty++) {
        for (let tx = 0; tx < 64; tx++) {
            let color = '#5e8a3e'; // grass
            if (grid.tiles?.[ty]?.[tx] === 'tile_road') {
                color = '#888888';
            } else {
                const s = grid.structures?.[ty]?.[tx];
                if (s) {
                    const key = s.def?.key;
                    if (key === 'obstacle_tree') color = '#27531a';
                    else if (key === 'stone_deposit') color = '#6e7275';
                    else if (key === 'iron_vein') color = '#b2b9c0';
                    else if (key === 'rubble') color = '#444444';
                    else if (key === 'wall' || key === 'gate') color = '#4e4a45';
                    else color = s.def?.color || '#d9534f';
                }
            }
            bctx.fillStyle = color;
            bctx.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
        }
    }
    // Darken everything outside the territory, then ring the border in gold.
    const r = window.calcTerritoryRadius ? window.calcTerritoryRadius() : 3;
    const c = 32.5 * TILE_PX;
    bctx.save();
    bctx.beginPath();
    bctx.rect(0, 0, MAP_PX, MAP_PX);
    bctx.arc(c, c, r * TILE_PX, 0, Math.PI * 2, true);
    bctx.fillStyle = 'rgba(10, 8, 6, 0.55)';
    bctx.fill('evenodd');
    bctx.restore();
    bctx.beginPath();
    bctx.arc(c, c, r * TILE_PX, 0, Math.PI * 2);
    bctx.strokeStyle = '#c89a3b';
    bctx.lineWidth = 1;
    bctx.stroke();
}

function dot(wx, wy, color, size = 1) {
    mctx.fillStyle = color;
    mctx.fillRect(w2m(wx) - size / 2, w2m(wy) - size / 2, size, size);
}

function rallyWorld() {
    const rp = sim.rallyPoint ?? window._defendRally;
    if (!rp) return null;
    if (rp.tx !== undefined) return { x: rp.tx * window.TILE_SIZE + window.TILE_SIZE / 2, y: rp.ty * window.TILE_SIZE + window.TILE_SIZE / 2 };
    if (rp.x !== undefined) return { x: rp.x, y: rp.y };
    return null;
}

onHook('frame', (dtReal) => {
    panel.classList.toggle('hidden', !gameState.started);
    if (!gameState.started || !sim.grid) return;
    baseTimer += dtReal;
    if (baseTimer > 0.25) { baseTimer = 0; redrawBase(); } // ~4Hz base layer
    mctx.clearRect(0, 0, MAP_PX, MAP_PX);
    mctx.drawImage(base, 0, 0);
    // Units — WHY 1px dots: readable at 2.5px/tile without obscuring terrain.
    for (const c of (window.citizens || [])) dot(c.x, c.y, '#f5d742', 1);
    for (const list of [window.soldiers, window.knights, window.archers]) {
        for (const u of (list || [])) dot(u.x, u.y, '#3a7bd5', 1);
    }
    for (const r of (window.raiders || [])) dot(r.x, r.y, r.isCampGuard ? '#7a1010' : '#e03020', 1);
    if (sim.merchantNPC) dot(sim.merchantNPC.x, sim.merchantNPC.y, '#ff8c1a', 2);
    const rally = rallyWorld();
    if (rally) dot(rally.x, rally.y, '#8c2c1c', 2);
    // Raider camps as dark-red triangles.
    mctx.fillStyle = '#5a1008';
    for (const camp of (sim.raiderCamps || [])) {
        const cx = w2m(camp.x), cy = w2m(camp.y);
        mctx.beginPath();
        mctx.moveTo(cx, cy - 3);
        mctx.lineTo(cx - 2.5, cy + 2);
        mctx.lineTo(cx + 2.5, cy + 2);
        mctx.closePath();
        mctx.fill();
    }
    // Camera viewport rectangle.
    const cam = sim.camera;
    if (cam) {
        const cw = window.canvas?.width ?? 0, ch = window.canvas?.height ?? 0;
        mctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        mctx.lineWidth = 1;
        mctx.strokeRect(w2m(cam.x), w2m(cam.y), w2m(cw / cam.zoom), w2m(ch / cam.zoom));
    }
});

// Click/drag recenters the main camera; never leak the gesture to the game canvas.
function centerOn(ev) {
    const rect = mapCanvas.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * MAP_PX;
    const my = ((ev.clientY - rect.top) / rect.height) * MAP_PX;
    const cam = sim.camera;
    const main = window.canvas;
    if (!cam || !main || !sim.grid) return;
    const worldX = (mx / TILE_PX) * window.TILE_SIZE;
    const worldY = (my / TILE_PX) * window.TILE_SIZE;
    const maxX = Math.max(0, 64 * window.TILE_SIZE - main.width / cam.zoom);
    const maxY = Math.max(0, 64 * window.TILE_SIZE - main.height / cam.zoom);
    cam.x = Math.max(0, Math.min(maxX, worldX - (main.width / cam.zoom) / 2));
    cam.y = Math.max(0, Math.min(maxY, worldY - (main.height / cam.zoom) / 2));
}
let dragging = false;
mapCanvas.addEventListener('mousedown', (e) => {
    dragging = true;
    centerOn(e);
    e.stopPropagation();
    e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
    if (dragging) { centerOn(e); e.stopPropagation(); }
});
window.addEventListener('mouseup', () => { dragging = false; });
