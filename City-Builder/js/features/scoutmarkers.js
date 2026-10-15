// Pixel Dominion — Scout-phase direction markers (Work Order B2).
// Remembers the scout plan's compass dirs + size, draws pulsing edge chevrons
// while sim.scoutPhase, and marks the matching edges on the minimap.
import { sim, onHook } from '../core/state.js';

const DIRS = {
    N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1],
    S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1],
};

let remembered = null; // { dirs: [...], size: n }

onHook('scoutStart', (plan) => {
    if (!plan) return;
    remembered = { dirs: [...(plan.dirs || [])], size: plan.size || 0 };
});
const clear = () => { remembered = null; };
onHook('raidStart', clear);
onHook('raidEnd', clear);
// A load into non-scout state (or a phase that ended without hooks) drops stale markers.
onHook('frame', () => { if (!sim.scoutPhase && remembered) remembered = null; });
onHook('save', (data) => { data.ext.scoutmarkers = remembered ? { dirs: remembered.dirs, size: remembered.size } : null; });
onHook('load', (data) => {
    const s = data.ext?.scoutmarkers;
    remembered = (s && Array.isArray(s.dirs) && s.dirs.length) ? { dirs: [...s.dirs], size: s.size || 0 } : null;
});

function activeDirs() {
    if (!sim.scoutPhase || !remembered || !remembered.dirs.length) return null;
    return remembered;
}

// Ray from screen center along (dx,dy) meets the 40px-inset screen rectangle.
function edgePoint(dx, dy, w, h) {
    const cx = w / 2, cy = h / 2;
    const inset = 40;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    let t = Infinity;
    if (nx > 0) t = Math.min(t, (w - inset - cx) / nx);
    else if (nx < 0) t = Math.min(t, (inset - cx) / nx);
    if (ny > 0) t = Math.min(t, (h - inset - cy) / ny);
    else if (ny < 0) t = Math.min(t, (inset - cy) / ny);
    return { x: cx + nx * t, y: cy + ny * t, ang: Math.atan2(ny, nx) };
}

onHook('renderScreen', (ctx) => {
    const plan = activeDirs();
    if (!plan) return;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const per = Math.round(plan.size / plan.dirs.length);
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 280); // orange-red throb
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const d of plan.dirs) {
        const v = DIRS[d];
        if (!v) continue;
        const p = edgePoint(v[0], v[1], w, h);
        // Chevron pointing outward along the ray.
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#e0401a';
        const s = 11 + 3 * pulse;
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(-s * 0.6, -s * 0.75);
        ctx.lineTo(-s * 0.1, 0);
        ctx.lineTo(-s * 0.6, s * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // Count label just inside the chevron.
        ctx.globalAlpha = 1;
        ctx.font = '13px VT323, monospace';
        ctx.fillStyle = '#ffb08a';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 3;
        const lx = p.x - Math.cos(p.ang) * 22, ly = p.y - Math.sin(p.ang) * 22;
        ctx.strokeText(`${d} ~${per}`, lx, ly);
        ctx.fillText(`${d} ~${per}`, lx, ly);
    }
    ctx.restore();
});

// Short red bars on the minimap edges for the same directions. This frame hook
// is registered after minimap.js (see features/index.js) so the bars draw on
// top of the minimap's own dynamic layer each frame.
onHook('frame', () => {
    const plan = activeDirs();
    if (!plan) return;
    const map = document.getElementById('minimap-canvas');
    if (!map || !map.offsetParent) return; // hidden/collapsed → nothing to mark
    const c = map.getContext('2d');
    c.save();
    c.fillStyle = '#e03020';
    for (const d of plan.dirs) {
        const v = DIRS[d];
        if (!v) continue;
        const len = Math.hypot(v[0], v[1]) || 1;
        const nx = v[0] / len, ny = v[1] / len;
        // Point on the 160px map edge along the compass ray from map center.
        const cx = 80, cy = 80;
        let t = Infinity;
        if (nx > 0) t = Math.min(t, (158 - cx) / nx);
        else if (nx < 0) t = Math.min(t, (2 - cx) / nx);
        if (ny > 0) t = Math.min(t, (158 - cy) / ny);
        else if (ny < 0) t = Math.min(t, (2 - cy) / ny);
        const ex = cx + nx * t, ey = cy + ny * t;
        // Bar perpendicular to the ray (12px long, 3px thick).
        const px = -ny, py = nx;
        c.fillRect(Math.min(ex - px * 6, ex + px * 6) - 1, Math.min(ey - py * 6, ey + py * 6) - 1, Math.abs(px * 12) + 2, Math.abs(py * 12) + 2);
    }
    c.restore();
});
