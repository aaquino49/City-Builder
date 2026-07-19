// Pixel Dominion — Main Orchestration & Entry Point

import {
    applyDifficultyConfig,
    calcTerritoryRadius,
    currentTerritoryRadius,
    DEFAULT_DIFFICULTY_KEY,
    FINAL_RAID_WAVE,
    flushUI,
    markUIDirty,
    RAID_WAVE_SIZES,
    getDifficultyPreset,
    getRaidStrengthForWave,
    getRootStructureAt,
    getStructureAt,
    JOB_SCAN_INTERVAL,
    setAllianceTimer,
    setCombatMode,
    setAutoSaveTimer,
    setDayPhase,
    setDayTimer,
    setEmigrationTimer,
    setGameIsPaused,
    setGriefPenalty,
    setJobScanTimer,
    setLastSeason,
    setOverlayAlpha,
    setRaidActive,
    setRaidActiveTimer,
    setRaidBuildingsDestroyed,
    setRaidCitizensKilled,
    setRaidCount,
    setRaidQueued,
    setRaidWarningPlayed,
    setRaidWarningSpawnCount,
    setRaidStrength,
    setRaidTimer,
    setScoutPhase,
    setScoutTimer,
    setSpawnTimer,
    setSoldierCostMult,
    setSoldierCostTimer,
    setTaxTimer,
    setTimeScale,
    setUserPaused,
} from './core/state.js';
import './core/utils.js';
import { setRaidPathBudget } from './core/pathfinding.js';
import './entities/entities.js';
import { _NON_BURNABLE } from './systems/systems.js';
import { patchStaticCache, showModal, triggerVictory, updateCombatModeUI, updateRaidHUD, _buildStaticCache } from './ui/ui.js';
import './core/input.js';
import { runSmokeTests } from './smoke_tests.js';
import './qa_harness.js';

// Debug tooling (FPS counter, smoke tests) is opt-in via ?debug
const DEBUG_MODE = new URLSearchParams(location.search).has('debug');
window.DEBUG_MODE = DEBUG_MODE;
if (!DEBUG_MODE) {
    const _statsCounter = document.getElementById('stats-counter');
    if (_statsCounter) _statsCounter.style.display = 'none';
}

// Run smoke tests when loaded (debug builds only)
if (DEBUG_MODE) {
    setTimeout(() => {
        runSmokeTests();
    }, 500);
}

let lastTime = 0;
let _lastLoopErrorTime = 0;
let frameCount = 0;
let fpsTimer = 0;
let fps = 0;
let passiveFarmTimer = 0;
let _lastCitizenUpdateErrorTime = 0;

// ===================== GAMEPLAY MECHANICS =====================
const NON_DEMOLISHABLE_KEYS = new Set(['obstacle_tree', 'rubble', 'stone_deposit', 'iron_vein']);
// RAID_WAVE_SIZES / FINAL_RAID_WAVE now live in state.js (shared with the HUD)

function createRubble() {
    return { def: RUBBLE_DEF, decayTimer: DAY_DURATION };
}

function assignCitizenToHide(c) {
    c.job = 'hiding';
    c._phase = 'go_hide';
    c._phaseTimer = 0;
    c._path = [];
    c._pathIndex = 0;
    c.state = 'idle';
    if (activeHouses.length > 0) {
        const cx = Math.floor(c.x / TILE_SIZE), cy = Math.floor(c.y / TILE_SIZE);
        let best = null, bestDSq = Infinity;
        for (const h of activeHouses) {
            const dx = h.tx - cx, dy = h.ty - cy;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestDSq) { bestDSq = dSq; best = h; }
        }
        c._workTX = best.tx;
        c._workTY = best.ty;
        c._setTargetTile(best.tx, best.ty, grid);
    } else {
        // No houses to hide in — flee toward the town center instead of
        // freezing in the open where kill-objective raiders execute them.
        const flee = _findWalkableNear(32, 32);
        if (flee) {
            c._workTX = flee.tx;
            c._workTY = flee.ty;
            c._setTargetTile(flee.tx, flee.ty, grid);
        } else {
            c._workTX = -1;
            c._workTY = -1;
            c._phase = 'hidden';
        }
    }
}

// Ring-search for the nearest friendly-walkable tile around (tx, ty).
function _findWalkableNear(tx, ty, maxRadius = 6) {
    if (isFriendlyWalkable(tx, ty)) return { tx, ty };
    for (let radius = 1; radius <= maxRadius; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
                if (isFriendlyWalkable(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
            }
        }
    }
    return null;
}

function demolishPlayerStructure(tx, ty) {
    const root = getRootStructureAt(tx, ty);
    const s = root.structure;
    if (!s || NON_DEMOLISHABLE_KEYS.has(s.def.key)) return false;

    const px = root.tx;
    const py = root.ty;
    const dw = s.def.width || 1;
    const dh = s.def.height || 1;
    gameState.gold += Math.floor(getScaledCost(s.def.key) * 0.5);
    if (s.def.key === 'house') gameState.housesBuilt = Math.max(0, (gameState.housesBuilt || 0) - 1);
    else if (s.def.key === 'farm') gameState.farmsBuilt = Math.max(0, (gameState.farmsBuilt || 0) - 1);
    gameState.housing = Math.max(0, gameState.housing - (s.def.housing || 0));
    delete _tier2Upgrades[`${px},${py}`];
    grid.demolish(px, py);
    grid.structures[py][px] = createRubble();
    playDemolishSFX();
    patchStaticCache(px, py, dw, dh);
    rebuildStructureLists();
    refreshUI();
    return true;
}

function handleGridClick(clientX, clientY) {
    if (!gameState.started || gameIsPaused) return;
    if (userPaused) {
        const rect = canvas.getBoundingClientRect();
        const wx = (clientX - rect.left) / camera.zoom + camera.x;
        const wy = (clientY - rect.top) / camera.zoom + camera.y;
        spawnParticle(wx, wy, 'floating_text', 0.8, 'Paused', '#ffdd57');
        return;
    }
    const { tx, ty } = grid.screenToGrid(clientX, clientY);
    if (!grid.inBounds(tx, ty)) return;

    const R = calcTerritoryRadius();
    const isOutside = Math.hypot(tx - 32, ty - 32) > R;
    if (isOutside && gameState.selectedTool && gameState.selectedTool !== 'demolish') {
        playErrorSFX();
        spawnParticle(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, 'floating_text', 1.0, 'Outside Territory', '#ff2222');
        return;
    }

    if (gameState.selectedTool === 'clear') {
        const s = getStructureAt(tx, ty);
        if (s && s.def.key === 'obstacle_tree') {
            if (gameState.gold < 10) return;
            gameState.gold -= 10;
            grid.demolish(tx, ty);
            playChopSFX();
            patchStaticCache(tx, ty);
            rebuildStructureLists();
            refreshUI();
        }
        return;
    }

    if (gameState.selectedTool === 'clear_rubble') {
        const s = getStructureAt(tx, ty);
        if (s && s.def.key === 'rubble') {
            if (gameState.gold < 15) return;
            gameState.gold -= 15;
            grid.structures[ty][tx] = null;
            playRubbleSFX();
            spawnParticle(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, 'puff', 0.4);
            patchStaticCache(tx, ty);
            rebuildStructureLists();
            refreshUI();
        }
        return;
    }

    if (gameState.selectedTool === 'road') {
        if (gameState.gold < ROAD_COST) return;
        if (grid.structures[ty][tx]) return; // occupied by structure or tree
        if (grid.tiles[ty][tx] === 'tile_road') return; // already a road
        gameState.gold -= ROAD_COST;
        grid.tiles[ty][tx] = 'tile_road';
        playRoadSFX();
        patchStaticCache(tx, ty);
        refreshUI();
        return;
    }

    if (gameState.selectedTool === 'demolish') {
        // Demolish road tile
        if (grid.tiles[ty][tx] === 'tile_road' && !grid.structures[ty][tx]) {
            gameState.gold += 2; // 50% refund of 5g cost
            grid.tiles[ty][tx] = 'tile_grass';
            playDemolishSFX();
            patchStaticCache(tx, ty);
            refreshUI();
            return;
        }
        // Demolish building
        demolishPlayerStructure(tx, ty);
        return;
    }

    if (!gameState.selectedTool) {
        // Clicking the merchant while he's still on the map reopens the trade
        // screen (an accidental FAREWELL is no longer permanent).
        if (merchantNPC && (merchantNPC.state === 'trading' || merchantNPC.state === 'departing')) {
            const mtx = Math.floor(merchantNPC.x / TILE_SIZE);
            const mty = Math.floor(merchantNPC.y / TILE_SIZE);
            if (Math.abs(tx - mtx) <= 1 && Math.abs(ty - mty) <= 1) {
                merchantNPC.state = 'trading';
                openTradeModal();
                return;
            }
        }
        const root = getRootStructureAt(tx, ty);
        const s = root.structure;
        const rtx = root.tx;
        const rty = root.ty;
        if (s && s.def.key === 'gate') {
            closeBuildingPanel();
            s.manuallyLocked = !s.manuallyLocked;
            if (s.manuallyLocked) s.gateOpen = false;
            const label = s.manuallyLocked ? 'GATE LOCKED' : 'GATE UNLOCKED';
            const col   = s.manuallyLocked ? '#cc4444'    : '#44cc88';
            spawnFloat(rtx * TILE_SIZE + TILE_SIZE / 2, rty * TILE_SIZE, label, col, 1.2);
            return;
        }
        if (s && s.def.key === 'academy' && (s.progress ?? 1.0) >= 1.0) {
            closeBuildingPanel();
            openResearchModal();
            return;
        }
        if (s && BUILDINGS[s.def.key]) {
            openBuildingPanel(rtx, rty);
        } else {
            closeBuildingPanel();
        }
        return;
    }
    closeBuildingPanel();
    const def = BUILDINGS[gameState.selectedTool];
    if (!def) return;
    const cost = getScaledCost(gameState.selectedTool);
    const woodCost = def.woodCost || 0;
    const ironCost = def.ironCost || 0;
    const stoneCost = def.stoneCost || 0;
    const w = def.width || 1;
    const h = def.height || 1;
    if (gameState.gold < cost || gameState.wood < woodCost || gameState.iron < ironCost || gameState.stone < stoneCost || !grid.canPlace(tx, ty, w, h)) return;
    gameState.gold    -= cost;
    gameState.wood    -= woodCost;
    gameState.iron    -= ironCost;
    gameState.stone   -= stoneCost;
    gameState.housing += (def.housing || 0);
    const needsConstruction = def.key === 'academy' || def.key === 'monument';
    grid.place(tx, ty, def);
    const s = grid.structures[ty][tx];
    if (s) {
        if (needsConstruction) s.progress = 0;
        if (def.key === 'gate') {
            s.gateOpen = true;
            s.hp = getMaxHP('gate');
        } else if (def.key === 'monument') {
            s.hp = getMaxHP('monument');
        } else {
            s.hp = getMaxHP(def.key);
        }
    }
    if (def.key === 'house') gameState.housesBuilt++;
    else if (def.key === 'farm') gameState.farmsBuilt++;
    playBuildSFX();
    patchStaticCache(tx, ty, w, h);
    rebuildStructureLists();
    refreshUI();
}

// --- Citizen spawning ---
function spawnCitizen() {
    let sx, sy;
    if (activeHouses.length > 0) {
        const h = activeHouses[Math.floor(Math.random() * activeHouses.length)];
        sx = h.tx * TILE_SIZE + TILE_SIZE / 2;
        sy = h.ty * TILE_SIZE + TILE_SIZE / 2;
    } else {
        sx = (grid.width / 2) * TILE_SIZE;
        sy = (grid.height / 2) * TILE_SIZE;
    }
    const citizen = new Citizen(sx, sy);
    citizens.push(citizen);
    gameState.population++;
    if (raidActive || _scoutPhase) assignCitizenToHide(citizen);
    // Proxy marks UI dirty automatically; flushUI() will sync on next frame
}

// --- Soldiers ---
function trainSoldier() {
    const cost = Math.round(UNIT_BALANCE.soldier.goldCost * _soldierCostMult);
    if (gameState.gold < cost) return;
    const idleIdx = citizens.findIndex(c => c.job === 'idle' && c.state !== 'walking');
    if (idleIdx === -1) return;
    if (activeBarracks.length === 0) return;
    gameState.gold -= cost;
    citizens[idleIdx]._alive = false;
    citizens.splice(idleIdx, 1);
    gameState.population = Math.max(0, gameState.population - 1);
    const b = activeBarracks[Math.floor(Math.random() * activeBarracks.length)];
    const sol = new Soldier(b.tx * TILE_SIZE + TILE_SIZE / 2, b.ty * TILE_SIZE + TILE_SIZE / 2);
    let solHp = UNIT_BALANCE.soldier.baseHp;
    if (gameState.upgrades?.iron_discipline) solHp += UNIT_BALANCE.soldier.ironDisciplineHpBonus;
    if (_tier2Upgrades[`${b.tx},${b.ty}`]) solHp += UNIT_BALANCE.soldier.barracksTier2HpBonus;
    if (solHp !== UNIT_BALANCE.soldier.baseHp) { sol.hp = solHp; sol.maxHp = solHp; }
    soldiers.push(sol);
    playTrainSFX();
    // Proxy marks UI dirty; flushUI() will sync on next frame
}

function updateSoldiers(dtSec, activeRaiders) {
    for (const sol of soldiers) sol.update(dtSec, grid, activeRaiders);

    for (let si = soldiers.length - 1; si >= 0; si--) {
        const sol = soldiers[si];
        for (let ri = raiders.length - 1; ri >= 0; ri--) {
            const r = raiders[ri];
            if (r.state !== 'walking') continue;
            const dist = Math.hypot(r.x - sol.x, r.y - sol.y);
            if (dist <= TILE_SIZE) {
                r.hp   -= (COMBAT_BALANCE?.soldier?.meleeDps ?? 15) * dtSec;
                sol.hp -= (COMBAT_BALANCE?.raider?.meleeDps ?? 15) * dtSec;
                if (Math.random() < dtSec * 8) {
                    spawnParticle((r.x + sol.x) / 2, (r.y + sol.y) / 2, 'slash', 0.2);
                }
                if (r.hp <= 0 && r.state === 'walking') {
                    killRaider(r);
                }
                if (sol.hp <= 0) {
                    playEnemyDeathSFX();
                    spawnParticle(sol.x, sol.y, 'puff', 0.4);
                    soldiers.splice(si, 1);
                    markUIDirty();
                    break;
                }
            }
        }
    }
}

// --- Archers ---
function trainArcher() {
    if (gameState.gold < UNIT_BALANCE.archer.goldCost) return;
    const idleIdx = citizens.findIndex(c => c.job === 'idle' && c.state !== 'walking');
    if (idleIdx === -1) return;
    if (activeArcheryRanges.length === 0) return;
    gameState.gold -= UNIT_BALANCE.archer.goldCost;
    citizens[idleIdx]._alive = false;
    citizens.splice(idleIdx, 1);
    gameState.population = Math.max(0, gameState.population - 1);
    const b = activeArcheryRanges[Math.floor(Math.random() * activeArcheryRanges.length)];
    archers.push(new Archer(b.tx * TILE_SIZE + TILE_SIZE / 2, b.ty * TILE_SIZE + TILE_SIZE / 2));
    playTrainSFX();
    // Proxy marks UI dirty; flushUI() will sync on next frame
}

function updateArchers(dtSec, activeRaiders) {
    if (window._archerDefenseContext?.postCounts) {
        window._archerDefenseContext.postCounts.clear();
        for (const a of archers) {
            if (a._postTX === -1 || a._postTY === -1) continue;
            const key = `${a._postTX},${a._postTY}`;
            window._archerDefenseContext.postCounts.set(key, (window._archerDefenseContext.postCounts.get(key) || 0) + 1);
        }
    }
    for (const a of archers) a.update(dtSec, grid, activeRaiders);
}

// --- Knights ---
function trainKnight() {
    if (gameState.gold < UNIT_BALANCE.knight.goldCost || gameState.iron < UNIT_BALANCE.knight.ironCost) return;
    const idleIdx = citizens.findIndex(c => c.job === 'idle' && c.state !== 'walking');
    if (idleIdx === -1) return;
    if (activeBarracks.length === 0) return;
    gameState.gold -= UNIT_BALANCE.knight.goldCost;
    gameState.iron -= UNIT_BALANCE.knight.ironCost;
    citizens[idleIdx]._alive = false;
    citizens.splice(idleIdx, 1);
    gameState.population = Math.max(0, gameState.population - 1);
    const b = activeBarracks[Math.floor(Math.random() * activeBarracks.length)];
    knights.push(new Knight(b.tx * TILE_SIZE + TILE_SIZE / 2, b.ty * TILE_SIZE + TILE_SIZE / 2));
    playTrainSFX();
    // Proxy marks UI dirty; flushUI() will sync on next frame
}

function updateKnights(dtSec, activeRaiders) {
    for (const k of knights) k.update(dtSec, grid, activeRaiders);

    for (let ki = knights.length - 1; ki >= 0; ki--) {
        const k = knights[ki];
        for (let ri = raiders.length - 1; ri >= 0; ri--) {
            const r = raiders[ri];
            if (r.state !== 'walking') continue;
            const dist = Math.hypot(r.x - k.x, r.y - k.y);
            if (dist <= TILE_SIZE) {
                r.hp -= (COMBAT_BALANCE?.knight?.meleeDps ?? 20) * dtSec;
                k.hp -= (COMBAT_BALANCE?.raider?.meleeDps ?? 15) * (COMBAT_BALANCE?.knight?.damageTakenMult ?? 0.5) * dtSec;
                if (Math.random() < dtSec * 8) {
                    spawnParticle((r.x + k.x) / 2, (r.y + k.y) / 2, 'slash', 0.2);
                }
                if (r.hp <= 0 && r.state === 'walking') {
                    killRaider(r);
                }
                if (k.hp <= 0) {
                    playEnemyDeathSFX();
                    spawnParticle(k.x, k.y, 'puff', 0.4);
                    knights.splice(ki, 1);
                    markUIDirty();
                    break;
                }
            }
        }
    }
}

// --- Gates ---
function updateGates(dtSec, activeRaiders) {
    const rangeLimitSq = (8 * TILE_SIZE) * (8 * TILE_SIZE);
    const breachLimitSq = (1.5 * TILE_SIZE) * (1.5 * TILE_SIZE);
    for (const gate of activeGates) {
        const { tx, ty } = gate;
        const s = grid.structures[ty]?.[tx];
        if (!s || s.def.key !== 'gate') continue;
        const gx = tx * TILE_SIZE + TILE_SIZE / 2;
        const gy = ty * TILE_SIZE + TILE_SIZE / 2;
        const raiderNear = activeRaiders.some(r => {
            const dx = r.x - gx, dy = r.y - gy;
            return dx * dx + dy * dy <= rangeLimitSq;
        });
        s.gateOpen = s.manuallyLocked ? false : !raiderNear;
        if (!s.gateOpen) {
            for (const r of activeRaiders) {
                const dx = r.x - gx, dy = r.y - gy;
                const distSq = dx * dx + dy * dy;
                if (distSq <= breachLimitSq) {
                    const maxHp = getMaxHP('gate');
                    s.hp = (s.hp ?? maxHp) - (COMBAT_BALANCE?.raider?.gateBreachDps ?? 10) * dtSec;
                    if (s.hp <= 0) {
                        delete _tier2Upgrades[`${tx},${ty}`];
                        grid.structures[ty][tx] = createRubble();
                        spawnParticle(gx, gy, 'puff', 0.4);
                        triggerShake(8);
                        patchStaticCache(tx, ty);
                        rebuildStructureLists();
                        markUIDirty();
                    }
                    break;
                }
            }
        }
    }
}

function killRaider(r) {
    if (r.state === 'dead') return;
    r.state = 'dead';
    gameState.raidersDefeated = (gameState.raidersDefeated || 0) + 1;
    playEnemyDeathSFX();
    spawnParticle(r.x, r.y, 'puff', 0.4);
}

// --- Projectiles ---
function fireArrow(fromX, fromY, target, damage) {
    const T = 0.5;
    const g = 400;
    const vx = (target.x - fromX) / T;
    const vy = (target.y - fromY - 0.5 * g * T * T) / T;
    const p = getPooledProjectile();
    p.x = fromX; p.y = fromY; p.vx = vx; p.vy = vy; p.g = g; p.target = target; p.damage = damage; p.timer = 0; p.maxTime = T; p.type = 'arrow';
    activeProjectiles.push(p);
    playArrowSFX();
}

function fireBolt(fromX, fromY, target, damage) {
    const T = 0.35;
    const g = 400;
    const vx = (target.x - fromX) / T;
    const vy = (target.y - fromY - 0.5 * g * T * T) / T;
    const p = getPooledProjectile();
    p.x = fromX; p.y = fromY; p.vx = vx; p.vy = vy; p.g = g; p.target = target; p.damage = damage; p.timer = 0; p.maxTime = T; p.type = 'bolt';
    activeProjectiles.push(p);
    playBallistaSFX();
    triggerShake(3);
}

function updateActiveProjectiles(dtSec) {
    let j = 0;
    for (let i = 0; i < activeProjectiles.length; i++) {
        const p = activeProjectiles[i];
        p.timer += dtSec;
        p.x += p.vx * dtSec;
        p.vy += p.g * dtSec;
        p.y += p.vy * dtSec;
        if (p.timer >= p.maxTime) {
            const r = p.target;
            if (r && r.state === 'walking') {
                r.hp -= p.damage;
                spawnFloat(r.x, r.y - 10, `-${p.damage} HP`, '#ff4444', 1.0);
                if (r.hp <= 0) killRaider(r);
            }
            releaseProjectile(p);
        } else {
            activeProjectiles[j++] = p;
        }
    }
    activeProjectiles.length = j;
}

// --- Raiders ---
function _startFireAtTile(tx, ty) {
    const s = grid.structures[ty]?.[tx];
    if (!s || _NON_BURNABLE.has(s.def.key) || (s.progress ?? 1.0) < 1.0) return false;
    if (incidentManager?.active?.type === 'fire') {
        const alreadyBurning = incidentManager.active.fires.some(f => f.tx === tx && f.ty === ty);
        if (alreadyBurning) return false;
        if (s.hp === undefined) s.hp = getMaxHP(s.def.key);
        incidentManager.active.fires.push({ tx, ty, timer: 0 });
        showEventBanner('FIRE!', `A ${s.def.label ?? s.def.key} has been set ablaze!`);
        return true;
    }
    if (incidentManager?.active) return false;
    if (!incidentManager) return false;
    if (s.hp === undefined) s.hp = getMaxHP(s.def.key);
    incidentManager.active = { type: 'fire', fires: [{ tx, ty, timer: 0 }], spreadTimer: 0, timer: 0, duration: 15 };
    showEventBanner('FIRE!', `A ${s.def.label ?? s.def.key} has been set ablaze!`);
    playFireSFX();
    return true;
}

function _getRaiderType(waveNum) {
    const r = Math.random();
    if (waveNum <= 3) return 'normal';
    if (waveNum <= 6) return r < 0.80 ? 'normal' : r < 0.90 ? 'torch' : 'siege';
    if (waveNum <= 9) return r < 0.60 ? 'normal' : r < 0.80 ? 'torch' : 'siege';
    return r < 0.50 ? 'normal' : r < 0.75 ? 'torch' : 'siege';
}

function getRaidWaveSize(waveNum) {
    if (waveNum < 1) return 0;
    if (waveNum <= FINAL_RAID_WAVE) return RAID_WAVE_SIZES[waveNum - 1];
    // Endless mode: waves keep growing past the final scripted wave, capped for perf.
    if (!gameState.endless) return 0;
    const over = waveNum - FINAL_RAID_WAVE;
    return Math.min(260, Math.round(RAID_WAVE_SIZES[FINAL_RAID_WAVE - 1] * Math.pow(1.18, over)));
}

// Difficulty (and diplomacy penalties like raid_strong) scale the wave via
// raidStrength relative to the Lord baseline. Previously raidStrength was
// saved/migrated but never read — difficulty had no effect on raids at all.
function getScaledWaveSize(waveNum, strength = raidStrength) {
    const base = getRaidWaveSize(waveNum);
    if (base <= 0) return 0;
    const lordBaseline = getRaidStrengthForWave(Math.min(waveNum, FINAL_RAID_WAVE), 'lord');
    const mult = lordBaseline > 0 ? strength / lordBaseline : 1;
    return Math.max(1, Math.round(base * mult));
}

function chooseRaidDirections(waveNum, waveSize) {
    const allDirs = ['N','NE','E','SE','S','SW','W','NW'];
    if (waveNum <= 2 || waveSize <= 10) return [allDirs[Math.floor(Math.random() * 8)]];
    const numDirs = waveSize >= 45 ? 4 : waveSize >= 20 ? 3 : 2;
    return [...allDirs].sort(() => Math.random() - 0.5).slice(0, numDirs);
}

function getSpawnPos(dir) {
    const W = grid.width * TILE_SIZE, H = grid.height * TILE_SIZE, off = TILE_SIZE;
    switch (dir) {
        case 'N':  return { x: W * 0.2 + Math.random() * W * 0.6, y: -off };
        case 'S':  return { x: W * 0.2 + Math.random() * W * 0.6, y: H + off };
        case 'E':  return { x: W + off, y: H * 0.2 + Math.random() * H * 0.6 };
        case 'W':  return { x: -off,    y: H * 0.2 + Math.random() * H * 0.6 };
        case 'NE': return Math.random() < 0.5 ? { x: W * 0.55 + Math.random() * W * 0.45, y: -off } : { x: W + off, y: Math.random() * H * 0.45 };
        case 'NW': return Math.random() < 0.5 ? { x: Math.random() * W * 0.45, y: -off } : { x: -off, y: Math.random() * H * 0.45 };
        case 'SE': return Math.random() < 0.5 ? { x: W * 0.55 + Math.random() * W * 0.45, y: H + off } : { x: W + off, y: H * 0.55 + Math.random() * H * 0.45 };
        case 'SW': return Math.random() < 0.5 ? { x: Math.random() * W * 0.45, y: H + off } : { x: -off, y: H * 0.55 + Math.random() * H * 0.45 };
        default:   return { x: W / 2, y: -off };
    }
}

function sendCitizensToHide() {
    for (const c of citizens) {
        assignCitizenToHide(c);
    }
}

let _raidersDefeatedAtWaveStart = 0;
// Allows loadGame() to re-baseline the per-wave kill counter after a mid-raid load
window._setRaidersDefeatedAtWaveStart = v => { _raidersDefeatedAtWaveStart = v; };

// Wave plan built at scout time so the scout warning can preview the ACTUAL
// incoming wave (size, composition, directions) — startRaidWave then spawns
// exactly what was announced.
let _raidPlan = null;

function _buildRaidPlan(waveNum) {
    const size = getScaledWaveSize(waveNum);
    const dirs = chooseRaidDirections(waveNum, size);
    const spawns = [];
    let torch = 0, siege = 0;
    for (let i = 0; i < size; i++) {
        const pos = getSpawnPos(dirs[i % dirs.length]);
        const type = _getRaiderType(waveNum);
        if (type === 'torch') torch++;
        else if (type === 'siege') siege++;
        spawns.push({ x: pos.x, y: pos.y, type });
    }
    return { waveNum, size, dirs, spawns, torch, siege };
}

// Enters the 30s scout warning with a concrete preview of the incoming wave.
function beginScoutPhase() {
    setRaidTimer(0);
    setRaidQueued(false);
    setScoutPhase(true);
    setScoutTimer(30);
    _raidPlan = _buildRaidPlan(raidCount + 1);
    const comp = [];
    if (_raidPlan.torch) comp.push(`${_raidPlan.torch} torch`);
    if (_raidPlan.siege) comp.push(`${_raidPlan.siege} siege`);
    const compStr = comp.length ? ` (${comp.join(', ')})` : '';
    showEventBanner('SCOUTS SPOTTED!',
        `${_raidPlan.size} raiders${compStr} from the ${_raidPlan.dirs.join('/')} — close your gates!`);
    playRaidWarningSFX();
    setRaidWarningPlayed(true);
}

function startRaidWave() {
    const waveNum = raidCount + 1;
    if (waveNum > FINAL_RAID_WAVE && !gameState.endless) return;
    _raidersDefeatedAtWaveStart = gameState.raidersDefeated || 0;
    setRaidActive(true);
    setRaidActiveTimer(0);
    setRaidTimer(0);
    setScoutPhase(false);
    setScoutTimer(0);
    setRaidQueued(false);
    setRaidBuildingsDestroyed(0);
    setRaidCitizensKilled(0);
    // raid-warning vignette is owned by updateRaidHUD (cached class writes) —
    // touching classList directly here would desync its cache
    sendCitizensToHide();
    // Spawn exactly what the scouts announced; rebuild only if no plan exists
    // (e.g. loaded a save mid-scout-phase).
    const plan = (_raidPlan && _raidPlan.waveNum === waveNum) ? _raidPlan : _buildRaidPlan(waveNum);
    _raidPlan = null;
    showEventBanner(`RAID WAVE ${waveNum}`, `${plan.size} raiders are attacking now!`);
    playRaidWarningSFX();
    setRaidWarningPlayed(true);
    for (const spawn of plan.spawns) {
        raiders.push(new Raider(spawn.x, spawn.y, spawn.type));
    }
}

function updateRaiders(dtSec) {
    for (const r of raiders) r.update(dtSec);

    // Tower firing using activeTowers
    for (const tower of activeTowers) {
        const { tx, ty } = tower;
        const s = grid.structures[ty]?.[tx];
        if (!s || s.def.key !== 'tower') continue;
        const id = `${tx}_${ty}`;
        const TB = COMBAT_BALANCE?.tower;
        towerFireTimers[id] = (towerFireTimers[id] || 0) + dtSec;
        if (towerFireTimers[id] < (TB?.fireIntervalSec ?? 1.0)) continue;

        const towerX = tx * TILE_SIZE + TILE_SIZE / 2;
        const towerY = ty * TILE_SIZE + TILE_SIZE / 2;
        const isT2Tower = !!_tier2Upgrades[`${tx},${ty}`];
        const RANGE = (isT2Tower ? (TB?.tier2RangeTiles ?? 10) : (TB?.rangeTiles ?? 8)) * TILE_SIZE;
        const RANGESQ = RANGE * RANGE;
        let closest = null, closestDistSq = Infinity;
        for (const r of raiders) {
            if (r.state !== 'walking') continue;
            const dx = r.x - towerX;
            const dy = r.y - towerY;
            const distSq = dx * dx + dy * dy;
            if (distSq < RANGESQ && distSq < closestDistSq) { closest = r; closestDistSq = distSq; }
        }

        if (closest) {
            towerFireTimers[id] = 0;
            closest.hp -= isT2Tower ? (TB?.tier2Damage ?? 30) : (TB?.damage ?? 25);
            playShootSFX();
            const vp = getPooledVisualProjectile();
            vp.fromX = towerX; vp.fromY = towerY; vp.toX = closest.x; vp.toY = closest.y; vp.timer = 0; vp.duration = 0.15;
            projectiles.push(vp);
            if (closest.hp <= 0) {
                killRaider(closest);
            }
        }
    }

    // Ballista tower firing using activeBallistaTowers
    for (const bt of activeBallistaTowers) {
        const { tx, ty } = bt;
        const s = grid.structures[ty]?.[tx];
        if (!s || s.def.key !== 'ballista_tower') continue;
        const id = `bt_${tx}_${ty}`;
        towerFireTimers[id] = (towerFireTimers[id] || 0) + dtSec;
        if (towerFireTimers[id] < (COMBAT_BALANCE?.ballista?.fireIntervalSec ?? 8.0)) continue;
        const bx = tx * TILE_SIZE + TILE_SIZE / 2;
        const by = ty * TILE_SIZE + TILE_SIZE / 2;
        const RANGE = (bt.range ?? 16) * TILE_SIZE;
        const RANGESQ = RANGE * RANGE;
        let target = null, maxHp = -1;
        for (const r of raiders) {
            if (r.state !== 'walking') continue;
            const dx = r.x - bx;
            const dy = r.y - by;
            const distSq = dx * dx + dy * dy;
            if (distSq <= RANGESQ && r.hp > maxHp) { target = r; maxHp = r.hp; }
        }
        if (target) {
            towerFireTimers[id] = 0;
            fireBolt(bx, by, target, bt.damage ?? 75);
        }
    }

    let rj = 0;
    const offscreenMargin = TILE_SIZE * 6;
    const maxX = grid.width * TILE_SIZE + offscreenMargin;
    const maxY = grid.height * TILE_SIZE + offscreenMargin;
    for (let i = 0; i < raiders.length; i++) {
        const r = raiders[i];
        const invalidPosition = !Number.isFinite(r.x) || !Number.isFinite(r.y);
        const tooFarOffMap = r.x < -offscreenMargin || r.x > maxX || r.y < -offscreenMargin || r.y > maxY;
        if (invalidPosition || tooFarOffMap) {
            r.state = 'dead';
        }
        if (r.state !== 'dead') raiders[rj++] = r;
    }
    raiders.length = rj;
}

function updateEffects(dtSec) {
    let ej = 0;
    for (let i = 0; i < raiders.length; i++) {
        const r = raiders[i];
        if (r.state === 'victory') {
            r._victoryTimer += dtSec;
            r._rotation = r._victoryTimer * Math.PI * 4;
            r._alpha = Math.max(0, 1.0 - r._victoryTimer);
            if (r._victoryTimer < 1.0) raiders[ej++] = r;
        } else if (r.state === 'defeat') {
            r._defeatTimer += dtSec;
            const t = Math.min(1.0, r._defeatTimer / 1.5);
            r.x = r._defeatFromX + (r._defeatTargetX - r._defeatFromX) * t;
            r.y = r._defeatFromY + (r._defeatTargetY - r._defeatFromY) * t;
            if (t < 1.0) raiders[ej++] = r;
        } else {
            raiders[ej++] = r;
        }
    }
    raiders.length = ej;
    let pj = 0;
    for (let i = 0; i < projectiles.length; i++) {
        projectiles[i].timer += dtSec;
        if (projectiles[i].timer < projectiles[i].duration) {
            projectiles[pj++] = projectiles[i];
        } else {
            releaseVisualProjectile(projectiles[i]);
        }
    }
    projectiles.length = pj;

    let pk = 0;
    for (let i = 0; i < particles.length; i++) {
        particles[i].timer += dtSec;
        particles[i].alpha = Math.max(0, 1.0 - particles[i].timer / particles[i].duration);
        if (particles[i].timer < particles[i].duration) {
            particles[pk++] = particles[i];
        } else {
            releaseParticle(particles[i]);
        }
    }
    particles.length = pk;
}

// --- Raid ---
// updateRaidHUD and showModal are imported from ui.js (single source of truth).

function resolveRaid() {
    if (!raidActive) return;
    setRaidActive(false);
    // Outcome is decided by what actually happened during the fight, not by a
    // static defense-vs-strength comparison: a raid is repelled when the town
    // kept its buildings and people mostly intact.
    const waveNum = raidCount + 1;
    const waveSize = getRaidWaveSize(waveNum);
    const killsThisWave = Math.max(0, (gameState.raidersDefeated || 0) - _raidersDefeatedAtWaveStart);
    const isVictory = raidBuildingsDestroyed <= Math.max(1, Math.floor(waveSize * 0.1))
                   && raidCitizensKilled   <= Math.max(1, Math.floor(waveSize * 0.15));
    for (const r of raiders) {
        if (r.state !== 'walking') continue;
        if (isVictory) {
            r.state = 'victory'; r._victoryTimer = 0; r._alpha = 1.0; r._rotation = 0;
        } else {
            r.state = 'defeat'; r._defeatTimer = 0;
            r._defeatFromX = r.x; r._defeatFromY = r.y;
            r._defeatTargetX = r.x < grid.width * TILE_SIZE / 2 ? -TILE_SIZE * 3 : (grid.width + 3) * TILE_SIZE;
            r._defeatTargetY = r.y;
        }
    }
    if (isVictory) {
        // Reward scales with the wave and how many raiders were actually slain
        const reward = 50 + waveNum * 40 + killsThisWave * 2;
        gameState.gold += reward;
        if (waveNum >= FINAL_RAID_WAVE && !gameState.endless) {
            setRaidCount(FINAL_RAID_WAVE);
            stopRaidWarningSFX();
            triggerVictory('wave10');
            return;
        }
        showModal(true, [
            `Wave ${waveNum} repelled!`,
            `Raiders slain: ${killsThisWave}`,
            `Buildings lost: ${raidBuildingsDestroyed}`,
            `Citizens slain: ${raidCitizensKilled}`,
            `+${reward} Gold rewarded`,
        ]);
    } else {
        const goldLost = Math.floor(gameState.gold * 0.2);
        gameState.gold = Math.max(0, gameState.gold - goldLost);
        const lines = [
            `Wave ${waveNum} broke through!`,
            `Raiders slain: ${killsThisWave}`,
            `Buildings destroyed: ${raidBuildingsDestroyed}`,
            `Citizens slain: ${raidCitizensKilled}`,
        ];
        if (goldLost > 0) lines.push(`Gold pillaged: -${goldLost}`);
        showModal(false, lines);
    }
    // Proxy marks UI dirty; flushUI() will sync on next frame
}

document.getElementById('modal-continue').addEventListener('click', () => {
    document.getElementById('raid-modal').classList.remove('open');
    setRaidTimer(RAID_DURATION);
    const completedWave = raidCount + 1;
    const nextWave = completedWave + 1;
    // Reset any raid_strong penalty back to the difficulty preset for the next
    // wave (clamped to the final scripted wave's strength in endless mode).
    setRaidStrength(getRaidStrengthForWave(Math.min(nextWave, FINAL_RAID_WAVE)));
    setRaidCount(completedWave);
    setRaidWarningPlayed(false);
    setRaidWarningSpawnCount(0);
    setRaidActive(false);
    setScoutPhase(false);
    setScoutTimer(0);
    setRaidActiveTimer(0);
    raiders.length = 0;
    for (const c of citizens) {
        if (c.job === 'hiding' || c.job === 'rebel') {
            c.job = 'idle';
            c._phase = 'idle';
            c._rebelTarget = null;
            c._workTX = -1;
            c._workTY = -1;
        }
    }
    if (incidentManager) incidentManager.resetTimer();
    projectiles.length = 0;
    activeProjectiles.length = 0;
    particles.length = 0;
    Object.keys(towerFireTimers).forEach(k => delete towerFireTimers[k]);
    if (completedWave >= FINAL_RAID_WAVE && !gameState.endless) {
        stopRaidWarningSFX();
        triggerVictory('wave10');
        return;
    }
    setGameIsPaused(false);
    refreshUI();
    updateRaidHUD();
});

document.getElementById('trade-close').addEventListener('click', () => {
    document.getElementById('trade-modal').classList.remove('open');
    setGameIsPaused(false);
    if (merchantNPC && merchantNPC.state === 'trading') merchantNPC.state = 'departing';
});


// ===================== SETTINGS & TIME LISTENERS =====================
// Note: btn-pause and btn-doubletime handlers are registered in ui.js
// alongside updateTimePauseUI(). Registering them here too would cause
// double-toggle (net zero effect), making the buttons non-functional.

// --- Settings / corner icons ---
document.getElementById('btn-settings-icon').addEventListener('click', () => {
    document.getElementById('settings-drawer').classList.toggle('hidden');
});
document.getElementById('btn-mute-icon').addEventListener('click', () => {
    const muted = toggleMute();
    document.getElementById('btn-mute-icon').textContent = muted ? '✕' : '♪';
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) muteBtn.textContent = muted ? '♪ UNMUTE' : '♪ MUTE';
});
document.getElementById('btn-help-icon').addEventListener('click', () => {
    // Full help overlay (reuses the tutorial pages) instead of a 4s banner
    showTutorial();
});

// --- Settings ---
// SAVE CITY writes the manual slot, which the 10s autosave never touches — so
// a deliberate save survives later mistakes.
document.getElementById('btn-save').addEventListener('click', () => { saveGame(MANUAL_SAVE_KEY); flashAutosave(); });

function loadAndStart(slotKey) {
    if (!loadGame(slotKey)) return;
    selectedDifficultyKey = gameState.difficulty || DEFAULT_DIFFICULTY_KEY;
    renderDifficultyOptions();
    initAudio();
    document.getElementById('start-screen').style.display = 'none';
    gameState.started = true;
    setGameIsPaused(false);
    setUserPaused(false);
    setTimeScale(1);
    if (window.updateTimePauseUI) window.updateTimePauseUI();
    lastTime = 0;
}
document.getElementById('btn-load').addEventListener('click', () => {
    // Prefer the manual slot; fall back to the autosave if none exists yet
    loadAndStart(localStorage.getItem(MANUAL_SAVE_KEY) ? MANUAL_SAVE_KEY : SAVE_KEY);
});
document.getElementById('btn-load-autosave')?.addEventListener('click', () => {
    loadAndStart(SAVE_KEY);
});
document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset game? All progress will be lost.')) resetGame();
});
document.getElementById('btn-mute').addEventListener('click', () => {
    const muted = toggleMute();
    document.getElementById('btn-mute').textContent = muted ? '♪ UNMUTE' : '♪ MUTE';
    const muteIcon = document.getElementById('btn-mute-icon');
    if (muteIcon) muteIcon.textContent = muted ? '✕' : '♪';
});

document.getElementById('vol-master').addEventListener('input', e => {
    _volMaster = parseInt(e.target.value);
    _applyVolumes();
    _saveSettings();
});
document.getElementById('vol-music').addEventListener('input', e => {
    _volMusic = parseInt(e.target.value);
    _applyVolumes();
    _saveSettings();
});
document.getElementById('vol-sfx').addEventListener('input', e => {
    _volSfx = parseInt(e.target.value);
    _applyVolumes();
    _saveSettings();
});


// ===================== JOB SYSTEM =====================
// --- Job System ---
const _JOB_FOR_KEY = { farm: 'farmer', lumberyard: 'woodcutter', quarry: 'stone_miner', mine: 'iron_miner' };

function assignCitizenJobs() {
    // Single pass over citizens: snapshot the idle pool and tally existing assignments.
    const workerCounts = {};
    const hasBuilder = {};
    const idleQueue = [];
    for (const c of citizens) {
        if (c.job === 'idle' && c.state !== 'walking') idleQueue.push(c);
        if (c._workTX !== -1 && c._workTY !== -1) {
            const s = grid.structures[c._workTY]?.[c._workTX];
            const expectedJob = s ? _JOB_FOR_KEY[s.def.key] : null;
            const key = `${c._workTX},${c._workTY}`;
            if (c.job === 'builder') {
                hasBuilder[key] = true;
            } else if (expectedJob && c.job === expectedJob) {
                workerCounts[key] = (workerCounts[key] || 0) + 1;
            } else if (c.job === 'idle' || c.job === 'rebel') {
                c._workTX = -1;
                c._workTY = -1;
            }
        }
    }
    let qi = 0; // pointer into idleQueue — each idle citizen is assigned at most once
    const takeBuilder = () => {
        if (qi < idleQueue.length) return idleQueue[qi++];
        const worker = citizens.find(c =>
            c.state !== 'walking' &&
            (c.job === 'farmer' || c.job === 'woodcutter' || c.job === 'stone_miner' || c.job === 'iron_miner')
        );
        if (!worker) return null;
        const oldKey = `${worker._workTX},${worker._workTY}`;
        workerCounts[oldKey] = Math.max(0, (workerCounts[oldKey] || 1) - 1);
        return worker;
    };
    for (const { tx, ty } of underConstruction) {
        const s = grid.structures[ty][tx];
        if (!s || s.progress === undefined || s.progress >= 1.0) continue;
        const key = `${tx},${ty}`;
        if (hasBuilder[key]) continue;
        const worker = takeBuilder();
        if (!worker) break;
        worker.job = 'builder';
        worker._phase = 'go_work';
        worker._workTX = tx;
        worker._workTY = ty;
        worker._nodeTX = -1;
        worker._nodeTY = -1;
        hasBuilder[key] = true;
    }

    // Assign resource-gathering workers to completed workplaces (iterate maintained list,
    // not the full grid). At most one new worker per workplace per call, as before.
    for (const { tx, ty, def } of jobfulStructures) {
        if (qi >= idleQueue.length) break;
        const s = grid.structures[ty][tx];
        if (!s || (s.progress ?? 1.0) < 1.0) continue;
        const key = `${tx},${ty}`;
        const workerCount = workerCounts[key] || 0;
        if (workerCount >= def.maxWorkers) continue;
        const jobType = _JOB_FOR_KEY[def.key];
        if (!jobType) continue;
        const idle = idleQueue[qi++];
        idle.job = jobType;
        idle._phase = 'go_work';
        idle._workTX = tx;
        idle._workTY = ty;
        workerCounts[key] = workerCount + 1;
    }

    // Assign builders to under-construction buildings (maintained list; completed entries
    // are skipped here and pruned on the next rebuildStructureLists).
    for (const { tx, ty } of underConstruction) {
        if (qi >= idleQueue.length) break;
        const s = grid.structures[ty][tx];
        if (!s || s.progress === undefined || s.progress >= 1.0) continue;
        const key = `${tx},${ty}`;
        if (hasBuilder[key]) continue;
        const idle = idleQueue[qi++];
        idle.job = 'builder';
        idle._phase = 'go_work';
        idle._workTX = tx;
        idle._workTY = ty;
        hasBuilder[key] = true;
    }
}

function updatePassiveFarmProduction(dtSec) {
    // "Farms are barren" — drought halts passive output too (worker harvests
    // already checked droughtActive; passive production silently didn't).
    if (droughtActive) { passiveFarmTimer = 0; return; }
    passiveFarmTimer += dtSec;
    const cycleSec = window.PRODUCTION_BALANCE?.farmCycleSec ?? 2.0;
    if (passiveFarmTimer < cycleSec) return;

    const cycles = Math.floor(passiveFarmTimer / cycleSec);
    passiveFarmTimer -= cycles * cycleSec;

    let completedFarmCount = 0;
    for (const { tx, ty } of activeFarms) {
        const s = grid.structures[ty]?.[tx];
        if (s && s.def.key === 'farm' && (s.progress ?? 1.0) >= 1.0) {
            completedFarmCount++;
        }
    }
    if (completedFarmCount <= 0) return;

    const passiveBase = window.PRODUCTION_BALANCE?.farmPassiveFoodPerCycle ?? 1;
    const passiveUpgradeBonus = gameState.upgrades?.crop_rotation ? 0.5 : 0;
    const passiveFood = (passiveBase + passiveUpgradeBonus) * completedFarmCount * cycles;
    gameState.food = Math.min(getFoodCap(), gameState.food + passiveFood);
}

function updateCitizensSafely(dtSec, timestamp = performance.now()) {
    for (const c of citizens) {
        try {
            c.update(dtSec, grid);
        } catch (err) {
            if (timestamp - _lastCitizenUpdateErrorTime > 1000) {
                _lastCitizenUpdateErrorTime = timestamp;
                console.error('[Pixel Dominion] Citizen update error (citizen skipped this frame):', err, c);
            }
        }
    }
}

// Once per day: trees slowly regrow next to existing trees and depleted
// stone/iron deposits are occasionally replaced, so harvest nodes stay a
// renewable (but scarce) part of the economy instead of a one-way ratchet.
function regrowNature() {
    if (gameState.season === 'Winter') return; // nothing grows in winter
    const trees = [];
    let stoneCount = 0, ironCount = 0;
    for (let ty = 0; ty < grid.height; ty++) {
        for (let tx = 0; tx < grid.width; tx++) {
            const s = grid.structures[ty][tx];
            if (!s) continue;
            if (s.def.key === 'obstacle_tree') trees.push({ tx, ty });
            else if (s.def.key === 'stone_deposit') stoneCount++;
            else if (s.def.key === 'iron_vein') ironCount++;
        }
    }
    const TREE_CAP = 220; // ≈ initial map density
    const newTrees = [];
    if (trees.length > 0 && trees.length < TREE_CAP) {
        for (const t of trees) {
            if (trees.length + newTrees.length >= TREE_CAP) break;
            if (Math.random() >= 0.05) continue;
            const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
            const d = dirs[Math.floor(Math.random() * dirs.length)];
            const nx = t.tx + d.dx, ny = t.ty + d.dy;
            if (!grid.inBounds(nx, ny)) continue;
            if (grid.structures[ny][nx] || grid.tiles[ny][nx] !== 'tile_grass') continue;
            newTrees.push({ tx: nx, ty: ny });
        }
    }
    for (const { tx, ty } of newTrees) {
        if (grid.structures[ty][tx]) continue;
        grid.structures[ty][tx] = { def: TREE_DEF };
        patchStaticCache(tx, ty);
    }
    const spawnDeposit = (def, hp) => {
        for (let tries = 0; tries < 24; tries++) {
            const tx = Math.floor(Math.random() * grid.width);
            const ty = Math.floor(Math.random() * grid.height);
            if (grid.structures[ty][tx] || grid.tiles[ty][tx] !== 'tile_grass') continue;
            grid.structures[ty][tx] = { def, hp };
            patchStaticCache(tx, ty);
            return;
        }
    };
    if (stoneCount < 6 && Math.random() < 0.30) spawnDeposit(STONE_DEP_DEF, 5);
    if (ironCount < 3 && Math.random() < 0.25) spawnDeposit(IRON_VEIN_DEF, 5);
}

function updateRubbleDecay(dtSec) {
    // Iterates the maintained rubble list instead of sweeping all 4096 tiles per frame.
    let changed = false;
    for (const { tx, ty } of activeRubble) {
        const s = grid.structures[ty][tx];
        if (!s || s.def.key !== 'rubble') continue;
        s.decayTimer = (s.decayTimer ?? DAY_DURATION) - dtSec;
        if (s.decayTimer <= 0) {
            grid.structures[ty][tx] = null;
            patchStaticCache(tx, ty);
            changed = true;
        }
    }
    if (changed) {
        rebuildStructureLists();
        refreshUI();
    }
}


// ===================== UPDATE LOOP =====================
function update(dtMs) {
    // Flush any pending reactive UI updates (from gameState Proxy dirty flag)
    flushUI();
    updateCameraShake();
    if (gameState.started && !userPaused) updateEffects(dtMs / 1000);
    // Overlay alpha interpolates in real time (not paused, not time-scaled)
    const _dtReal = dtMs / 1000;
    const _targetOverlayAlpha = { dawn: 0.15, day: 0.0, dusk: 0.15, night: 0.55 }[_dayPhase] ?? 0;
    setOverlayAlpha(_overlayAlpha + (_targetOverlayAlpha - _overlayAlpha) * Math.min(1, _dtReal / 3));
    if (!gameState.started || gameIsPaused || userPaused) return;
    const dtSec = (dtMs / 1000) * timeScale;
    setGriefPenalty(Math.max(0, _griefPenalty - dtSec * 0.25));
    // Frame-rate independent, zoom-compensated panning (was 10px per FRAME,
    // which panned 2.4× faster on a 144Hz monitor than at 60Hz).
    const panSpeed = 600 * _dtReal / camera.zoom;
    if (keys['w'] || keys['arrowup'])    camera.y -= panSpeed;
    if (keys['s'] || keys['arrowdown'])  camera.y += panSpeed;
    if (keys['a'] || keys['arrowleft'])  camera.x -= panSpeed;
    if (keys['d'] || keys['arrowright']) camera.x += panSpeed;
    const maxCameraX = Math.max(0, grid.width  * TILE_SIZE - canvas.width  / camera.zoom);
    const maxCameraY = Math.max(0, grid.height * TILE_SIZE - canvas.height / camera.zoom);
    camera.x = Math.max(0, Math.min(maxCameraX, camera.x));
    camera.y = Math.max(0, Math.min(maxCameraY, camera.y));

    if (!raidActive) {
        // A raid queued during daylight launches its 30s scout warning at dusk
        // (dayTimer >= 42), so the wave lands around nightfall. A hard 45s cap
        // guarantees the queue can never stall silently; the HUD shows a live
        // countdown to dusk the whole time.
        if (_raidQueued && !_scoutPhase) {
            setRaidTimer(raidTimer + dtSec); // elapsed-while-queued safety counter
            const _qPhase = _getDayPhase(dayTimer);
            if (_qPhase === 'dusk' || _qPhase === 'night' || raidTimer >= 45) {
                beginScoutPhase();
            }
        }
        if (raidCount >= FINAL_RAID_WAVE && !gameState.endless) {
            setRaidTimer(0);
            setRaidQueued(false);
            setScoutPhase(false);
        } else if (_scoutPhase) {
            setScoutTimer(_scoutTimer - dtSec);
            if (_scoutTimer <= 0) { setScoutPhase(false); startRaidWave(); }
        } else if (!_raidQueued) {
            setRaidTimer(raidTimer - dtSec);
            if (raidTimer <= 0) {
                const _rPhase = _getDayPhase(dayTimer);
                if (_allianceTimer > 0) {
                    setRaidTimer(RAID_DURATION); // alliance suppresses this raid
                } else if (raidCount === 0 || _rPhase === 'dusk' || _rPhase === 'night') {
                    beginScoutPhase();
                } else {
                    setRaidTimer(0);
                    setRaidQueued(true); // scouts launch at dusk
                    showEventBanner('RAIDERS GATHERING', 'They will strike at dusk — prepare your defenses!');
                }
            }
        }
    } else {
        setRaidActiveTimer(raidActiveTimer + dtSec);
        // Failsafe: a raid that somehow drags past RAID_ACTIVE_TIMEOUT (stuck
        // raider, starved pathfinding) force-retreats every remaining walker so
        // the game can never stall in a permanent raid.
        if (raidActiveTimer >= RAID_ACTIVE_TIMEOUT) {
            for (const r of raiders) {
                if (r.state !== 'walking') continue;
                r._attacking = false;
                r._target = { type: 'retreat' };
                r._path = [];
                r._pathIndex = 0;
                r._repathTimer = 0;
            }
        }
        let anyWalking = false;
        for (let i = 0; i < raiders.length; i++) {
            if (raiders[i].state === 'walking') { anyWalking = true; break; }
        }
        if (raiders.length === 0 || !anyWalking) {
            resolveRaid();
        }
    }
    updateRaidHUD();

    let nextDayTimer = dayTimer + dtSec;
    if (nextDayTimer >= DAY_DURATION) {
        nextDayTimer -= DAY_DURATION;
        setDayTimer(nextDayTimer);
        gameState.day = (gameState.day || 1) + 1;
        if ((gameState.day - 1) % 7 === 0) {
            gameState.season = SEASONS[Math.floor((gameState.day - 1) / 7) % 4];
        }
        if (gameState.season !== _lastSeason) {
            const _bannerData = {
                Spring: { title: 'SPRING HAS ARRIVED', desc: 'Farms bloom. Food yield is increased.' },
                Summer: { title: 'SUMMER HEAT',        desc: 'Drought risk doubles. Stay prepared.' },
                Autumn: { title: 'HARVEST SEASON',     desc: 'Lumberyards thrive. +20 Food bonus!' },
                Winter: { title: 'WINTER FALLS',       desc: 'Food scarce. Workers move slowly.' },
            };
            const bd = _bannerData[gameState.season];
            if (bd) showEventBanner(bd.title, bd.desc);
            if (gameState.season === 'Autumn') { gameState.food += 20; gameState.food = Math.min(gameState.food, getFoodCap()); }
            setLastSeason(gameState.season);
        }
        regrowNature();
        updateDaySeason();
    } else {
        setDayTimer(nextDayTimer);
    }

    // Day phase tracking — detect transitions and update HUD glyph
    const _newPhase = _getDayPhase(dayTimer);
    if (_newPhase !== _dayPhase) {
        setDayPhase(_newPhase);
        _updateDayPhaseGlyph();
    }

    setRaidPathBudget(15);
    // Rebuild the anti-stacking spatial hash once per frame (coarse bucket grid
    // over citizens/soldiers/archers/knights/raiders) so every unit's per-frame
    // separation check is a handful of bucket lookups instead of an O(n²) scan.
    rebuildSeparationGrid();
    // Per-frame melee context: reset target-pile counts and cache the defend
    // rally tile once (soldiers/knights read window._defendRally for the leash).
    window._combatTargetCounts?.clear();
    window._defendRally = (_combatMode === 'defend' && raidActive && window._getDefendRallyTile)
        ? window._getDefendRallyTile() : null;
    // Refill the shared active-raiders scratch list in place (no allocation) — reused by
    // soldiers, archers, knights, gates.
    _activeRaiders.length = 0;
    if (raidActive) {
        for (let i = 0; i < raiders.length; i++) {
            if (raiders[i].state === 'walking') _activeRaiders.push(raiders[i]);
        }
    }
    if (raiders.length > 0) updateRaiders(dtSec);
    updateSoldiers(dtSec, _activeRaiders);
    updateGates(dtSec, _activeRaiders);
    updateArchers(dtSec, _activeRaiders);
    updateKnights(dtSec, _activeRaiders);

    const nextJobScanTimer = jobScanTimer + dtSec;
    if (nextJobScanTimer >= JOB_SCAN_INTERVAL) {
        setJobScanTimer(0);
        assignCitizenJobs();
    } else {
        setJobScanTimer(nextJobScanTimer);
    }

    updateCitizensSafely(dtSec);

    updateActiveProjectiles(dtSec);
    updatePassiveFarmProduction(dtSec);
    updateRubbleDecay(dtSec);

    const nextTaxTimer = taxTimer + dtSec;
    if (nextTaxTimer >= TAX_INTERVAL) {
        setTaxTimer(0);
        // Food consumed by population and military each tax tick
        const foodDrainMult = SEASON_MODIFIERS[SEASONS.indexOf(gameState.season)].foodDrainMult;
        const foodDrain = (gameState.population + soldiers.length + archers.length + knights.length) * foodDrainMult;
        if (foodDrain > 0) gameState.food = Math.max(0, gameState.food - foodDrain);
        gameState.food = Math.min(gameState.food, getFoodCap());
        gameState.happiness = calcHappiness();
        // Rebel citizens when Joy < 50%
        if (!raidActive && gameState.happiness < 50 && soldiers.length > 0) {
            const unhappiness = (50 - gameState.happiness) / 50;
            const targetRebels = Math.max(1, Math.floor(unhappiness * citizens.length * 0.3));
            const currentRebels = citizens.filter(c => c.job === 'rebel').length;
            if (currentRebels < targetRebels) {
                const idle = citizens.filter(c => c.job === 'idle');
                if (idle.length > 0) {
                    const r = idle[Math.floor(Math.random() * idle.length)];
                    r.job = 'rebel'; r._phase = 'rebel'; r._phaseTimer = 0; r._rebelTarget = null;
                }
            }
        } else {
            for (const c of citizens) {
                if (c.job === 'rebel') { c.job = 'idle'; c._phase = 'idle'; c._rebelTarget = null; }
            }
        }
        const citizenCount = gameState.happiness < 40 ? Math.floor(gameState.population * 0.5) : gameState.population;
        const baseTax = citizenCount * (ECONOMY_BALANCE?.baseGoldPerCitizen ?? 1);
        const tradeBonus = gameState.upgrades?.trade_guilds ? citizenCount * (ECONOMY_BALANCE?.tradeGuildsGoldPerCitizen ?? 1) : 0;
        const upkeep = soldiers.length * (ECONOMY_BALANCE?.militaryUpkeep?.soldier ?? 1)
                     + archers.length  * (ECONOMY_BALANCE?.militaryUpkeep?.archer ?? 1)
                     + knights.length  * (ECONOMY_BALANCE?.militaryUpkeep?.knight ?? 2);
        const tax = baseTax + tradeBonus;
        const netGold = tax - upkeep;
        gameState.gold = Math.max(0, gameState.gold + netGold);
        if (netGold > 0) {
            playTaxSFX();
            spawnFloat(32.5 * TILE_SIZE, 31 * TILE_SIZE, `+${netGold} Gold`, '#ffdd57', 1.2);
        } else if (netGold < 0) {
            spawnFloat(32.5 * TILE_SIZE, 31 * TILE_SIZE, `${netGold} Gold`, '#ff8866', 1.2);
        }
        // Proxy marks UI dirty; flushUI() syncs at top of next update()
    } else {
        setTaxTimer(nextTaxTimer);
    }

    const si = getSpawnInterval();
    if (gameState.housing > 0 && gameState.population < gameState.housing && si < Infinity) {
        const nextSpawnTimer = spawnTimer + dtSec;
        if (nextSpawnTimer >= si) { setSpawnTimer(0); spawnCitizen(); }
        else setSpawnTimer(nextSpawnTimer);
    } else { setSpawnTimer(0); }

    if (gameState.happiness < 40 && gameState.population > 0) {
        const nextEmigrationTimer = emigrationTimer + dtSec;
        if (nextEmigrationTimer >= EMIGRATION_INTERVAL) {
            setEmigrationTimer(0);
            if (citizens.length > 0) {
                const idleIdx = citizens.findIndex(c => c.job === 'idle');
                const removeIdx = idleIdx !== -1 ? idleIdx : Math.floor(Math.random() * citizens.length);
                citizens[removeIdx]._alive = false;
                citizens.splice(removeIdx, 1);
            }
            gameState.population = Math.max(0, gameState.population - 1);
            // Proxy marks UI dirty; flushUI() syncs at top of next update()
        } else {
            setEmigrationTimer(nextEmigrationTimer);
        }
    } else { setEmigrationTimer(0); }

    const nextAutoSaveTimer = autoSaveTimer + dtSec;
    if (nextAutoSaveTimer >= AUTOSAVE_INTERVAL) {
        setAutoSaveTimer(0);
        saveGame();
        flashAutosave();
        console.log('[Pixel Dominion] AUTO-SAVING...');
    } else {
        setAutoSaveTimer(nextAutoSaveTimer);
    }

    if (incidentManager) incidentManager.update(dtSec);

    // Diplomacy timer ticks
    for (let _di = _diplomacyTimers.length - 1; _di >= 0; _di--) {
        _diplomacyTimers[_di].remainingSec -= dtSec;
        if (_diplomacyTimers[_di].remainingSec <= 0) {
            _diplomacyTimers[_di].action();
            _diplomacyTimers.splice(_di, 1);
        }
    }
    if (_allianceTimer > 0) setAllianceTimer(Math.max(0, _allianceTimer - dtSec));
    if (_soldierCostTimer > 0) {
        setSoldierCostTimer(Math.max(0, _soldierCostTimer - dtSec));
        if (_soldierCostTimer <= 0) setSoldierCostMult(1.0);
    }

    _statsUpdateTimer += dtSec;
    if (statsOverlayVisible && _statsUpdateTimer >= 0.5) { _statsUpdateTimer = 0; updateStatsOverlay(); }

    const newRadius = calcTerritoryRadius();
    if (newRadius > currentTerritoryRadius) {
        setCurrentTerritoryRadius(newRadius);
        playExpansionSFX();
        showExpansionBanner();
    } else if (newRadius < currentTerritoryRadius) {
        setCurrentTerritoryRadius(newRadius);
    }

    // Update active research timer
    updateResearch(dtSec);

    // Building the Monument is an immediate victory condition.
    // victoryAchieved guards against re-triggering the modal every frame after
    // the player chooses CONTINUE REIGN.
    if (!gameState.victoryAchieved) {
        for (const { tx, ty } of activeMonuments) {
            const s = grid.structures[ty][tx];
            if (s && (s.progress ?? 1.0) >= 1.0) {
                triggerVictory('monument');
                break;
            }
        }
    }

    // Monitor defeat condition — cannot trigger before the first raid begins
    const totalUnits = citizens.length + soldiers.length + archers.length + knights.length;
    if (totalUnits === 0 && (raidCount > 0 || raidActive)) {
        if (gameState.defeatTimer === undefined) gameState.defeatTimer = 10.0;
        gameState.defeatTimer = Math.max(0, gameState.defeatTimer - dtSec);
        
        const banner = document.getElementById('defeat-warning');
        if (banner) {
            banner.classList.remove('hidden');
            const timerEl = document.getElementById('defeat-warning-timer');
            if (timerEl) timerEl.textContent = `Defeat in ${gameState.defeatTimer.toFixed(1)}s`;
        }
        
        if (gameState.defeatTimer <= 0) {
            triggerDefeat();
        }
    } else {
        gameState.defeatTimer = 10.0;
        const banner = document.getElementById('defeat-warning');
        if (banner) banner.classList.add('hidden');
    }
}


// ===================== MAIN LOOP ORCHESTRATOR =====================
function loop(timestamp) {
    const dt = lastTime ? Math.min(timestamp - lastTime, 100) : 0;
    lastTime = timestamp;
    try {
        if (gameState.started && DEBUG_MODE) {
            frameCount++; fpsTimer += dt;
            if (fpsTimer >= 500) {
                fps = Math.round(frameCount / (fpsTimer / 1000));
                frameCount = 0; fpsTimer = 0;
                statsEl.textContent = `FPS: ${fps} | Zoom: ${camera.zoom.toFixed(2)}x | Cam: ${Math.round(camera.x)},${Math.round(camera.y)}`;
            }
        }
        update(dt);
        updateMusicTheme();
    } catch (err) {
        // A thrown frame must never kill the render loop — that would freeze the game.
        // Log at most once per second so a recurring error can't flood the console, and
        // keep going so one bad frame is recoverable and the error stays diagnosable.
        if (timestamp - _lastLoopErrorTime > 1000) {
            _lastLoopErrorTime = timestamp;
            console.error('[Pixel Dominion] Frame error (loop continues):', err);
        }
    }
    try {
        render();
    } catch (err) {
        if (timestamp - _lastLoopErrorTime > 1000) {
            _lastLoopErrorTime = timestamp;
            console.error('[Pixel Dominion] Render error (loop continues):', err);
        }
    }
    requestAnimationFrame(loop);
}


// ===================== START SCREEN & EVENT LISTENERS =====================
// --- Leaderboard toggle on start screen ---
document.getElementById('btn-leaderboard-toggle').addEventListener('click', () => {
    const container = document.getElementById('start-leaderboard-container');
    const btn = document.getElementById('btn-leaderboard-toggle');
    if (container.classList.toggle('hidden')) {
        btn.textContent = '⚑ HIGH SCORES';
    } else {
        btn.textContent = '⚑ HIDE SCORES';
        updateLeaderboardDisplays();
    }
});

// --- Start button ---
const DIFFICULTY_ORDER = ['settler', 'lord', 'iron_crown'];
const DIFFICULTY_TAGS = {
    settler: 'A forgiving start to your reign',
    lord: 'A fair test of rule and survival',
    iron_crown: 'Only the strongest kingdoms endure',
};
let selectedDifficultyKey = DEFAULT_DIFFICULTY_KEY;

function renderDifficultyOptions() {
    const optionsEl = document.getElementById('difficulty-options');
    if (!optionsEl) return;
    const lordPreset = getDifficultyPreset('lord');
    optionsEl.innerHTML = DIFFICULTY_ORDER.map(key => {
        const preset = getDifficultyPreset(key);
        // Concrete deltas so the choice isn't flavor-text only
        const last = preset.raidStrengths.length - 1;
        const raidPct = Math.round((preset.raidStrengths[last] / lordPreset.raidStrengths[last]) * 100);
        return `<button type="button" class="difficulty-card${key === selectedDifficultyKey ? ' active' : ''}" data-difficulty="${key}">
            <div class="difficulty-card-name">${preset.label}</div>
            <div class="difficulty-card-tag">${DIFFICULTY_TAGS[key] || ''}</div>
            <div class="difficulty-card-tag" style="opacity:0.75;font-size:0.85em;margin-top:2px;">Raids ${raidPct}% · Monument ${preset.monumentCost.gold}G</div>
        </button>`;
    }).join('');
    optionsEl.querySelectorAll('.difficulty-card').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDifficultyKey = btn.dataset.difficulty || DEFAULT_DIFFICULTY_KEY;
            applyDifficultyConfig(selectedDifficultyKey, { syncRaidStrength: true, refresh: false });
            renderDifficultyOptions();
        });
    });
}

applyDifficultyConfig(selectedDifficultyKey, { syncRaidStrength: true, refresh: false });
renderDifficultyOptions();

document.getElementById('btn-start').addEventListener('click', () => {
    applyDifficultyConfig(selectedDifficultyKey, { syncRaidStrength: true, refresh: false });
    initAudio(); // initialize AudioContext from user gesture (browser autoplay policy)
    document.getElementById('start-screen').style.display = 'none';
    gameState.started = true;
    setGameIsPaused(false);
    setUserPaused(false);
    setTimeScale(1);
    if (window.updateTimePauseUI) window.updateTimePauseUI();
    lastTime = 0;
    showTutorial(); // Show tutorial on game start
});

// --- Milestone 20 Event Listeners ---
const closeResearchBtn = document.getElementById('btn-research-close');
if (closeResearchBtn) {
    closeResearchBtn.addEventListener('click', () => {
        closeResearchModal();
    });
}

const submitScoreBtn = document.getElementById('leaderboard-submit-btn');
if (submitScoreBtn) {
    submitScoreBtn.addEventListener('click', () => {
        const input = document.getElementById('leaderboard-name-input');
        let name = input ? input.value.trim() : "";
        if (!name) {
            name = (input && input.placeholder) ? input.placeholder : "King/Queen " + Math.floor(Math.random() * 8999 + 1000);
        }
        const finalScore = calculateCurrentScore();
        const days = gameState.day || 1;
        const raidersCount = gameState.raidersDefeated || 0;
        const gold = gameState.gold || 0;
        addHighScoreEntry(name, finalScore, days, raidersCount, gold);
        const entryPanel = document.getElementById('leaderboard-entry-panel');
        if (entryPanel) entryPanel.classList.add('hidden');
    });
}

const gameOverRestartBtn = document.getElementById('game-over-restart');
if (gameOverRestartBtn) {
    gameOverRestartBtn.addEventListener('click', () => {
        resetGame();
    });
}

// Endless mode: keep playing after victory — raids continue and keep scaling.
const gameOverContinueBtn = document.getElementById('game-over-continue');
if (gameOverContinueBtn) {
    gameOverContinueBtn.addEventListener('click', () => {
        gameState.endless = true;
        document.getElementById('game-over-modal').classList.remove('open');
        setGameIsPaused(false);
        if (raidTimer <= 0) setRaidTimer(RAID_DURATION);
        showEventBanner('ENDLESS REIGN', 'The raids will keep coming, ever stronger. Hold the line!');
        updateRaidHUD();
    });
}

// Combat mode button handlers
const _btnDefend = document.getElementById('btn-defend-mode');
const _btnAttack = document.getElementById('btn-attack-mode');
function applyCombatMode(mode) {
    setCombatMode(mode);
    if (mode === 'defend') {
        for (const s of soldiers) {
            s.state = 'idle';
            s._idleTimer = s._idleWait ?? 0;
            s._chasePath = [];
            s._chaseIndex = 0;
            s._chaseTarget = null;
            s._path = [];
            s._pathIndex = 0;
        }
        for (const a of archers) { if (a.state === 'following') a.state = 'seeking_post'; }
        for (const k of knights) {
            k.state = 'idle';
            k._idleTimer = k._idleWait ?? 0;
            k._chasePath = [];
            k._chaseIndex = 0;
            k._chaseTarget = null;
            k._path = [];
            k._pathIndex = 0;
        }
    } else {
        for (const a of archers) {
            if (a.state !== 'following') { a._postTX = -1; a._postTY = -1; a.state = 'following'; }
        }
        for (const k of knights) {
            if (k.state !== 'following') { k._postTX = -1; k._postTY = -1; k.state = 'following'; }
        }
    }
    updateCombatModeUI();
}
if (_btnDefend) {
    _btnDefend.addEventListener('click', () => {
        applyCombatMode('defend');
    });
}
if (_btnAttack) {
    _btnAttack.addEventListener('click', () => {
        applyCombatMode('attack');
    });
}

// Building panel — close button and click-outside
(function() {
    const panel = document.getElementById('building-panel');
    const closeBtn = document.getElementById('building-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', () => closeBuildingPanel());
    if (panel) panel.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', e => {
        if (_buildingPanelOpen) {
            const panel2 = document.getElementById('building-panel');
            if (panel2 && !panel2.contains(e.target)) closeBuildingPanel();
        }
    });
})();

// Happiness tooltip — show active factors on hover
(function() {
    const chip = document.getElementById('res-happiness')?.closest('.res-chip');
    const tooltip = document.getElementById('happiness-tooltip');
    if (!chip || !tooltip) return;
    chip.style.position = 'relative';
    chip.addEventListener('mouseenter', () => {
        const rows = _happinessFactors.length
            ? _happinessFactors.map(f =>
                `<div class="ht-row"><span class="ht-label">${f.label}</span><span class="ht-signs ${f.polarity}">${f.signs}</span></div>`
              ).join('')
            : '<div class="ht-row"><span class="ht-label">No active modifiers</span></div>';
        tooltip.innerHTML = rows;
        tooltip.style.display = 'block';
    });
    chip.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
})();

function setTutorialPage(pageNum) {
    const page1 = document.getElementById('tutorial-page-1');
    const page2 = document.getElementById('tutorial-page-2');
    const nextBtn = document.getElementById('tutorial-next');
    const dismissBtn = document.getElementById('tutorial-dismiss');
    if (page1) page1.classList.toggle('hidden', pageNum !== 1);
    if (page2) page2.classList.toggle('hidden', pageNum !== 2);
    if (nextBtn) nextBtn.classList.toggle('hidden', pageNum !== 1);
    if (dismissBtn) dismissBtn.classList.toggle('hidden', pageNum !== 2);
}

document.getElementById('tutorial-next')?.addEventListener('click', () => {
    setTutorialPage(2);
});

document.getElementById('tutorial-dismiss')?.addEventListener('click', () => {
    const tutorial = document.getElementById('tutorial-overlay');
    if (tutorial) tutorial.classList.add('hidden');
});

function showTutorial() {
    const tutorial = document.getElementById('tutorial-overlay');
    if (tutorial) {
        setTutorialPage(1);
        tutorial.classList.remove('hidden');
    }
}

async function init() {
    const g = new GameGrid();
    setGridAndCamera(g);

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.imageSmoothingEnabled = false;
    }
    window.addEventListener('resize', resize);
    resize();

    const loader = new AssetLoader();
    window.assets = await loader.loadAll();
    _buildGrassCache();

    setIncidentManager(new IncidentManager());

    // Initialize snow particles once (always maintained, only drawn in Winter)
    const snow = [];
    for (let i = 0; i < 80; i++) {
        snow.push({
            x:       Math.random() * canvas.width,
            y:       Math.random() * canvas.height,
            speed:   0.4 + Math.random() * 0.8,
            drift:   (Math.random() - 0.5) * 0.6,
            radius:  1 + Math.random(),
            opacity: 0.4 + Math.random() * 0.5,
        });
    }
    setSnowParticles(snow);

    // Spawn 2 starter citizens for forgiving early game
    for (let i = 0; i < 2; i++) {
        const spawnX = (grid.width / 2) * TILE_SIZE + (Math.random() - 0.5) * 64;
        const spawnY = (grid.height / 2) * TILE_SIZE + (Math.random() - 0.5) * 64;
        citizens.push(new Citizen(spawnX, spawnY));
        gameState.population++;
    }

    // Center camera on the world
    camera.x = Math.max(0, (grid.width  * TILE_SIZE) / 2 - canvas.width  / 2);
    camera.y = Math.max(0, (grid.height * TILE_SIZE) / 2 - canvas.height / 2);

    setCurrentTerritoryRadius(calcTerritoryRadius());

    rebuildStructureLists();
    _buildStaticCache();
    renderBuildMenu('all');
    updateCombatModeUI();
    updateDaySeason();
    _updateDayPhaseGlyph();
    updateLeaderboardDisplays();
    refreshUI();
    updateRaidHUD();
    render(); // draw world behind start screen

    document.getElementById('start-screen').style.display = 'flex';
    window.__initDone = true; // signals harnesses that boot is fully complete
    requestAnimationFrame(loop);
}

_loadSettings(); // restore volume/mute state before audio context is created
init();


// Bind main functions to window for console diagnostics and input.js access
Object.assign(window, {
    handleGridClick,
    spawnCitizen, trainSoldier, updateSoldiers, trainArcher, updateArchers,
    trainKnight, updateKnights, updateGates, killRaider, fireArrow, fireBolt,
    updateActiveProjectiles, _startFireAtTile, _getRaiderType, getRaidWaveSize,
    getScaledWaveSize, showTutorial,
    chooseRaidDirections, getSpawnPos, sendCitizensToHide, startRaidWave,
    updateRaiders, updateEffects, resolveRaid, assignCitizenJobs, update, loop,
    getCitizenMovementDebug: () => citizens.reduce((summary, c) => {
        summary.total++;
        summary.states[c.state] = (summary.states[c.state] || 0) + 1;
        summary.jobs[c.job] = (summary.jobs[c.job] || 0) + 1;
        if (c.state === 'walking') summary.walking++;
        if (c._visualMoving) summary.visuallyMoving++;
        return summary;
    }, { total: 0, walking: 0, visuallyMoving: 0, states: {}, jobs: {} }),
    getSimulationDebug: () => ({
        started: gameState.started,
        gameIsPaused,
        userPaused,
        simRunning: gameState.started && !gameIsPaused && !userPaused,
        timeScale,
        housing: gameState.housing,
        population: gameState.population,
        citizens: citizens.length,
        food: gameState.food,
        farms: activeFarms.length,
        houses: activeHouses.length,
        spawnTimer,
        passiveFarmTimer,
        spawnInterval: getSpawnInterval(),
    })
});
