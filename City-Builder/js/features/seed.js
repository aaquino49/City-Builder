// Pixel Dominion — Shareable map seed (Work Order E1).
import { sim, gameState, onHook } from '../core/state.js';

function seedInput() { return document.getElementById('seed-input'); }
function drawerSeedValue() { return document.getElementById('drawer-seed-value'); }

function refreshDrawerSeed() {
    const el = drawerSeedValue();
    if (el && sim.grid) el.textContent = sim.grid.seed || '';
}

// Regenerate the whole world from a seed; always runs (world-gen + caches).
function regenerateWorld(seed) {
    if (!sim.grid || typeof sim.grid.regenerate !== 'function') return;
    sim.grid.regenerate(seed);
    window.rebuildStructureLists();
    window._buildGrassCache();
    window._buildStaticCache();
    refreshDrawerSeed();
}

// Regenerate the preview world; only ever before the game starts.
function regeneratePreview(seed) {
    if (gameState.started) return;
    regenerateWorld(seed);
}

// After a world regen, starter citizens may stand inside a new tree/deposit.
// Move any citizen on a non-walkable tile to the nearest walkable tile center.
function relocateCitizensOffBlocked() {
    const list = window.citizens;
    const walkable = window.isFriendlyWalkable;
    if (!Array.isArray(list) || typeof walkable !== 'function' || !sim.grid) return;
    const T = window.TILE_SIZE || 32;
    for (const c of list) {
        const tx = Math.floor(c.x / T), ty = Math.floor(c.y / T);
        if (walkable(tx, ty)) continue;
        let found = null;
        // Ring search radius ≤ 6 around the citizen's tile.
        for (let r = 1; r <= 6 && !found; r++) {
            for (let dy = -r; dy <= r && !found; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    if (walkable(tx + dx, ty + dy)) { found = { tx: tx + dx, ty: ty + dy }; break; }
                }
            }
        }
        if (!found) continue;
        const cx = found.tx * T + T / 2, cy = found.ty * T + T / 2;
        c.x = cx; c.y = cy;
        c.targetX = cx; c.targetY = cy;
        c._path = []; c._pathIndex = 0;
    }
}

function bindSeedUI() {
    const input = seedInput();
    const shuffle = document.getElementById('seed-shuffle');
    if (!input) return;
    // Prefill with the current grid seed once the world exists.
    if (!input.value && sim.grid) input.value = sim.grid.seed || '';
    refreshDrawerSeed();
    if (shuffle && !shuffle.dataset.pdBound) {
        shuffle.dataset.pdBound = '1';
        shuffle.addEventListener('click', () => {
            const next = window.randomSeedString();
            input.value = next;
            regeneratePreview(next);
        });
    }
    if (!input.dataset.pdBound) {
        input.dataset.pdBound = '1';
        let timer = null;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const typed = input.value.trim().toUpperCase();
                if (!typed || !sim.grid) return;
                if (typed === sim.grid.seed) return;
                regeneratePreview(typed);
            }, 300);
        });
    }
    const copyBtn = document.getElementById('btn-copy-seed');
    if (copyBtn && !copyBtn.dataset.pdBound) {
        copyBtn.dataset.pdBound = '1';
        copyBtn.addEventListener('click', () => {
            const seed = (sim.grid && sim.grid.seed) || '';
            try {
                const done = () => {
                    const prev = copyBtn.textContent;
                    copyBtn.textContent = 'Copied';
                    setTimeout(() => { copyBtn.textContent = prev; }, 1200);
                };
                const p = navigator.clipboard && navigator.clipboard.writeText
                    ? navigator.clipboard.writeText(seed)
                    : Promise.reject(new Error('no clipboard'));
                p.then(done, done); // ignore failures, still flash
            } catch (err) { /* ignore failures, still flash below */ }
        });
    }
}

// Listeners don't need the grid, so bind immediately at module load; the
// seed prefill happens once the world exists (see the __initDone poll below).
bindSeedUI();

// The world boots async (assets); prefill the input once boot is done.
(function waitForInit(triesLeft) {
    if (window.__initDone) {
        const input = seedInput();
        if (input && !input.value && sim.grid) input.value = sim.grid.seed || '';
        refreshDrawerSeed();
        return;
    }
    if (triesLeft <= 0) return;
    setTimeout(() => waitForInit(triesLeft - 1), 50);
})(200); // 50 ms × 200 = max 10 s

onHook('newGame', () => {
    // newGame fires right AFTER main.js sets gameState.started = true, so the
    // preview guard would ignore a typed seed — regenerate unconditionally.
    const input = seedInput();
    const typed = input ? input.value.trim().toUpperCase() : '';
    if (typed && sim.grid && typed !== sim.grid.seed) {
        regenerateWorld(typed);
        relocateCitizensOffBlocked();
    } else refreshDrawerSeed();
    if (input && sim.grid) input.value = sim.grid.seed || '';
});

onHook('save', (data) => {
    data.ext = data.ext || {};
    if (sim.grid) data.ext.seed = sim.grid.seed;
});

onHook('load', (data) => {
    const saved = data && data.ext && data.ext.seed;
    if (saved && sim.grid) {
        // Structures come from the save; just adopt the seed, do NOT regenerate.
        sim.grid.seed = saved;
        sim.grid.rng = window.makeSeededRng(saved);
    }
    const input = seedInput();
    if (input && sim.grid) input.value = sim.grid.seed || '';
    refreshDrawerSeed();
});

onHook('uiRefresh', refreshDrawerSeed);
