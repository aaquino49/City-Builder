// Pixel Dominion — Objectives checklist (Work Order E3, replaces auto-tutorial).
import { sim, gameState, onHook } from '../core/state.js';

const TOTAL = 14;
let currentIndex = 0;   // next objective to complete
let collapsed = false;
let checkTimer = 0;
let ownCampsRazed = 0;
let ownPrevCamps = 0;
let card = null;
let lastCardTop = -1;

function positionCard() {
    if (!card) return;
    const ds = document.getElementById('day-season');
    const top = ds ? Math.round(ds.getBoundingClientRect().bottom + 8) : 96;
    if (top !== lastCardTop) { // avoid a layout write every frame
        lastCardTop = top;
        card.style.top = `${top}px`;
    }
}
function academyComplete() {
    if ((sim.buildingCounts || {}).academy < 1) return false;
    if (!sim.grid) return false;
    for (let ty = 0; ty < sim.grid.height; ty++) {
        for (let tx = 0; tx < sim.grid.width; tx++) {
            const s = sim.grid.structures[ty][tx];
            if (s && !s.isChild && s.def.key === 'academy' && (s.progress ?? 1) >= 1) return true;
        }
    }
    return false;
}

function campsRazed() {
    const shared = window.__pdChronicle && window.__pdChronicle.campsRazed;
    return Math.max(ownCampsRazed, typeof shared === 'number' ? shared : 0);
}

const OBJECTIVES = [
    { text: 'Build a House', reward: 30, met: () => sim.activeHouses.length >= 1 },
    { text: 'Build a Farm', reward: 30, met: () => sim.activeFarms.length >= 1 },
    { text: 'Grow to 6 folk', reward: 40, met: () => (window.citizens || []).length >= 6 },
    { text: 'Build a Lumber Yard', reward: 30, met: () => (sim.buildingCounts || {}).lumberyard >= 1 },
    { text: 'Build a Quarry', reward: 40, met: () => (sim.buildingCounts || {}).quarry >= 1 },
    { text: 'Raise a Gate and 4 Walls', reward: 50, met: () => sim.activeGates.length >= 1 && sim.activeWalls.length >= 4 },
    { text: 'Survive your first raid', reward: 60, met: () => (sim.raidCount || 0) >= 1 },
    { text: 'Build a Barracks', reward: 50, met: () => sim.activeBarracks.length >= 1 },
    { text: 'Muster 3 soldiers', reward: 50, met: () => (window.soldiers || []).length >= 3 },
    { text: 'Build a Granary', reward: 40, met: () => sim.activeGranaries.length >= 1 },
    { text: 'Build an Academy (completed)', reward: 60, met: academyComplete },
    { text: 'Complete a research', reward: 80, met: () => Object.values(gameState.upgrades || {}).some(Boolean) },
    { text: 'Raze a raider camp', reward: 100, met: () => campsRazed() >= 1 },
    { text: 'Build the Monument', reward: 0, met: () => sim.activeMonuments.length >= 1 || !!gameState.victoryAchieved },
];

function townCenter() {
    const T = window.TILE_SIZE || 32;
    return { x: 32 * T + T / 2, y: 32 * T };
}

function completeObjective(obj) {
    if (obj.reward > 0) gameState.gold += obj.reward;
    const suffix = obj.reward > 0 ? ` — +${obj.reward} gold` : '';
    window.showEventBanner('OBJECTIVE COMPLETE', `${obj.text}${suffix}`);
    const { x, y } = townCenter();
    if (obj.reward > 0) window.spawnFloat(x, y, `+${obj.reward} gold`, '#ffdd57', 1.5);
}

function ensureCard() {
    if (card) return card;
    card = document.createElement('div');
    card.id = 'objectives-card';
    card.innerHTML = `<div class="objectives-header"><span class="objectives-title"></span><span class="objectives-toggle">–</span></div><div class="objectives-list"></div>`;
    card.querySelector('.objectives-header').addEventListener('click', () => {
        collapsed = !collapsed;
        renderCard();
    });
    (document.getElementById('game-container') || document.body).appendChild(card);
    positionCard();
    window.addEventListener('resize', positionCard);
    return card;
}

function renderCard() {
    ensureCard();
    const done = Math.min(currentIndex, TOTAL);
    card.querySelector('.objectives-title').textContent = `OBJECTIVES  ${done}/${TOTAL}`;
    card.querySelector('.objectives-toggle').textContent = collapsed ? '+' : '–';
    const list = card.querySelector('.objectives-list');
    if (collapsed) {
        list.style.display = 'none';
    } else {
        list.style.display = '';
        if (currentIndex >= TOTAL) {
            list.innerHTML = `<div class="objective-row objective-done-all">All objectives complete — reign on!</div>`;
        } else {
            let html = '';
            for (let i = currentIndex; i < Math.min(currentIndex + 3, TOTAL); i++) {
                const cls = i === currentIndex ? 'objective-row objective-current' : 'objective-row objective-next';
                const mark = i === currentIndex ? '◆ ' : '◇ ';
                html += `<div class="${cls}">${mark}${OBJECTIVES[i].text}</div>`;
            }
            list.innerHTML = html;
        }
    }
    // Visible only while the game is started.
    card.style.display = gameState.started ? '' : 'none';
    positionCard();
}

// Advance silently (no rewards) to the first unmet objective — for old saves.
function skipToFirstUnmet() {
    while (currentIndex < TOTAL) {
        let met = false;
        try { met = OBJECTIVES[currentIndex].met(); } catch (err) { met = false; }
        if (!met) break;
        currentIndex++;
    }
}

onHook('newGame', () => {
    currentIndex = 0;
    ownCampsRazed = 0;
    ownPrevCamps = (sim.raiderCamps || []).length;
    checkTimer = 0;
    renderCard();
});

onHook('save', (data) => {
    data.ext = data.ext || {};
    data.ext.objectives = { index: currentIndex };
});

onHook('load', (data) => {
    const saved = data && data.ext && data.ext.objectives;
    ownPrevCamps = (sim.raiderCamps || []).length;
    if (!saved || typeof saved.index !== 'number') {
        currentIndex = 0;
        skipToFirstUnmet(); // old saves: no rewards for skipped ones
    } else {
        currentIndex = Math.max(0, Math.min(TOTAL, saved.index));
    }
    renderCard();
});

onHook('frame', (dtRealSec) => {
    if (!gameState.started) { if (card) card.style.display = 'none'; return; }
    // Own camp-razed fallback counter (mirrors the chronicle's).
    const camps = (sim.raiderCamps || []).length;
    if (camps < ownPrevCamps) ownCampsRazed += ownPrevCamps - camps;
    ownPrevCamps = camps;
    renderCardVisibilityOnly();
    if (sim.gameIsPaused || sim.userPaused) return;
    checkTimer += dtRealSec;
    if (checkTimer < 0.5) return;
    checkTimer = 0;
    // Complete strictly in order; an already-satisfied later one completes
    // immediately once reached.
    let changed = false;
    while (currentIndex < TOTAL) {
        let met = false;
        try { met = OBJECTIVES[currentIndex].met(); } catch (err) { met = false; }
        if (!met) break;
        completeObjective(OBJECTIVES[currentIndex]);
        currentIndex++;
        changed = true;
    }
    if (changed || !card) renderCard();
});

function renderCardVisibilityOnly() {
    ensureCard();
    card.style.display = gameState.started ? '' : 'none';
}

onHook('uiRefresh', () => { if (gameState.started) renderCard(); });

// Build the card as soon as the DOM is ready (hidden until start).
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCard);
} else {
    renderCard();
}
