// Pixel Dominion — Chronicle event log (Work Order B3).
// Entries are pushed by core (showEventBanner / showModal); this file owns the
// panel, its toggle (button + L key), live refresh, and save/load persistence.
import { sim, gameState, onHook } from '../core/state.js';

const panel = document.createElement('div');
panel.id = 'chronicle-panel';
const header = document.createElement('div');
header.className = 'chronicle-header';
header.textContent = 'EVENT LOG';
const list = document.createElement('div');
list.id = 'chronicle-list';
panel.appendChild(header);
panel.appendChild(list);
document.getElementById('game-container').appendChild(panel);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let lastRendered = -1;
function render() {
    const entries = sim.eventLog || [];
    if (entries.length === lastRendered) return; // live refresh without layout churn
    lastRendered = entries.length;
    if (!entries.length) {
        list.innerHTML = '<div class="chronicle-empty">No deeds recorded yet.</div>';
        return;
    }
    list.innerHTML = [...entries].reverse().map((e) => (
        `<div class="chronicle-entry"><div class="chronicle-when">Day ${esc(e.day)} · ${esc(e.season)}</div>` +
        `<div class="chronicle-title">${esc(e.title)}</div>` +
        `<div class="chronicle-desc">${esc(e.desc)}</div></div>`
    )).join('');
}

function toggle(force) {
    const open = force !== undefined ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    if (open) { lastRendered = -1; render(); }
}

document.getElementById('btn-log-icon')?.addEventListener('click', () => toggle());

document.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return; // ignore while typing
    if (e.key === 'Escape') {
        if (panel.classList.contains('open')) toggle(false);
        return;
    }
    if ((e.key === 'l' || e.key === 'L') && gameState.started && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggle();
    }
});

onHook('frame', () => {
    if (panel.classList.contains('open')) render(); // refreshes live while open
    else lastRendered = -1;
});
onHook('save', (data) => { data.ext.eventlog = (sim.eventLog || []).slice(-80); });
onHook('load', (data) => {
    const entries = data.ext?.eventlog;
    sim.eventLog = Array.isArray(entries) ? entries.filter((e) => e && e.title !== undefined).slice(-80) : [];
    lastRendered = -1;
    if (panel.classList.contains('open')) render();
});
onHook('newGame', () => { sim.eventLog = []; lastRendered = -1; });
