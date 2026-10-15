// Pixel Dominion — Mechanics feature (Work Order C)
// Repairs support, militia ("CALL TO ARMS"), defense-damage helper, gate
// SHIFT-click flag, and the DEF chip tooltip. Core combat/repair hooks live
// in main.js / entities.js / systems.js / ui.js as small surgical edits.

import { sim, gameState, onHook } from '../core/state.js';

// C5: single shared formula — higher Defense reduces raider structure damage.
window.getDefenseDamageReduction = function getDefenseDamageReduction() {
    const defense = gameState.defense || 0;
    return Math.min(0.35, defense / (defense + 1000));
};

// C4: gate SHIFT+click flag read by main.js handleGridClick (which has no event).
window.__pdShiftHeld = false;
window.addEventListener('keydown', (e) => { if (e.key === 'Shift') window.__pdShiftHeld = true; });
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') window.__pdShiftHeld = false; });

// C2: Militia — "CALL TO ARMS".
let _militiaCooldown = 0;
let _militiaBtnKey = null;

function _updateMilitiaBtn() {
    const btn = document.getElementById('btn-militia');
    if (!btn) return;
    const active = !!(sim.raidActive || sim.scoutPhase);
    const key = `${active}|${Math.ceil(_militiaCooldown)}`;
    if (key === _militiaBtnKey) return; // only touch the DOM when state changes
    _militiaBtnKey = key;
    if (!active) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.textContent = '✊ ARM FOLK';
    } else if (_militiaCooldown > 0) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.textContent = `✊ ARM FOLK (${Math.ceil(_militiaCooldown)}s)`;
    } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = '✊ ARM FOLK';
    }
}

function _armMilitia() {
    if (!(sim.raidActive || sim.scoutPhase) || _militiaCooldown > 0) return;
    const list = window.citizens;
    if (!list || list.length === 0) return;
    // Prefer hiding/idle citizens, then anyone.
    const ordered = [...list].sort((a, b) => {
        const pri = (c) => (c.job === 'hiding' || c.job === 'idle') ? 0 : 1;
        return pri(a) - pri(b);
    });
    const n = Math.min(5, ordered.length);
    let armed = 0;
    for (let i = 0; i < n; i++) {
        const c = ordered[i];
        const idx = list.indexOf(c);
        if (idx === -1) continue;
        list.splice(idx, 1);
        c._alive = false;
        gameState.population = Math.max(0, gameState.population - 1);
        const m = new window.Soldier(c.x, c.y);
        m.isMilitia = true;
        const hp = gameState.upgrades?.militia_drills ? 100 : 60;
        m.hp = hp;
        m.maxHp = hp;
        window.soldiers.push(m);
        armed++;
    }
    if (armed === 0) return;
    window.adjustMorale(-3);
    _militiaCooldown = 20;
    window.showEventBanner('CALL TO ARMS', `${armed} folk take up arms!`);
    window.markUIDirty?.();
    _militiaBtnKey = null;
    _updateMilitiaBtn();
}

const _militiaBtn = document.getElementById('btn-militia');
if (_militiaBtn) _militiaBtn.addEventListener('click', _armMilitia);

onHook('frame', (dtRealSec) => {
    if (_militiaCooldown > 0) _militiaCooldown = Math.max(0, _militiaCooldown - dtRealSec);
    _updateMilitiaBtn();
});

// C2: surviving militia return to civilian life after the raid.
onHook('raidEnd', () => {
    const sols = window.soldiers;
    if (!sols) return;
    let returned = 0;
    for (let i = sols.length - 1; i >= 0; i--) {
        const m = sols[i];
        if (!m.isMilitia) continue;
        sols.splice(i, 1);
        window.citizens.push(new window.Citizen(m.x, m.y));
        gameState.population++;
        returned++;
    }
    if (returned > 0) window.markUIDirty?.();
});

// C5: DEF chip tooltip shows the live damage reduction.
onHook('uiRefresh', () => {
    const el = document.getElementById('res-defense');
    const chip = el ? el.closest('.res-chip') : null;
    if (!chip) return;
    const def = gameState.defense || 0;
    const pct = Math.round(window.getDefenseDamageReduction() * 100);
    chip.title = `Defense ${def} — raiders deal −${pct}% damage to your buildings`;
});
