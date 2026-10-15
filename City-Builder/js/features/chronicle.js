// Pixel Dominion — End-of-game chronicle / reign stats (Work Order E2).
import { sim, gameState, onHook } from '../core/state.js';

const tracker = {
    samples: [],       // { day, folk, military, gold, food, raidersDefeated }
    lastDay: 0,
    peakFolk: 0,
    raidsWon: 0,
    raidsLost: 0,
    maxBuildings: 0,
    campsRazed: 0,
    prevCamps: 0,
    suppressCampCount: false,
};

function folkCount() { return (window.citizens || []).length; }
function militaryCount() {
    return (window.soldiers || []).length + (window.archers || []).length + (window.knights || []).length;
}

// Count placed BUILDINGS (root structures only, skip 2×2 children).
function countBuildings() {
    if (!sim.grid) return 0;
    const B = window.BUILDINGS || {};
    let n = 0;
    for (let ty = 0; ty < sim.grid.height; ty++) {
        for (let tx = 0; tx < sim.grid.width; tx++) {
            const s = sim.grid.structures[ty][tx];
            if (!s || s.isChild) continue;
            if (B[s.def.key]) n++;
        }
    }
    return n;
}

function takeSample() {
    tracker.samples.push({
        day: gameState.day,
        folk: folkCount(),
        military: militaryCount(),
        gold: Math.round(gameState.gold || 0),
        food: Math.round(gameState.food || 0),
        raidersDefeated: gameState.raidersDefeated || 0,
    });
    tracker.peakFolk = Math.max(tracker.peakFolk, folkCount());
    tracker.maxBuildings = Math.max(tracker.maxBuildings, countBuildings());
}

function resetTracker() {
    tracker.samples = [];
    tracker.lastDay = gameState.day || 1;
    tracker.peakFolk = folkCount();
    tracker.raidsWon = 0;
    tracker.raidsLost = 0;
    tracker.maxBuildings = countBuildings();
    tracker.campsRazed = 0;
    tracker.prevCamps = (sim.raiderCamps || []).length;
    tracker.suppressCampCount = false;
    publishCounter();
}

function publishCounter() {
    // Shared with the objectives feature (E3 #13).
    window.__pdChronicle = window.__pdChronicle || {};
    window.__pdChronicle.campsRazed = tracker.campsRazed;
}

function countOutcome(outcome) {
    if (outcome === 'won') tracker.raidsWon++;
    else if (outcome === 'lost') tracker.raidsLost++;
}

onHook('newGame', resetTracker);

onHook('update', () => {
    if (!gameState.started) return;
    // Camp razed detection (outside of load).
    const camps = (sim.raiderCamps || []).length;
    if (!tracker.suppressCampCount && camps < tracker.prevCamps) {
        tracker.campsRazed += tracker.prevCamps - camps;
        publishCounter();
    }
    tracker.prevCamps = camps;
    // One sample per new in-game day.
    if (gameState.day !== tracker.lastDay) {
        tracker.lastDay = gameState.day;
        takeSample();
    }
});

onHook('raidEnd', () => {
    countOutcome(sim.lastRaidOutcome);
    sim.lastRaidOutcome = null;
});

function sparkline(values, label) {
    // Graceful with 0–1 samples.
    if (!values || values.length < 2) {
        return `<div class="chronicle-chart"><div class="chronicle-chart-label">${label}</div><div class="chronicle-chart-empty">—</div></div>`;
    }
    const W = 220, H = 48, PAD = 4;
    const min = Math.min(...values), max = Math.max(...values);
    const span = (max - min) || 1;
    const stepX = (W - PAD * 2) / (values.length - 1);
    const pts = values.map((v, i) => {
        const x = (PAD + i * stepX).toFixed(1);
        const y = (H - PAD - ((v - min) / span) * (H - PAD * 2)).toFixed(1);
        return `${x},${y}`;
    });
    const line = pts.join(' ');
    const area = `${PAD},${H - PAD} ${line} ${(W - PAD).toFixed(1)},${H - PAD}`;
    return `<div class="chronicle-chart"><div class="chronicle-chart-label">${label}</div>` +
        `<svg class="chronicle-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
        `<polygon points="${area}" class="chronicle-spark-fill"/>` +
        `<polyline points="${line}" class="chronicle-spark-line"/>` +
        `<text x="${PAD}" y="${H - 1}" class="chronicle-spark-minmax">${min}</text>` +
        `<text x="${W - PAD}" y="10" text-anchor="end" class="chronicle-spark-minmax">${max}</text>` +
        `</svg></div>`;
}

function renderChronicle() {
    const statsEl = document.getElementById('game-over-stats');
    if (!statsEl) return;
    statsEl.querySelectorAll('.chronicle-section').forEach(el => el.remove());
    const seed = (sim.grid && sim.grid.seed) || '—';
    const totals =
        `<div class="chronicle-totals">` +
        `<div class="chronicle-total"><span class="chronicle-total-num">${tracker.peakFolk}</span><span class="chronicle-total-cap">PEAK FOLK</span></div>` +
        `<div class="chronicle-total"><span class="chronicle-total-num">${tracker.raidsWon}W/${tracker.raidsLost}L</span><span class="chronicle-total-cap">RAIDS</span></div>` +
        `<div class="chronicle-total"><span class="chronicle-total-num">${tracker.campsRazed}</span><span class="chronicle-total-cap">CAMPS RAZED</span></div>` +
        `<div class="chronicle-total"><span class="chronicle-total-num">${tracker.maxBuildings}</span><span class="chronicle-total-cap">BUILDINGS</span></div>` +
        `<div class="chronicle-total"><span class="chronicle-total-num">${seed}</span><span class="chronicle-total-cap">SEED</span></div>` +
        `</div>`;
    const days = tracker.samples.map(s => s.day);
    const folk = tracker.samples.map(s => s.folk);
    const mil = tracker.samples.map(s => s.military);
    const gold = tracker.samples.map(s => s.gold);
    const range = days.length ? `DAY ${days[0]}–${days[days.length - 1]}` : 'NO SAMPLES YET';
    const section = document.createElement('div');
    section.className = 'chronicle-section';
    section.innerHTML =
        `<div class="chronicle-title">CHRONICLE OF YOUR REIGN</div>` +
        `<div class="chronicle-range">${range}</div>` +
        totals +
        `<div class="chronicle-charts">` +
        sparkline(folk, 'FOLK') + sparkline(mil, 'MILITARY') + sparkline(gold, 'GOLD') +
        `</div>`;
    statsEl.appendChild(section);
}

onHook('gameOver', () => {
    // A wave-10 victory skips raidEnd — count a still-pending outcome here.
    if (sim.lastRaidOutcome) {
        countOutcome(sim.lastRaidOutcome);
        sim.lastRaidOutcome = null;
    }
    renderChronicle();
});

onHook('save', (data) => {
    data.ext = data.ext || {};
    data.ext.chronicle = {
        samples: tracker.samples,
        lastDay: tracker.lastDay,
        peakFolk: tracker.peakFolk,
        raidsWon: tracker.raidsWon,
        raidsLost: tracker.raidsLost,
        maxBuildings: tracker.maxBuildings,
        campsRazed: tracker.campsRazed,
    };
});

onHook('load', (data) => {
    const c = data && data.ext && data.ext.chronicle;
    if (!c) {
        // Old save: start fresh but keep counters sane.
        tracker.samples = [];
        tracker.lastDay = gameState.day || 1;
        tracker.peakFolk = folkCount();
        tracker.raidsWon = 0;
        tracker.raidsLost = 0;
        tracker.maxBuildings = countBuildings();
        tracker.campsRazed = 0;
    } else {
        tracker.samples = Array.isArray(c.samples) ? c.samples : [];
        tracker.lastDay = c.lastDay ?? (gameState.day || 1);
        tracker.peakFolk = c.peakFolk ?? 0;
        tracker.raidsWon = c.raidsWon ?? 0;
        tracker.raidsLost = c.raidsLost ?? 0;
        tracker.maxBuildings = c.maxBuildings ?? 0;
        tracker.campsRazed = c.campsRazed ?? 0;
    }
    tracker.prevCamps = (sim.raiderCamps || []).length;
    tracker.suppressCampCount = false;
    publishCounter();
});
