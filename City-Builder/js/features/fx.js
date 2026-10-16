// Pixel Dominion — Tiny Swords Effects & Sheep (Work Order G1, section C4–C5)
// Transient combat effects (death skulls, explosions, burning buildings, arrows)
// plus decorative farm sheep. Hook-driven so core files stay untouched.

import { sim, TILE_SIZE, onHook } from '../core/state.js';
import { drawSprite, hasSprite } from '../render/sprites.js';

const _fx = []; // { kind:'dead'|'explosion', x, y, t }
let _sheep = []; // decorative sheep, 1 per completed farm: { hx, hy, x, y, tx, ty, timer, wait, flip, phase }

function _now() {
    return performance.now() / 1000;
}

export function spawnFx(kind, x, y) {
    if (kind !== 'dead' && kind !== 'explosion') return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    _fx.push({ kind, x, y, t: 0 });
    if (_fx.length > 120) _fx.splice(0, _fx.length - 120); // cap for endless sieges
}
window.spawnFx = spawnFx;

function _farmSignature() {
    // Completed farms only; positions identify rebuilds (new/razed farms).
    const list = sim.activeFarms || [];
    let sig = '';
    for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const s = sim.grid && sim.grid.structures[f.ty] ? sim.grid.structures[f.ty][f.tx] : null;
        if (s && (s.progress ?? 1.0) >= 1.0) sig += f.tx + ',' + f.ty + ';';
    }
    return sig;
}
let _sheepSig = null;

function _rebuildSheep() {
    _sheep = [];
    const list = sim.activeFarms || [];
    for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const s = sim.grid && sim.grid.structures[f.ty] ? sim.grid.structures[f.ty][f.tx] : null;
        if (!s || (s.progress ?? 1.0) < 1.0) continue;
        const hx = f.tx * TILE_SIZE + TILE_SIZE / 2;
        const hy = f.ty * TILE_SIZE + TILE_SIZE / 2;
        _sheep.push({
            hx, hy,
            x: hx + (Math.random() - 0.5) * TILE_SIZE,
            y: hy + (Math.random() - 0.5) * TILE_SIZE,
            tx: hx, ty: hy,
            timer: 0, wait: 1 + Math.random() * 3,
            flip: false, phase: Math.random() * 10,
        });
    }
    _sheepSig = _farmSignature();
}
// Sorted world pass (ui.js) reads this — purely visual, never blocks anything.
window.__pdSheep = _sheep;
function _syncSheepRef() {
    window.__pdSheep = _sheep;
}

function _updateSheep(dtSec) {
    const sig = _farmSignature();
    if (sig !== _sheepSig) _rebuildSheep();
    for (let i = 0; i < _sheep.length; i++) {
        const sh = _sheep[i];
        sh.timer += dtSec;
        const dx = sh.tx - sh.x, dy = sh.ty - sh.y;
        const d = Math.hypot(dx, dy);
        if (d > 2) {
            // Slow wander toward the picked graze point (~8 px/s).
            const step = Math.min(d, 8 * dtSec);
            sh.x += dx / d * step;
            sh.y += dy / d * step;
            if (Math.abs(dx) > 1) sh.flip = dx < 0;
        } else if (sh.timer >= sh.wait) {
            sh.timer = 0;
            sh.wait = 2 + Math.random() * 5;
            // New graze point within ~1 tile of the home farm.
            sh.tx = sh.hx + (Math.random() - 0.5) * TILE_SIZE * 2;
            sh.ty = sh.hy + (Math.random() - 0.5) * TILE_SIZE * 2;
        }
    }
}

onHook('update', dtSec => {
    // Age one-shot effects: skull = 14 frames @14fps (1s) then 0.4s fade;
    // explosion = 9 frames @12fps (0.75s), then gone.
    for (let i = _fx.length - 1; i >= 0; i--) {
        const f = _fx[i];
        f.t += dtSec;
        const life = f.kind === 'dead' ? 1.4 : 0.75;
        if (f.t >= life) _fx.splice(i, 1);
    }
    _updateSheep(dtSec);
});

onHook('newGame', () => {
    _fx.length = 0;
    _sheepSig = null;
    _rebuildSheep();
    _syncSheepRef();
});

onHook('load', () => {
    _fx.length = 0;
    _sheepSig = null;
    _rebuildSheep();
    _syncSheepRef();
});

onHook('renderWorld', ctx => {
    const now = _now();
    // One-shot effects (drawn after the sorted pass, like other overlays).
    for (let i = 0; i < _fx.length; i++) {
        const f = _fx[i];
        if (f.kind === 'dead') {
            const alpha = f.t > 1.0 ? Math.max(0, 1 - (f.t - 1.0) / 0.4) : 1;
            if (!drawSprite(ctx, 'fx_dead', 'idle', f.t, f.x, f.y, { alpha })) {
                // Fallback: fading grey puff ring when the sheet is missing.
                ctx.save();
                ctx.globalAlpha = alpha * 0.7;
                ctx.strokeStyle = '#bbbbbb';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(f.x, f.y - 6, 4 + f.t * 10, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        } else {
            if (!drawSprite(ctx, 'fx_explosion', 'idle', f.t, f.x, f.y)) {
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - f.t / 0.75);
                ctx.fillStyle = '#ff7722';
                ctx.beginPath();
                ctx.arc(f.x, f.y - 8, 10 + f.t * 20, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }
    // Burning buildings: Tiny Swords fire on every burning tile instead of
    // the old effect_fire sprite (base sits on the tile's bottom edge).
    const fires = sim.incidentManager && sim.incidentManager.active && sim.incidentManager.active.type === 'fire'
        ? sim.incidentManager.active.fires : null;
    if (fires && hasSprite('fx_fire')) {
        for (let i = 0; i < fires.length; i++) {
            const fire = fires[i];
            drawSprite(ctx, 'fx_fire', 'idle', now + (fire.tx * 7 + fire.ty * 13) * 0.13,
                fire.tx * TILE_SIZE + TILE_SIZE / 2, (fire.ty + 1) * TILE_SIZE);
        }
    }
    // Arrow projectiles: frame 0 rotated to the velocity direction.
    const projs = window.activeProjectiles;
    if (projs && projs.length) {
        if (hasSprite('fx_arrow')) {
            for (let i = 0; i < projs.length; i++) {
                const p = projs[i];
                if (p.type !== 'arrow') continue; // bolts keep their tracer
                drawSprite(ctx, 'fx_arrow', 'fly', 0, p.x, p.y, { rotation: Math.atan2(p.vy, p.vx) });
            }
        } else {
            // Fallback tracer when the sheet failed to load.
            ctx.save();
            ctx.strokeStyle = '#ddaa55';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < projs.length; i++) {
                const p = projs[i];
                if (p.type !== 'arrow') continue;
                ctx.beginPath();
                ctx.moveTo(p.x - p.vx * 0.05, p.y - (p.vy - p.g * 0.05) * 0.05);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
});
