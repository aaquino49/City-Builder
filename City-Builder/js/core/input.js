// Pixel Dominion — Input Manager Module
// Handles keyboard, mouse, and wheel events.
// All state reads/writes flow through the window globals defined in state.js.

// ===================== KEYBOARD =====================
window.addEventListener('keydown', e => {
    window.keys[e.key.toLowerCase()] = true;
    if (!window.gameState.started) return;

    // 1-9: select build tools, 0: demolish
    if (e.key >= '1' && e.key <= '9' && !window.gameIsPaused) {
        const idx = parseInt(e.key) - 1;
        if (idx < window._BUILD_SHORTCUT_TOOLS.length) {
            window.gameState.selectedTool = window._BUILD_SHORTCUT_TOOLS[idx];
            if (window.updateBuildMenu) window.updateBuildMenu();
        }
        return;
    }
    if (e.key === '0' && !window.gameIsPaused) {
        window.gameState.selectedTool = 'demolish';
        if (window.updateBuildMenu) window.updateBuildMenu();
        return;
    }
    if (e.key === 'Escape') {
        window.gameState.selectedTool = null;
        if (window.updateBuildMenu) window.updateBuildMenu();
        if (window.statsOverlayVisible && window.toggleStatsOverlay) window.toggleStatsOverlay();
        return;
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        if (!window.gameIsPaused && window.toggleStatsOverlay) window.toggleStatsOverlay();
        return;
    }
    if (e.key.toLowerCase() === 'm') {
        window._volMusic = window._volMusic > 0 ? 0 : 70;
        const musicEl = document.getElementById('vol-music');
        if (musicEl) musicEl.value = window._volMusic;
        if (window._applyVolumes) window._applyVolumes();
        if (window._saveSettings) window._saveSettings();
        return;
    }
    if (e.key.toLowerCase() === 'n') {
        window._volSfx = window._volSfx > 0 ? 0 : 100;
        const sfxEl = document.getElementById('vol-sfx');
        if (sfxEl) sfxEl.value = window._volSfx;
        if (window._applyVolumes) window._applyVolumes();
        if (window._saveSettings) window._saveSettings();
        return;
    }
    if (e.key === ' ' && !window.gameIsPaused) {
        e.preventDefault();
        window.setUserPaused(!window.userPaused);
        if (window.updateTimePauseUI) window.updateTimePauseUI();
        return;
    }
});

window.addEventListener('keyup', e => {
    window.keys[e.key.toLowerCase()] = false;
});

// ===================== MOUSE =====================
const _inputCanvas = document.getElementById('game-canvas');

_inputCanvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    window.setIsDragging(true);
    window.setDragStartX(e.clientX);
    window.setDragStartY(e.clientY);
    window.setLastMouseX(e.clientX);
    window.setLastMouseY(e.clientY);
});

window.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    if (window.isDragging) {
        const dx = e.clientX - window.dragStartX;
        const dy = e.clientY - window.dragStartY;
        if (Math.hypot(dx, dy) < 5 && window.handleGridClick) {
            window.handleGridClick(e.clientX, e.clientY);
        }
    }
    window.setIsDragging(false);
    _inputCanvas.style.cursor = 'default';
});

// Update hover tile position only when cursor is over the canvas (so the ghost
// preview doesn't silently track tiles behind UI panels like the build menu).
_inputCanvas.addEventListener('mousemove', e => {
    window.setMouseScreenX(e.clientX);
    window.setMouseScreenY(e.clientY);
});

window.addEventListener('mousemove', e => {
    if (!window.isDragging) return;
    window.camera.x -= (e.clientX - window.lastMouseX) / window.camera.zoom;
    window.camera.y -= (e.clientY - window.lastMouseY) / window.camera.zoom;
    window.setLastMouseX(e.clientX);
    window.setLastMouseY(e.clientY);
    if (Math.hypot(e.clientX - window.dragStartX, e.clientY - window.dragStartY) > 5) {
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
    e.preventDefault();
    if (!window.camera) return;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = _inputCanvas.getBoundingClientRect();
    const mwx = (e.clientX - rect.left) / window.camera.zoom + window.camera.x;
    const mwy = (e.clientY - rect.top)  / window.camera.zoom + window.camera.y;
    window.camera.zoom = Math.min(3.0, Math.max(0.5, window.camera.zoom * factor));
    window.camera.x = mwx - (e.clientX - rect.left) / window.camera.zoom;
    window.camera.y = mwy - (e.clientY - rect.top)  / window.camera.zoom;
    // Clamp immediately so update() never has to fight the pivot position.
    if (window.grid) {
        const maxX = Math.max(0, window.grid.width  * window.TILE_SIZE - _inputCanvas.width  / window.camera.zoom);
        const maxY = Math.max(0, window.grid.height * window.TILE_SIZE - _inputCanvas.height / window.camera.zoom);
        window.camera.x = Math.max(0, Math.min(maxX, window.camera.x));
        window.camera.y = Math.max(0, Math.min(maxY, window.camera.y));
    }
}, { passive: false });
