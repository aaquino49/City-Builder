// Pixel Dominion — Shareable map seed (Work Order E1).
import { sim, gameState, onHook } from '../core/state.js';

function seedInput() { return document.getElementById('seed-input'); }
function drawerSeedValue() { return document.getElementById('drawer-seed-value'); }

function refreshDrawerSeed() {
    const el = drawerSeedValue();
    if (el && sim.grid) el.textContent = sim.grid.seed || '';
}

// Regenerate the preview world; only ever before the game starts.
function regeneratePreview(seed) {
    if (gameState.started) return;
    if (!sim.grid || typeof sim.grid.regenerate !== 'function') return;
    sim.grid.regenerate(seed);
    window.rebuildStructureLists();
    window._buildGrassCache();
    window._buildStaticCache();
    refreshDrawerSeed();
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

// The world boots async (assets); retry until sim.grid exists.
(function waitForGrid(retries) {
    if (sim.grid) { bindSeedUI(); return; }
    if (retries <= 0) return;
    setTimeout(() => waitForGrid(retries - 1), 250);
})(40);

onHook('newGame', () => {
    // Regenerate first if the typed seed differs (starter citizens stand at
    // the center, which world-gen keeps clear, so this is safe).
    const input = seedInput();
    const typed = input ? input.value.trim().toUpperCase() : '';
    if (typed && sim.grid && typed !== sim.grid.seed) regeneratePreview(typed);
    else refreshDrawerSeed();
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
