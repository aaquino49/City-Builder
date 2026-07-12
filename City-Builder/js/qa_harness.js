// Query-gated release-candidate QA harness. Activate with ?qa=1.
const QA_ENABLED = new URLSearchParams(window.location.search).has('qa');

function waitForGameReady() {
    return new Promise(resolve => {
        const tick = () => {
            // __initDone: init() has fully finished (assets, lists, start screen) —
            // starting earlier let init re-show the start screen over a running sim
            if (window.__initDone && window.grid && window.gameState && window.Citizen && window.Soldier && window.Raider) resolve();
            else setTimeout(tick, 50);
        };
        tick();
    });
}

function setQaResult(payload) {
    const out = document.getElementById('qa-result');
    if (out) out.textContent = JSON.stringify(payload, null, 2);
}

function placeIfFree(tx, ty, def) {
    if (!window.grid?.inBounds(tx, ty) || !def) return false;
    const w = def.width || 1;
    const h = def.height || 1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!window.grid.inBounds(tx + x, ty + y) || window.grid.structures[ty + y][tx + x]) return false;
        }
    }
    window.grid.place(tx, ty, def);
    return true;
}

function clearRuntimeCollections() {
    for (const arr of [
        window.citizens, window.soldiers, window.archers, window.knights,
        window.raiders, window.activeProjectiles, window.projectiles, window.particles,
    ]) {
        if (arr) arr.length = 0;
    }
}

function seedLargeCity() {
    clearRuntimeCollections();
    const { BUILDINGS, TILE_SIZE } = window;
    window.gameState.started = true;
    window.setGameIsPaused(false);
    window.setUserPaused(false);
    window.setTimeScale(1);
    const start = document.getElementById('start-screen');
    if (start) start.style.display = 'none';

    for (let ty = 0; ty < window.grid.height; ty++) {
        for (let tx = 0; tx < window.grid.width; tx++) {
            window.grid.structures[ty][tx] = null;
            window.grid.tiles[ty][tx] = 'tile_grass';
        }
    }
    for (let tx = 6; tx < 58; tx++) window.grid.tiles[32][tx] = 'tile_road';
    for (let ty = 6; ty < 58; ty++) window.grid.tiles[ty][32] = 'tile_road';

    for (let i = 0; i < 34; i++) {
        const tx = 18 + (i % 9) * 3;
        const ty = 19 + Math.floor(i / 9) * 3;
        placeIfFree(tx, ty, BUILDINGS.house);
    }
    for (let i = 0; i < 24; i++) {
        const tx = 12 + (i % 8) * 5;
        const ty = 42 + Math.floor(i / 8) * 3;
        placeIfFree(tx, ty, BUILDINGS.farm);
    }
    for (let i = 0; i < 16; i++) {
        placeIfFree(14 + i * 2, 15, BUILDINGS.wall);
        placeIfFree(14 + i * 2, 49, BUILDINGS.wall);
    }
    placeIfFree(30, 28, BUILDINGS.barracks);
    placeIfFree(34, 28, BUILDINGS.archery_range);
    placeIfFree(30, 36, BUILDINGS.tower);
    placeIfFree(36, 36, BUILDINGS.ballista_tower);
    window.rebuildStructureLists();
    window._buildStaticCache?.();

    const jitter = () => (Math.random() - 0.5) * 520;
    for (let i = 0; i < 180; i++) window.citizens.push(new window.Citizen(32.5 * TILE_SIZE + jitter(), 32.5 * TILE_SIZE + jitter()));
    for (let i = 0; i < 100; i++) window.soldiers.push(new window.Soldier(32.5 * TILE_SIZE + jitter() * 0.7, 32.5 * TILE_SIZE + jitter() * 0.7));
    for (let i = 0; i < 60; i++) window.archers.push(new window.Archer(32.5 * TILE_SIZE + jitter() * 0.6, 32.5 * TILE_SIZE + jitter() * 0.6));
    for (let i = 0; i < 35; i++) window.knights.push(new window.Knight(32.5 * TILE_SIZE + jitter() * 0.5, 32.5 * TILE_SIZE + jitter() * 0.5));
    for (let i = 0; i < 140; i++) {
        const edge = i % 4;
        const x = edge === 0 ? 2 * TILE_SIZE : edge === 1 ? 62 * TILE_SIZE : (8 + Math.random() * 48) * TILE_SIZE;
        const y = edge === 2 ? 2 * TILE_SIZE : edge === 3 ? 62 * TILE_SIZE : (8 + Math.random() * 48) * TILE_SIZE;
        window.raiders.push(new window.Raider(x, y, i % 11 === 0 ? 'siege' : i % 7 === 0 ? 'torch' : 'normal'));
    }
    window.gameState.population = window.citizens.length;
    window.gameState.housing = 220;
    window.gameState.gold = 5000;
    window.gameState.food = 600;
    window.setRaidActive(true);
    window.setRaidCount(7);
    window.setRaidStrength(118);
    window.setCurrentTerritoryRadius(30);
    window.refreshUI();
    window.updateRaidHUD();
    return {
        citizens: window.citizens.length,
        soldiers: window.soldiers.length,
        archers: window.archers.length,
        knights: window.knights.length,
        raiders: window.raiders.length,
        structures: window.activeHouses.length + window.activeFarms.length + window.activeWalls.length,
    };
}

function measureFrames(sampleCount = 240) {
    return new Promise(resolve => {
        const deltas = [];
        let last = performance.now();
        const step = now => {
            deltas.push(now - last);
            last = now;
            if (deltas.length >= sampleCount) {
                const sorted = deltas.slice().sort((a, b) => a - b);
                const sum = deltas.reduce((a, b) => a + b, 0);
                resolve({
                    frames: deltas.length,
                    avgMs: +(sum / deltas.length).toFixed(2),
                    p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
                    maxMs: +sorted[sorted.length - 1].toFixed(2),
                    fpsAvg: +(1000 / (sum / deltas.length)).toFixed(1),
                });
            } else {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    });
}

function testSaveLoad() {
    const before = {
        population: window.gameState.population,
        soldiers: window.soldiers.length,
        archers: window.archers.length,
        knights: window.knights.length,
        raiders: window.raiders.length,
    };
    window.saveGame();
    const bytes = localStorage.getItem(window.SAVE_KEY)?.length || 0;
    const loaded = window.loadGame();
    return {
        loaded,
        bytes,
        before,
        after: {
            population: window.gameState.population,
            citizens: window.citizens.length,
            soldiers: window.soldiers.length,
            archers: window.archers.length,
            knights: window.knights.length,
            raiders: window.raiders.length,
        },
    };
}

// Mid-raid save/load: raidActive and the wave tallies must survive the round
// trip (save v7), defenders must re-engage, and citizens must re-hide.
function testRaidSaveLoad() {
    const { TILE_SIZE } = window;
    window.raiders.length = 0;
    for (let i = 0; i < 12; i++) {
        window.raiders.push(new window.Raider((4 + i) * TILE_SIZE, 4 * TILE_SIZE, 'normal'));
    }
    window.setRaidActive(true);
    window.setRaidActiveTimer(42);
    window.setRaidBuildingsDestroyed(3);
    window.setRaidCitizensKilled(2);
    window.saveGame();
    const loaded = window.loadGame();
    return {
        loaded,
        raidActiveRestored: window.raidActive === true,
        raidActiveTimerRestored: window.raidActiveTimer === 42,
        talliesRestored: window.raidBuildingsDestroyed === 3 && window.raidCitizensKilled === 2,
        raidersRestored: window.raiders.length === 12,
        citizensHiding: window.citizens.length === 0 || window.citizens.some(c => c.job === 'hiding'),
    };
}

function testPathfinding() {
    const start = performance.now();
    let found = 0;
    let blocked = 0;
    let deferred = 0;
    window.setRaidPathBudget(1000);
    for (let i = 0; i < 240; i++) {
        const sx = 4 + (i % 16);
        const sy = 4 + ((i * 3) % 16);
        const ex = 48 + (i % 10);
        const ey = 48 + ((i * 7) % 10);
        const path = window.aStarPath(sx, sy, ex, ey, window.isFriendlyWalkable);
        if (path === false) deferred++;
        else if (path === null) blocked++;
        else found++;
    }
    return {
        ms: +(performance.now() - start).toFixed(2),
        found,
        blocked,
        deferred,
    };
}

function testRegressionBugs() {
    const { TILE_SIZE, BUILDINGS } = window;
    const results = {};

    const maxR = (window.currentTerritoryRadius + 1) * TILE_SIZE;
    const centerX = 32.5 * TILE_SIZE;
    const centerY = 32.5 * TILE_SIZE;
    const outsideX = centerX + maxR + TILE_SIZE * 8;
    for (const unit of [...window.soldiers.slice(0, 3), ...window.archers.slice(0, 3), ...window.knights.slice(0, 3)]) {
        unit.x = outsideX;
        unit.y = centerY;
    }
    window.update(16);
    results.militaryClamped = [...window.soldiers.slice(0, 3), ...window.archers.slice(0, 3), ...window.knights.slice(0, 3)]
        .every(unit => Math.hypot(unit.x - centerX, unit.y - centerY) <= maxR + 0.01);

    // Task 3 regression: soldiers/knights must engage active raiders in BOTH
    // combat modes — previously a raider present during 'defend' mode was
    // completely ignored while the unit stood at its rally point.
    {
        window.raiders.length = 0;
        window.setRaidActive(true);
        window.setRaidPathBudget(1000);
        const testRaider = new window.Raider(40 * TILE_SIZE, 40 * TILE_SIZE, 'normal');
        window.raiders.push(testRaider);
        const testSoldier = new window.Soldier(35 * TILE_SIZE, 35 * TILE_SIZE);
        const testKnight = new window.Knight(35 * TILE_SIZE, 36 * TILE_SIZE);
        window.soldiers.push(testSoldier);
        window.knights.push(testKnight);
        window.setCombatMode('defend');
        const soldierDistBefore = Math.hypot(testSoldier.x - testRaider.x, testSoldier.y - testRaider.y);
        const knightDistBefore = Math.hypot(testKnight.x - testRaider.x, testKnight.y - testRaider.y);
        for (let i = 0; i < 5; i++) window.update(200);
        const soldierDistAfter = Math.hypot(testSoldier.x - testRaider.x, testSoldier.y - testRaider.y);
        const knightDistAfter = Math.hypot(testKnight.x - testRaider.x, testKnight.y - testRaider.y);
        results.soldierEngagesInDefendMode = testSoldier._chaseTarget === testRaider || soldierDistAfter < soldierDistBefore - 1;
        results.knightEngagesInDefendMode = testKnight._chaseTarget === testRaider || knightDistAfter < knightDistBefore - 1;
        window.soldiers.pop(); window.knights.pop();
        window.raiders.length = 0;
        window.setRaidActive(false);
    }

    // Task 1 regression: units spawned exactly on top of each other (the
    // reported stacking bug) must visibly separate rather than staying glued.
    {
        // Clear the test tile of any randomly-generated tree/stone/iron obstacle
        // so the test is deterministic regardless of world-gen RNG.
        if (window.grid.inBounds(20, 20)) window.grid.structures[20][20] = null;
        const stackX = 20 * TILE_SIZE + TILE_SIZE / 2, stackY = 20 * TILE_SIZE + TILE_SIZE / 2;
        const stack = [];
        for (let i = 0; i < 5; i++) {
            const c = new window.Citizen(stackX, stackY);
            c.job = 'idle'; c.state = 'idle';
            window.citizens.push(c);
            stack.push(c);
        }
        for (let i = 0; i < 20; i++) {
            window.rebuildSeparationGrid();
            for (const c of stack) c.update(16, window.grid);
        }
        let anyOverlap = false;
        for (let i = 0; i < stack.length; i++) {
            for (let j = i + 1; j < stack.length; j++) {
                if (Math.hypot(stack[i].x - stack[j].x, stack[i].y - stack[j].y) < 1) anyOverlap = true;
            }
        }
        results.separationPreventsStacking = !anyOverlap;
        for (const c of stack) {
            const idx = window.citizens.indexOf(c);
            if (idx !== -1) window.citizens.splice(idx, 1);
        }
    }

    // Task 2 regression: a unit walking a known direction (due east) must
    // rotate to face that direction rather than staying at rotation 0.
    {
        if (window.grid.inBounds(10, 10)) window.grid.structures[10][10] = null;
        if (window.grid.inBounds(11, 10)) window.grid.structures[10][11] = null;
        const facer = new window.Citizen(10 * TILE_SIZE + TILE_SIZE / 2, 10 * TILE_SIZE + TILE_SIZE / 2);
        facer.job = 'idle';
        facer._directWalkToTile(11, 10, window.grid); // due east
        for (let i = 0; i < 10; i++) facer.update(16, window.grid);
        results.unitRotatesToFaceMovement = Math.abs(facer.rotation) > 0.05;
    }

    // Raid timing: expiring the timer at night enters a 30s scout warning
    // (not an instant spawn); the wave spawns when the scout timer runs out.
    window.raiders.length = 0;
    window.setRaidActive(false);
    window.setScoutPhase(false);
    window.setRaidQueued(false);
    window.setRaidCount(1);
    window.setDayTimer(55); // night
    window.setRaidTimer(0.01);
    window.update(32);
    results.raidWarnsBeforeSpawning = window._scoutPhase === true && window.raidActive === false;

    window.setScoutTimer(0.01);
    window.update(32);
    results.scoutExpiryStartsRaid = window.raidActive === true && window.raiders.length > 0 && window._scoutPhase === false;
    results.waveBannerShown = document.getElementById('event-banner-title')?.textContent?.includes('RAID WAVE') || false;

    // Expiring the timer during the day queues the raid for nightfall
    window.raiders.length = 0;
    window.setRaidActive(false);
    window.setScoutPhase(false);
    window.setRaidQueued(false);
    window.setDayTimer(20); // daytime
    window.setRaidTimer(0.01);
    window.update(32);
    results.daytimeRaidQueues = window._raidQueued === true && window.raidActive === false;

    // The queued raid triggers the scout warning once night falls
    window.setDayTimer(55); // night
    window.update(32);
    results.queuedRaidScoutsAtNight = window._scoutPhase === true && window._raidQueued === false && window.raidActive === false;

    // Reset raid state for the tests below
    window.raiders.length = 0;
    window.setScoutPhase(false);
    window.setRaidQueued(false);
    window.setRaidTimer(180);

    window.setRaidActive(false);
    window.raiders.length = 0;
    const tx = 28, ty = 28;
    placeIfFree(tx, ty, BUILDINGS.monument);
    const monument = window.grid.structures[ty][tx];
    if (monument) monument.progress = 0;
    window.rebuildStructureLists();
    for (const c of window.citizens.slice(0, 20)) {
        c.job = 'farmer';
        c.state = 'idle';
        c._workTX = window.activeFarms[0]?.tx ?? -1;
        c._workTY = window.activeFarms[0]?.ty ?? -1;
    }
    window.assignCitizenJobs();
    const builder = window.citizens.find(c => c.job === 'builder' && c._workTX === tx && c._workTY === ty);
    if (builder) {
        builder.x = tx * TILE_SIZE + TILE_SIZE / 2;
        builder.y = ty * TILE_SIZE + TILE_SIZE / 2;
        builder.state = 'idle';
        builder._phase = 'building';
        builder.update(1000, window.grid);
    }
    results.monumentGetsBuilder = !!builder;
    results.monumentProgresses = (window.grid.structures[ty]?.[tx]?.progress ?? 0) > 0;

    return results;
}

function sampleMovement() {
    window.setCombatMode('attack');
    window.updateCombatModeUI?.();
    window.setRaidPathBudget(1000);
    for (const c of window.citizens.slice(0, 30)) {
        if (typeof c._tryAmbientWalk === 'function') c._tryAmbientWalk(window.grid);
    }
    for (const s of window.soldiers.slice(0, 25)) {
        s._idleTimer = s._idleWait || 0;
        if (typeof s._pickPatrolTarget === 'function') s._pickPatrolTarget(window.grid);
    }
    for (const r of window.raiders.slice(0, 25)) {
        r._repathTimer = 0;
        if (typeof r._requestPath === 'function') r._requestPath();
    }
    const units = [
        ...window.citizens.slice(0, 25),
        ...window.soldiers.slice(0, 20),
        ...window.raiders.slice(0, 20),
    ].map(u => ({ u, x: u.x, y: u.y }));
    return new Promise(resolve => {
        setTimeout(() => {
            const jumps = units.map(({ u, x, y }) => Math.hypot(u.x - x, u.y - y));
            resolve({
                sampled: units.length,
                maxDeltaPx: +Math.max(...jumps).toFixed(2),
                avgDeltaPx: +(jumps.reduce((a, b) => a + b, 0) / jumps.length).toFixed(2),
            });
        }, 1000);
    });
}

// Simulate real gameplay from the current boot state: step update() in 100ms
// increments and record every raid-phase transition. Auto-dismisses modals the
// way a player would, so timers keep running. Catches "raids never fire" bugs
// that per-state unit checks miss.
function simulateTimeline(totalSec = 400) {
    window.gameState.started = true;
    window.setGameIsPaused(false);
    window.setUserPaused(false);
    window.setTimeScale(1);
    const start = document.getElementById('start-screen');
    if (start) start.style.display = 'none';
    const events = [];
    let lastPhase = '';
    let raidsSeen = 0;
    for (let step = 0; step < totalSec * 10; step++) {
        window.update(100);
        // Auto-answer any modal that paused the game (raid result, diplomacy, trade)
        if (window.gameIsPaused) {
            if (document.getElementById('raid-modal')?.classList.contains('open')) {
                document.getElementById('modal-continue')?.click();
            } else if (document.getElementById('diplomacy-modal')?.classList.contains('open')) {
                document.getElementById('diplomacy-option-b')?.click();
            } else if (document.getElementById('trade-modal')?.classList.contains('open')) {
                document.getElementById('trade-close')?.click();
            } else {
                window.setGameIsPaused(false); // research/other overlays
            }
        }
        const phase = window.raidActive ? 'raid'
                    : window._scoutPhase ? 'scout'
                    : window._raidQueued ? 'queued'
                    : 'countdown';
        if (phase !== lastPhase) {
            if (phase === 'raid') raidsSeen++;
            events.push({
                tSec: +(step / 10).toFixed(1),
                phase,
                raiders: window.raiders.length,
                raidTimer: +(window.raidTimer ?? 0).toFixed(1),
                dayPhase: window._dayPhase,
                wave: (window.raidCount ?? 0) + 1,
            });
            lastPhase = phase;
        }
        if (raidsSeen >= 2 && phase === 'countdown') break; // two full raid cycles proven
    }
    return { raidsSeen, events };
}

async function runFullQa() {
    const seeded = seedLargeCity();
    const movement = await sampleMovement();
    const pathfinding = testPathfinding();
    const regressions = testRegressionBugs();
    const frames = await measureFrames();
    const saveLoad = testSaveLoad();
    const raidSaveLoad = testRaidSaveLoad();
    const result = { seeded, movement, pathfinding, regressions, frames, saveLoad, raidSaveLoad };
    setQaResult(result);
    return result;
}

async function bootQaHarness() {
    await waitForGameReady();
    const panel = document.createElement('div');
    panel.id = 'qa-panel';
    panel.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:#111;color:#fff;padding:8px;font:12px monospace;max-width:460px;max-height:70vh;overflow:auto;border:1px solid #999;';
    panel.innerHTML = `
        <button id="qa-seed" type="button">Seed Stress City</button>
        <button id="qa-run" type="button">Run Full QA</button>
        <pre id="qa-result">Ready</pre>
    `;
    document.body.appendChild(panel);
    document.getElementById('qa-seed').addEventListener('click', () => setQaResult({ seeded: seedLargeCity() }));
    document.getElementById('qa-run').addEventListener('click', () => {
        setQaResult({ running: true });
        runFullQa().catch(err => setQaResult({ error: err.message, stack: err.stack }));
    });
    window.__pixelDominionQa = { seedLargeCity, runFullQa, testSaveLoad, testRaidSaveLoad, testPathfinding, testRegressionBugs, measureFrames };
}

if (QA_ENABLED) {
    bootQaHarness().then(async () => {
        // ?qa=auto runs the synchronous checks unattended and logs the result —
        // lets a headless browser act as a CI smoke check. (Frame/movement
        // sampling needs real rAF time, so it stays interactive-only.)
        // ?qa=simload — play past wave 1, save, load, keep playing: proves raids
        // continue across a save/load boundary (the "resume from autosave" path).
        if (new URLSearchParams(window.location.search).get('qa') === 'simload') {
            try {
                const before = simulateTimeline(250);
                window.saveGame();
                const loaded = window.loadGame();
                const after = simulateTimeline(700);
                console.log('[QA SIMLOAD] ' + JSON.stringify({ loaded, before, after }));
            } catch (err) {
                console.error('[QA ERROR] ' + err.message + '\n' + err.stack);
            }
        }
        if (new URLSearchParams(window.location.search).get('qa') === 'sim') {
            try {
                const simSec = Number(new URLSearchParams(window.location.search).get('simSec')) || 400;
                console.log('[QA SIM] ' + JSON.stringify(simulateTimeline(simSec)));
            } catch (err) {
                console.error('[QA ERROR] ' + err.message + '\n' + err.stack);
            }
        }
        // ?qa=shot — stack a small cluster of units on one tile and let them
        // separate + orient, for visual screenshot inspection (no assertions).
        if (new URLSearchParams(window.location.search).get('qa') === 'shot') {
            try {
                window.gameState.started = true;
                window.setGameIsPaused(false);
                window.setUserPaused(false);
                const start = document.getElementById('start-screen');
                if (start) start.style.display = 'none';
                const { TILE_SIZE } = window;
                const cx = 32 * TILE_SIZE + TILE_SIZE / 2, cy = 32 * TILE_SIZE + TILE_SIZE / 2;
                for (let i = 0; i < 6; i++) window.citizens.push(new window.Citizen(cx, cy));
                for (let i = 0; i < 4; i++) window.soldiers.push(new window.Soldier(cx + 40, cy));
                for (let i = 0; i < 3; i++) window.archers.push(new window.Archer(cx - 40, cy));
                for (let i = 0; i < 3; i++) window.knights.push(new window.Knight(cx, cy + 40));
                // Frame the cluster in the open upper-left canvas area, clear of
                // the docked BUILD panel (right) and bottom HUD bar.
                window.camera.zoom = 4.0;
                window.camera.x = cx - 300 / window.camera.zoom;
                window.camera.y = cy - 300 / window.camera.zoom;
                for (let i = 0; i < 40; i++) window.update(16);
            } catch (err) {
                console.error('[QA ERROR] ' + err.message + '\n' + err.stack);
            }
        }
        // ?qa=perf — stress-seed 400+ units and time synchronous update() calls
        // directly (rAF doesn't reliably fire in headless-mode virtual time, so
        // this avoids that dependency) to catch perf regressions from the new
        // per-frame separation/rotation work.
        if (new URLSearchParams(window.location.search).get('qa') === 'perf') {
            try {
                const seeded = seedLargeCity();
                // Browser timer resolution is coarsened (security), so individual
                // sub-ms update() calls round to 0 — batch many calls and time the
                // whole run instead, which averages that noise out.
                const N = 3000;
                const t0 = performance.now();
                for (let i = 0; i < N; i++) window.update(16);
                const totalMs = performance.now() - t0;
                const perf = { totalMs: +totalMs.toFixed(1), avgMsPerUpdate: +(totalMs / N).toFixed(4) };
                console.log('[QA PERF] ' + JSON.stringify({ seeded, perf }));
            } catch (err) {
                console.error('[QA ERROR] ' + err.message + '\n' + err.stack);
            }
        }
        if (new URLSearchParams(window.location.search).get('qa') === 'auto') {
            try {
                const seeded = seedLargeCity();
                const regressions = testRegressionBugs();
                const pathfinding = testPathfinding();
                const saveLoad = testSaveLoad();
                const raidSaveLoad = testRaidSaveLoad();
                const result = { seeded, regressions, pathfinding, saveLoad, raidSaveLoad };
                setQaResult(result);
                console.log('[QA RESULT] ' + JSON.stringify(result));
            } catch (err) {
                console.error('[QA ERROR] ' + err.message + '\n' + err.stack);
            }
        }
    });
}
