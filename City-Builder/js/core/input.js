import {
    sim,
} from './state.js';

// Pixel Dominion — Input Manager Module
// Handles keyboard, mouse, and wheel events.
// Reassignable state reads/writes flow through the shared sim object.

// ===================== KEYBOARD =====================
window.addEventListener('keydown', e => {
    // Never intercept typing in form fields (e.g. the leaderboard name input —
    // previously typing "m"/"n" toggled audio and Space toggled pause)
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    window.keys[e.key.toLowerCase()] = true;
    if (!window.gameState.started) return;

    // 1-9: select build tools, 0: demolish
    if (e.key >= '1' && e.key <= '9' && !sim.gameIsPaused) {
        const idx = parseInt(e.key) - 1;
        if (idx < window._BUILD_SHORTCUT_TOOLS.length) {
            window.gameState.selectedTool = window._BUILD_SHORTCUT_TOOLS[idx];
            if (window.updateBuildMenu) window.updateBuildMenu();
        }
        return;
    }
    if (e.key === '0' && !sim.gameIsPaused) {
        window.gameState.selectedTool = 'demolish';
        if (window.updateBuildMenu) window.updateBuildMenu();
        return;
    }
    if (e.key === 'Escape') {
        window.gameState.selectedTool = null;
        if (window.updateBuildMenu) window.updateBuildMenu();
        if (sim.statsOverlayVisible && window.toggleStatsOverlay) window.toggleStatsOverlay();
        return;
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        if (!sim.gameIsPaused && window.toggleStatsOverlay) window.toggleStatsOverlay();
        return;
    }
    if (e.key.toLowerCase() === 'm') {
        const next = window.getVolume('music') > 0 ? 0 : 70;
        window.setVolume('music', next);
        const musicEl = document.getElementById('vol-music');
        if (musicEl) musicEl.value = next;
        return;
    }
    if (e.key.toLowerCase() === 'n') {
        const next = window.getVolume('sfx') > 0 ? 0 : 100;
        window.setVolume('sfx', next);
        const sfxEl = document.getElementById('vol-sfx');
        if (sfxEl) sfxEl.value = next;
        return;
    }
    if (e.key === ' ' && !sim.gameIsPaused) {
        e.preventDefault();
        sim.userPaused = !sim.userPaused;
        if (window.updateTimePauseUI) window.updateTimePauseUI();
        return;
    }
});

window.addEventListener('keyup', e => {
    window.keys[e.key.toLowerCase()] = false;
});

// Stuck keys on alt-tab kept panning the camera — clear on focus loss
window.addEventListener('blur', () => {
    for (const k in window.keys) window.keys[k] = false;
});

// ===================== MOUSE =====================
const _inputCanvas = document.getElementById('game-canvas');

_inputCanvas.addEventListener('mousedown', e => {
    // Middle mouse always pans the camera; preventDefault stops the browser autoscroll.
    if (e.button === 1) {
        e.preventDefault();
        sim.isDragging = true;
        sim.dragStartX = e.clientX;
        sim.dragStartY = e.clientY;
        sim.lastMouseX = e.clientX;
        sim.lastMouseY = e.clientY;
        return;
    }
    if (e.button !== 0) return;
    // Feature-owned left-drag modes (drag-to-build lines) get first refusal.
    if (window.__pdDragBuild && window.__pdDragBuild.onDown(e)) return;
    sim.isDragging = true;
    sim.dragStartX = e.clientX;
    sim.dragStartY = e.clientY;
    sim.lastMouseX = e.clientX;
    sim.lastMouseY = e.clientY;
});

window.addEventListener('mouseup', e => {
    if (e.button === 1) {
        sim.isDragging = false;
        _inputCanvas.style.cursor = 'default';
        return;
    }
    if (e.button !== 0) return;
    if (window.__pdDragBuild && window.__pdDragBuild.onUp(e)) {
        sim.isDragging = false;
        return;
    }
    if (sim.isDragging) {
        const dx = e.clientX - sim.dragStartX;
        const dy = e.clientY - sim.dragStartY;
        if (Math.hypot(dx, dy) < 5 && window.handleGridClick) {
            window.handleGridClick(e.clientX, e.clientY);
        }
    }
    sim.isDragging = false;
    _inputCanvas.style.cursor = 'default';
});

// Update hover tile position only when cursor is over the canvas (so the ghost
// preview doesn't silently track tiles behind UI panels like the build menu).
_inputCanvas.addEventListener('mousemove', e => {
    sim.mouseScreenX = e.clientX;
    sim.mouseScreenY = e.clientY;
});

window.addEventListener('mousemove', e => {
    if (window.__pdDragBuild && window.__pdDragBuild.onMove(e)) return;
    if (!sim.isDragging) return;
    sim.camera.x -= (e.clientX - sim.lastMouseX) / sim.camera.zoom;
    sim.camera.y -= (e.clientY - sim.lastMouseY) / sim.camera.zoom;
    sim.lastMouseX = e.clientX;
    sim.lastMouseY = e.clientY;
    if (Math.hypot(e.clientX - sim.dragStartX, e.clientY - sim.dragStartY) > 5) {
        _inputCanvas.style.cursor = 'grabbing';
    }
});

_inputCanvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    window.gameState.selectedTool = null;
    if (window.refreshUI) window.refreshUI();
});

// ===================== ZOOM =====================
// Registered on document (not the canvas) so the handler fires consistently
// whether the game loop is active or paused. Canvas-level wheel listeners can be
// skipped by browsers when the canvas is in an active requestAnimationFrame loop.
document.addEventListener('wheel', e => {
    // Only zoom when the wheel is over the canvas — otherwise let scrollable UI
    // panels (build menu, research modal, settings drawer) scroll natively.
    if (e.target !== _inputCanvas) return;
    e.preventDefault();
    if (!sim.camera) return;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = _inputCanvas.getBoundingClientRect();
    const mwx = (e.clientX - rect.left) / sim.camera.zoom + sim.camera.x;
    const mwy = (e.clientY - rect.top)  / sim.camera.zoom + sim.camera.y;
    sim.camera.zoom = Math.min(4.0, Math.max(0.5, sim.camera.zoom * factor));
    sim.camera.x = mwx - (e.clientX - rect.left) / sim.camera.zoom;
    sim.camera.y = mwy - (e.clientY - rect.top)  / sim.camera.zoom;
    // Clamp immediately so update() never has to fight the pivot position.
    if (sim.grid) {
        const maxX = Math.max(0, sim.grid.width  * window.TILE_SIZE - _inputCanvas.width  / sim.camera.zoom);
        const maxY = Math.max(0, sim.grid.height * window.TILE_SIZE - _inputCanvas.height / sim.camera.zoom);
        sim.camera.x = Math.max(0, Math.min(maxX, sim.camera.x));
        sim.camera.y = Math.max(0, Math.min(maxY, sim.camera.y));
    }
}, { passive: false });
