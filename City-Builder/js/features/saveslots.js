// Pixel Dominion — Save slots ("Chronicles of the Realm") (feature module)
// Replaces the old single manual-save button with three named slots plus the
// rolling autosave. Manual slots survive reset; only the autosave is cleared.
import { sim, gameState } from '../core/state.js';

const SLOT_KEYS = ['pixel_dominion_slot_1', 'pixel_dominion_slot_2', 'pixel_dominion_slot_3'];
const AUTOSAVE_KEY = window.SAVE_KEY || 'pixel_dominion_save';
const LEGACY_MANUAL_KEY = window.MANUAL_SAVE_KEY || 'pixel_dominion_save_manual';

let _modal = null;
let _rowsEl = null;
let _pausedForOpen = false;
let _loadedDuringOpen = false;

// Slots are user-facing from the first open, but a legacy single manual save
// (from before slots existed) should not be lost — migrate it into slot 1 once.
function _migrateLegacyManualSave() {
    try {
        if (!localStorage.getItem(SLOT_KEYS[0]) && localStorage.getItem(LEGACY_MANUAL_KEY)) {
            localStorage.setItem(SLOT_KEYS[0], localStorage.getItem(LEGACY_MANUAL_KEY));
        }
    } catch (err) { /* storage unavailable — nothing to migrate */ }
}

function _hasAnySave() {
    try {
        return SLOT_KEYS.some(k => localStorage.getItem(k)) || !!localStorage.getItem(AUTOSAVE_KEY);
    } catch (err) {
        return false;
    }
}

// The start-screen LOAD button should only invite a load when something exists.
function _updateStartLoadVisibility() {
    const btn = document.getElementById('btn-start-load');
    if (btn) btn.style.display = _hasAnySave() ? '' : 'none';
}

function _formatTime(ts) {
    if (!ts) return '';
    try {
        return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (err) {
        return '';
    }
}

function _describe(meta) {
    return `Day ${meta.day} · ${meta.season} · Wave ${meta.wave} · ${meta.population} folk · ${meta.gold} gold`;
}

function _metaFor(key) {
    return typeof window.readSaveMeta === 'function' ? window.readSaveMeta(key) : null;
}

function _buildModal() {
    if (_modal) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'saveslots-modal';
    overlay.innerHTML = `
        <div class="modal-parchment saveslots-modal-box">
            <div class="saveslots-header">
                <div class="saveslots-seal">✎</div>
                <div>
                    <div class="saveslots-title">CHRONICLES OF THE REALM</div>
                    <div class="saveslots-subtitle">Record your reign — or return to a past one</div>
                </div>
                <button id="saveslots-close-x" class="research-close-x" title="Close">×</button>
            </div>
            <div id="saveslots-rows" class="saveslots-rows"></div>
            <div class="saveslots-footer">
                <button id="saveslots-close" class="scroll-btn wine">CLOSE</button>
            </div>
        </div>`;
    document.getElementById('game-container').appendChild(overlay);

    _rowsEl = overlay.querySelector('#saveslots-rows');
    _rowsEl.addEventListener('click', e => {
        const btn = e.target.closest('button[data-act]');
        if (!btn || btn.disabled) return;
        const key = btn.dataset.key;
        const act = btn.dataset.act;
        if (act === 'save') _doSave(key);
        else if (act === 'load') _doLoad(key);
        else if (act === 'delete') _doDelete(key);
    });

    overlay.querySelector('#saveslots-close').addEventListener('click', _close);
    overlay.querySelector('#saveslots-close-x').addEventListener('click', _close);
    _modal = overlay;
}

function _renderRows() {
    if (!_rowsEl) return;
    const running = !!gameState.started;
    const entries = [
        ...SLOT_KEYS.map((key, i) => ({ key, label: `Slot ${i + 1}`, manual: true })),
        { key: AUTOSAVE_KEY, label: 'Autosave', manual: false },
    ];
    _rowsEl.innerHTML = entries.map(s => {
        const meta = _metaFor(s.key);
        const summary = meta
            ? `<div class="saveslots-meta">${_describe(meta)}</div>
               <div class="saveslots-time">Saved ${_formatTime(meta.savedAt) || '—'}</div>`
            : `<div class="saveslots-meta empty">— empty —</div>`;
        const actions = [];
        // SAVE only appears while a reign is actually running.
        if (s.manual && running) actions.push(`<button class="scroll-btn" data-act="save" data-key="${s.key}">SAVE</button>`);
        actions.push(`<button class="scroll-btn" data-act="load" data-key="${s.key}"${meta ? '' : ' disabled'}>LOAD</button>`);
        if (s.manual) actions.push(`<button class="scroll-btn danger" data-act="delete" data-key="${s.key}"${meta ? '' : ' disabled'}>DELETE</button>`);
        return `<div class="saveslots-row${s.manual ? '' : ' autosave'}">
            <div class="saveslots-info">
                <div class="saveslots-name">${s.label}</div>
                ${summary}
            </div>
            <div class="saveslots-actions">${actions.join('')}</div>
        </div>`;
    }).join('');
}

function _doSave(slotKey) {
    const meta = _metaFor(slotKey);
    if (meta && !confirm(`Overwrite this saved reign?\n${_describe(meta)}`)) return;
    if (typeof window.saveGame !== 'function') return;
    window.saveGame(slotKey);
    window.flashAutosave?.();
    _renderRows();
    _updateStartLoadVisibility();
}

function _doLoad(slotKey) {
    if (typeof window.loadAndStart !== 'function') return;
    _loadedDuringOpen = true;
    window.loadAndStart(slotKey);
    _close();
}

function _doDelete(slotKey) {
    if (!confirm('Delete this saved reign? This cannot be undone.')) return;
    try { localStorage.removeItem(slotKey); } catch (err) { /* ignore */ }
    _renderRows();
    _updateStartLoadVisibility();
}

function _close() {
    if (!_modal) return;
    _modal.classList.remove('open');
    // A load already restored the running state (and hid the start screen).
    if (_pausedForOpen && !_loadedDuringOpen) sim.gameIsPaused = false;
    _pausedForOpen = false;
    _loadedDuringOpen = false;
}

export function openSaveSlots() {
    _migrateLegacyManualSave();
    _buildModal();
    _loadedDuringOpen = false;
    // Pause only while a reign is running — from the start screen there is
    // nothing to pause and SAVE is not offered.
    _pausedForOpen = !!gameState.started;
    if (_pausedForOpen) sim.gameIsPaused = true;
    _renderRows();
    _updateStartLoadVisibility();
    _modal.classList.add('open');
}
window.openSaveSlots = openSaveSlots;

// The start screen offers "LOAD REIGN" (no SAVE, since no game is running yet).
document.getElementById('btn-start-load')?.addEventListener('click', () => openSaveSlots());

// Esc closes the browser (the core input handler ignores modals).
window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _modal && _modal.classList.contains('open')) {
        _close();
    }
});

// Compute the start-screen button state on boot.
_migrateLegacyManualSave();
_updateStartLoadVisibility();
