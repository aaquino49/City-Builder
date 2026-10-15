// Pixel Dominion — Market building (feature module)
// A permanent shop that trades at worse rates than the wandering merchant, so
// the merchant stays a special windfall rather than a replacement.
import { sim, gameState } from '../core/state.js';

// Full spread is intentionally poor: buying costs more, selling earns less.
const TRADES = [
    { key: 'wood',  action: 'buy',  amount: 20, gold: 20 },
    { key: 'wood',  action: 'sell', amount: 20, gold: 8  },
    { key: 'stone', action: 'buy',  amount: 10, gold: 20 },
    { key: 'stone', action: 'sell', amount: 10, gold: 8  },
    { key: 'iron',  action: 'buy',  amount: 10, gold: 50 },
    { key: 'iron',  action: 'sell', amount: 10, gold: 20 },
    // Food can only be bought while there is headroom under the granary cap.
    { key: 'food',  action: 'buy',  amount: 40, gold: 30 },
];

const RES_LABELS = { gold: 'Gold', wood: 'Wood', stone: 'Stone', iron: 'Iron', food: 'Food' };
const RES_GLYPHS = { gold: '◈', wood: '◆', stone: '⬟', iron: '◇', food: '❧' };

let _modal = null;
let _statsEl = null;
let _rowsEl = null;

function _foodCap() {
    return typeof window.getFoodCap === 'function' ? window.getFoodCap() : Infinity;
}

function _canDo(t) {
    if (t.action === 'buy') {
        if (gameState.gold < t.gold) return false;
        // Buying food is pointless (and would be wasted) once the granary is full.
        if (t.key === 'food') return gameState.food < _foodCap();
        return true;
    }
    return (gameState[t.key] || 0) >= t.amount;
}

function _apply(t) {
    if (t.action === 'buy') {
        gameState.gold -= t.gold;
        if (t.key === 'food') gameState.food = Math.min(_foodCap(), gameState.food + t.amount);
        else gameState[t.key] += t.amount;
    } else {
        gameState[t.key] -= t.amount;
        gameState.gold += t.gold;
    }
    window.playTapSFX?.();
}

function _refreshStats() {
    if (!_statsEl) return;
    _statsEl.innerHTML = ['gold', 'wood', 'stone', 'iron', 'food'].map(k =>
        `<span class="market-stat"><span class="market-glyph">${RES_GLYPHS[k]}</span> ${RES_LABELS[k]} <b>${Math.round(gameState[k] || 0)}</b></span>`
    ).join('');
}

// Re-evaluate affordability after every trade — a buy can unlock a sell and
// vice-versa, so the whole grid is refreshed, not just the pressed row.
function _refreshRows() {
    if (!_rowsEl) return;
    _rowsEl.querySelectorAll('button[data-trade]').forEach(btn => {
        const t = TRADES[parseInt(btn.dataset.trade, 10)];
        btn.disabled = !t || !_canDo(t);
    });
}

function _refresh() {
    _refreshStats();
    _refreshRows();
}

function _buildModal() {
    if (_modal) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'market-modal';
    overlay.innerHTML = `
        <div class="modal-parchment market-modal-box">
            <div class="market-header">
                <div class="market-seal">⚖</div>
                <div>
                    <div class="market-title">MARKET</div>
                    <div class="market-subtitle">Steady trade, at the guild's prices</div>
                </div>
                <button id="market-close-x" class="research-close-x" title="Close">×</button>
            </div>
            <div id="market-stats" class="market-stats"></div>
            <div id="market-rows" class="market-rows"></div>
            <div class="market-footer">
                <button id="market-close" class="scroll-btn wine">CLOSE</button>
            </div>
        </div>`;
    document.getElementById('game-container').appendChild(overlay);

    _statsEl = overlay.querySelector('#market-stats');
    _rowsEl = overlay.querySelector('#market-rows');

    _rowsEl.innerHTML = TRADES.map((t, i) => {
        const verb = t.action === 'buy' ? 'BUY' : 'SELL';
        const detail = t.action === 'buy'
            ? `${t.gold} Gold  ·  +${t.amount} ${RES_LABELS[t.key]}`
            : `+${t.gold} Gold  ·  -${t.amount} ${RES_LABELS[t.key]}`;
        return `<div class="market-row">
            <div class="market-row-info">
                <div class="market-row-label">${verb} ${t.amount} ${RES_LABELS[t.key]}</div>
                <div class="market-row-cost">${detail}</div>
            </div>
            <button class="market-row-btn ${t.action}" data-trade="${i}">${verb}</button>
        </div>`;
    }).join('');

    _rowsEl.addEventListener('click', e => {
        const btn = e.target.closest('button[data-trade]');
        if (!btn || btn.disabled) return;
        const t = TRADES[parseInt(btn.dataset.trade, 10)];
        if (!t || !_canDo(t)) return;
        _apply(t);
        _refresh();
    });

    overlay.querySelector('#market-close').addEventListener('click', closeMarketModal);
    overlay.querySelector('#market-close-x').addEventListener('click', closeMarketModal);
    _modal = overlay;
}

export function openMarketModal() {
    _buildModal();
    _refresh();
    sim.gameIsPaused = true;
    _modal.classList.add('open');
}
window.openMarketModal = openMarketModal;

export function closeMarketModal() {
    if (!_modal) return;
    _modal.classList.remove('open');
    sim.gameIsPaused = false;
}
window.closeMarketModal = closeMarketModal;

// Esc closes the market (the core input handler ignores modals).
window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _modal && _modal.classList.contains('open')) {
        closeMarketModal();
    }
});
