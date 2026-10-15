// Pixel Dominion — Income rates in the resource bar (Work Order B4).
// Samples five resources each sim-second; the per-minute slope over the sample
// window is shown under each chip once 10s of history exists.
import { gameState, onHook } from '../core/state.js';

const KEYS = ['gold', 'wood', 'stone', 'iron', 'food'];
let samples = []; // [{ t, gold, wood, stone, iron, food }], t = sim seconds, cap 61
let acc = 0;
let simClock = 0;

function ensureChips() {
    for (const k of KEYS) {
        if (document.getElementById(`rate-${k}`)) continue;
        const val = document.getElementById(`res-${k}`);
        if (!val) continue;
        const div = document.createElement('div');
        div.className = 'chip-rate flat';
        div.id = `rate-${k}`;
        div.textContent = '±0/m';
        val.insertAdjacentElement('afterend', div); // once, right after the value
    }
}

function paint() {
    const n = samples.length;
    const elapsed = n >= 2 ? samples[n - 1].t - samples[0].t : 0;
    for (const k of KEYS) {
        const el = document.getElementById(`rate-${k}`);
        if (!el) continue;
        let text = '±0/m', cls = 'chip-rate flat';
        if (elapsed >= 10) {
            const rate = (samples[n - 1][k] - samples[0][k]) / elapsed * 60;
            const r = Math.round(rate);
            if (r > 0) { text = `+${r}/m`; cls = 'chip-rate pos'; }
            else if (r < 0) { text = `−${Math.abs(r)}/m`; cls = 'chip-rate neg'; }
        }
        if (el.textContent !== text) el.textContent = text;
        if (el.className !== cls) el.className = cls;
    }
}

onHook('frame', () => { if (gameState.started) ensureChips(); });
onHook('update', (dtSec) => {
    if (!gameState.started) return;
    simClock += dtSec;
    acc += dtSec;
    if (acc < 1) return;
    acc -= 1; // one sample per sim-second (drift-free enough at 1Hz)
    samples.push({ t: simClock, gold: gameState.gold, wood: gameState.wood, stone: gameState.stone, iron: gameState.iron, food: gameState.food });
    if (samples.length > 61) samples.splice(0, samples.length - 61);
    paint();
});

const reset = () => { samples = []; acc = 0; simClock = 0; paint(); };
onHook('load', reset);
onHook('newGame', reset);
