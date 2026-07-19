// Pixel Dominion — Entity Classes Module

// Helper for units clamping
function _clampToTerritory(u) {
    if (u._assaulting) return; // camp assaults range beyond the border
    const cx = 32.5 * TILE_SIZE, cy = 32.5 * TILE_SIZE;
    const maxR = (currentTerritoryRadius + 1) * TILE_SIZE;
    const dx = u.x - cx, dy = u.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { u.x = cx + dx / dist * maxR; u.y = cy + dy / dist * maxR; }
}

function _isInTerritory(tx, ty, pad = 1) {
    return Math.hypot(tx - 32, ty - 32) <= currentTerritoryRadius + pad;
}

function _getNearestOpenNeighbor(tx, ty, walkableFn = isFriendlyWalkable) {
    let best = null;
    let bestDist = Infinity;
    for (const { dx, dy } of [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!walkableFn(nx, ny)) continue;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < bestDist) {
            bestDist = dist;
            best = { tx: nx, ty: ny };
        }
    }
    return best;
}

function _getDefendRallyTile() {
    const centerTX = 32;
    const centerTY = 32;
    if ((activeWalls.length + activeGates.length) > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const { tx, ty } of [...activeWalls, ...activeGates]) {
            minX = Math.min(minX, tx); minY = Math.min(minY, ty);
            maxX = Math.max(maxX, tx); maxY = Math.max(maxY, ty);
        }
        const bx = Math.round((minX + maxX) / 2);
        const by = Math.round((minY + maxY) / 2);
        if (isFriendlyWalkable(bx, by)) return { tx: bx, ty: by };
        for (let radius = 1; radius <= Math.max(2, Math.max(maxX - minX, maxY - minY)); radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const tx = bx + dx;
                    const ty = by + dy;
                    if (tx <= minX || tx >= maxX || ty <= minY || ty >= maxY) continue;
                    if (_isInTerritory(tx, ty, 1) && isFriendlyWalkable(tx, ty)) return { tx, ty };
                }
            }
        }
    }
    if (isFriendlyWalkable(centerTX, centerTY)) return { tx: centerTX, ty: centerTY };
    for (let radius = 1; radius <= Math.max(2, currentTerritoryRadius + 1); radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = centerTX + dx;
                const ty = centerTY + dy;
                if (!_isInTerritory(tx, ty, 1) || !isFriendlyWalkable(tx, ty)) continue;
                return { tx, ty };
            }
        }
    }
    return null;
}

function _findProtectedWallPost(unit, activeRaiders) {
    const walls = [...activeWalls, ...activeGates];
    if (walls.length === 0) return null;
    const ux = Math.floor(unit.x / TILE_SIZE);
    const uy = Math.floor(unit.y / TILE_SIZE);
    let nearestRaiderTX = -1;
    let nearestRaiderTY = -1;
    let nearestRaider = null;
    let bestRaiderDist = Infinity;
    for (const r of activeRaiders) {
        const rtx = Math.floor(r.x / TILE_SIZE);
        const rty = Math.floor(r.y / TILE_SIZE);
        const dx = rtx - ux;
        const dy = rty - uy;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestRaiderDist) {
            bestRaiderDist = dSq;
            nearestRaider = r;
            nearestRaiderTX = rtx;
            nearestRaiderTY = rty;
        }
    }
    let best = null;
    let bestScore = Infinity;
    for (const { tx, ty } of walls) {
        let wallRaiderDist = 0;
        if (nearestRaider) {
            const wdx = tx - nearestRaiderTX;
            const wdy = ty - nearestRaiderTY;
            wallRaiderDist = wdx * wdx + wdy * wdy;
        }
        for (const { dx, dy } of [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]) {
            const standTX = tx + dx;
            const standTY = ty + dy;
            if (!isFriendlyWalkable(standTX, standTY) || !_isInTerritory(standTX, standTY, 0)) continue;
            let protectionPenalty = 0;
            let raiderScore = 0;
            if (nearestRaider) {
                const sdx = standTX - nearestRaiderTX;
                const sdy = standTY - nearestRaiderTY;
                raiderScore = (tx - nearestRaiderTX) * (tx - nearestRaiderTX) + (ty - nearestRaiderTY) * (ty - nearestRaiderTY);
                const standRaiderDist = sdx * sdx + sdy * sdy;
                if (standRaiderDist <= wallRaiderDist) protectionPenalty = 100000;
            }
            const selfDX = standTX - ux;
            const selfDY = standTY - uy;
            const postKey = tx + ',' + ty;
            const postCount = _archerDefenseContext.postCounts.get(postKey) || 0;
            const score = protectionPenalty + raiderScore * 1000 + selfDX * selfDX + selfDY * selfDY + postCount * 50000;
            if (score < bestScore) {
                bestScore = score;
                best = { tx, ty, standTX, standTY };
            }
        }
    }
    return best;
}

function _assignUnitPath(unit, path, grid, speed, stateName) {
    unit._path = path;
    unit._pathIndex = 0;
    unit._pathState = stateName;
    if (path && path.length > 0) {
        _stepUnitPath(unit, grid, speed, stateName);
    }
}

function _stepUnitPath(unit, grid, speed, stateName) {
    if (!unit._path || unit._pathIndex >= unit._path.length) {
        unit.state = 'idle';
        unit._pathState = null;
        return false;
    }
    const wp = unit._path[unit._pathIndex++];
    const tx = wp % GRID_WIDTH;
    const ty = (wp / GRID_WIDTH) | 0;
    unit.targetX = tx * TILE_SIZE + TILE_SIZE / 2;
    unit.targetY = ty * TILE_SIZE + TILE_SIZE / 2;
    unit._moveFromX = unit.x;
    unit._moveFromY = unit.y;
    unit._moveTimer = 0;
    const tile = grid.inBounds(tx, ty) ? grid.tiles[ty][tx] : 'tile_grass';
    unit.speed = tile === 'tile_road' ? 0.75 : speed;
    unit.state = stateName;
    return true;
}

function _moveUnitAlongPath(unit, dtSec, grid, speed, idleWaitMin = 0.5, idleWaitMax = 1.5) {
    unit._moveTimer += dtSec;
    const t = Math.min(1.0, unit._moveTimer / unit.speed);
    unit.x = unit._moveFromX + (unit.targetX - unit._moveFromX) * t;
    unit.y = unit._moveFromY + (unit.targetY - unit._moveFromY) * t;
    if (t < 1.0) return;
    unit.x = unit.targetX;
    unit.y = unit.targetY;
    if (_stepUnitPath(unit, grid, speed, unit.state)) return;
    unit.state = 'idle';
    unit._pathState = null;
    unit._idleTimer = 0;
    unit._idleWait = idleWaitMin + Math.random() * (idleWaitMax - idleWaitMin);
}

const _archerDefenseContext = {
    postCounts: new Map(),
};

const TWO_PI = Math.PI * 2;

// ===================== MELEE ENGAGEMENT HELPERS =====================
// Per-frame count of melee attackers per raider (cleared from main.js's update
// loop). Soldiers/knights prefer the nearest raider that isn't already piled on.
const _combatTargetCounts = new Map();

const _leashScratch = [];
// Defend mode: only raiders within COMBAT_BALANCE.defendLeashTiles of the rally
// point are engaged, so the army holds the walls instead of scattering across
// the map after every raider. Attack mode (and no-rally towns) engage anything.
function _selectEngageableRaiders(activeRaiders) {
    if (_combatMode !== 'defend' || activeRaiders.length === 0) return activeRaiders;
    const rally = window._defendRally;
    if (!rally) return activeRaiders;
    const CB = window.COMBAT_BALANCE;
    const leash = (CB?.defendLeashTiles ?? 10) * TILE_SIZE;
    const leashSq = leash * leash;
    const rx = rally.tx * TILE_SIZE + TILE_SIZE / 2;
    const ry = rally.ty * TILE_SIZE + TILE_SIZE / 2;
    _leashScratch.length = 0;
    for (const r of activeRaiders) {
        const dx = r.x - rx, dy = r.y - ry;
        if (dx * dx + dy * dy <= leashSq) _leashScratch.push(r);
    }
    return _leashScratch;
}

// ATTACK mode with no raiders to fight: march on the nearest raider camp.
// Reuses the unit's chase-path fields; damage exchange happens in main.js's
// updateCampAssault once the unit is in range.
function _marchOnCamp(unit, dtSec, grid, speedTiles) {
    const camps = window.raiderCamps;
    let camp = null, bestSq = Infinity;
    for (const c of camps) {
        const dx = c.x - unit.x, dy = c.y - unit.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestSq) { bestSq = dSq; camp = c; }
    }
    if (!camp) return;
    // Face the camp (used by the render-side sprite flip)
    unit.targetX = camp.x;
    unit.targetY = camp.y;
    const dist = Math.sqrt(bestSq);
    if (dist <= TILE_SIZE * 1.5) {
        applySeparation(unit, dtSec, isFriendlyWalkable);
        return; // in melee range — updateCampAssault deals the damage
    }
    unit._campRepathTimer = (unit._campRepathTimer ?? 99) + dtSec;
    if (unit._campRepathTimer >= 2.0 || unit._chaseIndex >= unit._chasePath.length) {
        unit._campRepathTimer = 0;
        const sx = Math.floor(unit.x / TILE_SIZE), sy = Math.floor(unit.y / TILE_SIZE);
        const p = aStarPath(sx, sy, Math.floor(camp.x / TILE_SIZE), Math.floor(camp.y / TILE_SIZE), isFriendlyWalkable);
        unit._chasePath = (p && p.length > 0) ? p : [];
        unit._chaseIndex = 0;
    }
    const spd = TILE_SIZE * speedTiles * dtSec;
    if (unit._chaseIndex < unit._chasePath.length) {
        const wp = unit._chasePath[unit._chaseIndex];
        const tx = wp % GRID_WIDTH;
        const ty = (wp / GRID_WIDTH) | 0;
        const wpX = tx * TILE_SIZE + TILE_SIZE / 2, wpY = ty * TILE_SIZE + TILE_SIZE / 2;
        const d = Math.hypot(wpX - unit.x, wpY - unit.y);
        if (d <= spd) { unit.x = wpX; unit.y = wpY; unit._chaseIndex++; }
        else { unit.x += (wpX - unit.x) / d * spd; unit.y += (wpY - unit.y) / d * spd; }
    } else {
        // Open ground fallback — straight-line march
        const d = dist || 1;
        unit.x += (camp.x - unit.x) / d * spd;
        unit.y += (camp.y - unit.y) / d * spd;
    }
    applySeparation(unit, dtSec, isFriendlyWalkable);
}

// Nearest raider with fewer than maxMeleeAttackersPerTarget attackers; falls
// back to the plain nearest when everything is saturated.
function _pickMeleeTarget(unit, candidates) {
    const cap = window.COMBAT_BALANCE?.maxMeleeAttackersPerTarget ?? 3;
    let bestUnder = null, bestUnderSq = Infinity;
    let bestAny = null, bestAnySq = Infinity;
    for (const r of candidates) {
        const dx = r.x - unit.x, dy = r.y - unit.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestAnySq) { bestAny = r; bestAnySq = dSq; }
        if (dSq < bestUnderSq && (_combatTargetCounts.get(r) || 0) < cap) { bestUnder = r; bestUnderSq = dSq; }
    }
    const chosen = bestUnder ?? bestAny;
    if (chosen) _combatTargetCounts.set(chosen, (_combatTargetCounts.get(chosen) || 0) + 1);
    return chosen;
}

// ===================== SEPARATION (ANTI-STACKING) =====================
// Units walk to exact tile centers, so several of them converging on the same
// farm/rally point/gate stack into a single visible sprite. A full pairwise
// check across every unit is O(n²); instead we bucket all units into a coarse
// spatial hash once per frame (rebuildSeparationGrid, called from main.js's
// update loop) and each unit only tests its own + 8 neighboring cells.
const SEPARATION_CELL = 24;   // px per bucket — a bit larger than the push radius
const SEPARATION_RADIUS = 11; // px — units nearer than this get nudged apart
const SEPARATION_RADIUS_SQ = SEPARATION_RADIUS * SEPARATION_RADIUS;
const _sepBuckets = new Map();

function rebuildSeparationGrid() {
    _sepBuckets.clear();
    for (const list of [citizens, soldiers, archers, knights, raiders]) {
        for (const u of list) {
            if (u.state === 'dead' || u.state === 'victory' || u.state === 'defeat') continue;
            const key = (u.x / SEPARATION_CELL | 0) + ',' + (u.y / SEPARATION_CELL | 0);
            let bucket = _sepBuckets.get(key);
            if (!bucket) { bucket = []; _sepBuckets.set(key, bucket); }
            bucket.push(u);
        }
    }
}

// Nudges `unit` away from anything within SEPARATION_RADIUS, then rejects the
// nudge if it would land on a non-walkable tile (wall/obstacle/off-territory)
// so units never get pushed through terrain to de-stack.
function applySeparation(unit, dtSec, walkableFn = isFriendlyWalkable, pushStrength = 46) {
    const cx = unit.x / SEPARATION_CELL | 0;
    const cy = unit.y / SEPARATION_CELL | 0;
    let pushX = 0, pushY = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const bucket = _sepBuckets.get((cx + dx) + ',' + (cy + dy));
            if (!bucket) continue;
            for (let i = 0; i < bucket.length; i++) {
                const other = bucket[i];
                if (other === unit) continue;
                const ox = unit.x - other.x, oy = unit.y - other.y;
                const dSq = ox * ox + oy * oy;
                if (dSq >= SEPARATION_RADIUS_SQ) continue;
                if (dSq < 0.01) {
                    // Exact overlap (the original stacking bug — units share x,y
                    // pixel-for-pixel). A position-derived angle would collapse to
                    // the SAME value for every unit in the pile since they're all
                    // at the same position, so the whole stack would drift together
                    // forever instead of separating. Use a stable per-instance
                    // random seed instead — every unit gets its own fixed nudge
                    // direction the moment it first needs one.
                    const a = unit._sepSeed ?? (unit._sepSeed = Math.random() * TWO_PI);
                    pushX += Math.cos(a); pushY += Math.sin(a);
                    continue;
                }
                const d = Math.sqrt(dSq);
                const overlap = (SEPARATION_RADIUS - d) / SEPARATION_RADIUS;
                pushX += (ox / d) * overlap;
                pushY += (oy / d) * overlap;
            }
        }
    }
    if (pushX === 0 && pushY === 0) return;
    const nx = unit.x + pushX * pushStrength * dtSec;
    const ny = unit.y + pushY * pushStrength * dtSec;
    if (walkableFn(nx / TILE_SIZE | 0, ny / TILE_SIZE | 0)) {
        unit.x = nx;
        unit.y = ny;
    }
}

// ===================== CITIZENS =====================
export class Citizen {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.speed = 1.5;
        this.state = 'idle';
        this._idleTimer = 0;
        this._idleWait = this._randomIdleWait();
        this._ambientTimer = 0;
        this._ambientWait = this._randomAmbientWait();
        this._visualX = 0;
        this._visualY = 0;
        this._visualTargetX = 0;
        this._visualTargetY = 0;
        this._visualTimer = Math.random() * 0.8;
        this._visualWait = this._randomVisualWait();
        this._visualMoving = false;
        this._moveTimer = 0;
        this._moveFromX = x;
        this._moveFromY = y;
        this._path = [];
        this._pathIndex = 0;
        this.job = 'idle';
        this._phase = 'idle';
        this._phaseTimer = 0;
        this._workTX = -1;
        this._workTY = -1;
        this._nodeTX = -1;
        this._nodeTY = -1;
        this._alive = true;
    }

    _randomIdleWait() { return 1.0 + Math.random() * 2.0; }
    _randomAmbientWait() { return 0.55 + Math.random() * 1.1; }
    _randomVisualWait() { return 0.35 + Math.random() * 0.65; }

    _updateVisualMotion(dtSec) {
        if (this.state === 'walking') {
            this._visualX = 0;
            this._visualY = 0;
            this._visualTargetX = 0;
            this._visualTargetY = 0;
            this._visualMoving = true;
            return;
        }
        if (this.job === 'hiding' && this._phase === 'hidden') {
            this._visualMoving = false;
            return;
        }
        this._visualTimer = (this._visualTimer ?? 0) + dtSec;
        if (this._visualTimer >= (this._visualWait ?? this._randomVisualWait())) {
            this._visualTimer = 0;
            this._visualWait = this._randomVisualWait();
            const maxOffset = this.job === 'idle' ? 9 : 6;
            this._visualTargetX = (Math.random() - 0.5) * maxOffset * 2;
            this._visualTargetY = (Math.random() - 0.5) * maxOffset * 2;
        }
        const follow = Math.min(1, dtSec * 4.5);
        this._visualX = (this._visualX ?? 0) + ((this._visualTargetX ?? 0) - (this._visualX ?? 0)) * follow;
        this._visualY = (this._visualY ?? 0) + ((this._visualTargetY ?? 0) - (this._visualY ?? 0)) * follow;
        this._visualMoving = Math.hypot(this._visualX ?? 0, this._visualY ?? 0) > 0.5;
    }

    renderX() { return this.x + (this._visualX ?? 0); }
    renderY() { return this.y + (this._visualY ?? 0); }

    _pickTarget(grid) {
        const curTX = Math.floor(this.x / TILE_SIZE);
        const curTY = Math.floor(this.y / TILE_SIZE);
        const dirs = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 1, dy: -1 }, { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
        ];
        for (let i = dirs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }
        for (const { dx, dy } of dirs) {
            const nx = curTX + dx;
            const ny = curTY + dy;
            if (!isFriendlyWalkable(nx, ny)) continue;
            this.targetX = nx * TILE_SIZE + TILE_SIZE / 2;
            this.targetY = ny * TILE_SIZE + TILE_SIZE / 2;
            this._moveFromX = this.x;
            this._moveFromY = this.y;
            this._moveTimer = 0;
            this._path = [];
            this._pathIndex = 0;
            const tileType = grid.tiles[ny][nx];
            this.speed = tileType === 'tile_road' ? 0.75 : 1.5;
            this.state = 'walking';
            return;
        }
    }

    _navigateTo(tx, ty, grid) {
        const sx = Math.floor(this.x / TILE_SIZE);
        const sy = Math.floor(this.y / TILE_SIZE);
        let dstTX = tx, dstTY = ty;
        if (!isFriendlyWalkable(tx, ty)) {
            let found = false;
            for (const { dx, dy } of [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]) {
                if (isFriendlyWalkable(tx + dx, ty + dy)) { dstTX = tx + dx; dstTY = ty + dy; found = true; break; }
            }
            if (!found) { this.state = 'idle'; return; }
        }
        if (sx === dstTX && sy === dstTY) { this._path = []; this._pathIndex = 0; this.state = 'idle'; return; }
        const path = aStarPath(sx, sy, dstTX, dstTY, isFriendlyWalkable);
        if (path && path.length > 0) {
            this._path = path;
            this._pathIndex = 0;
            this._advancePath(grid);
        } else if (path !== false) {
            this._path = [];
            this._pathIndex = 0;
            this.state = 'idle';
        }
    }

    _advancePath(grid) {
        if (!this._path || this._pathIndex >= this._path.length) {
            this.state = 'idle';
            this._idleTimer = 0;
            this._idleWait = this._randomIdleWait();
            return;
        }
        const wpKey = this._path[this._pathIndex++];
        const tx = wpKey % GRID_WIDTH;
        const ty = (wpKey / GRID_WIDTH) | 0;
        this.targetX = tx * TILE_SIZE + TILE_SIZE / 2;
        this.targetY = ty * TILE_SIZE + TILE_SIZE / 2;
        this._moveFromX = this.x;
        this._moveFromY = this.y;
        this._moveTimer = 0;
        const tile = grid.inBounds(tx, ty) ? grid.tiles[ty][tx] : 'tile_grass';
        this.speed = tile === 'tile_road' ? 0.75 : 1.5;
        this.state = 'walking';
    }

    _setTargetTile(tx, ty, grid) {
        this._navigateTo(tx, ty, grid);
    }

    _directWalkToTile(tx, ty, grid) {
        if (!grid.inBounds(tx, ty) || !isFriendlyWalkable(tx, ty)) return false;
        const curTX = Math.floor(this.x / TILE_SIZE);
        const curTY = Math.floor(this.y / TILE_SIZE);
        if (curTX === tx && curTY === ty) return false;
        this.targetX = tx * TILE_SIZE + TILE_SIZE / 2;
        this.targetY = ty * TILE_SIZE + TILE_SIZE / 2;
        this._moveFromX = this.x;
        this._moveFromY = this.y;
        this._moveTimer = 0;
        this._path = [];
        this._pathIndex = 0;
        const tileType = grid.tiles[ty][tx];
        this.speed = tileType === 'tile_road' ? 0.75 : 1.5;
        this.state = 'walking';
        return true;
    }

    _tryAmbientWalk(grid, anchorTX = -1, anchorTY = -1, radius = 2) {
        const curTX = Math.floor(this.x / TILE_SIZE);
        const curTY = Math.floor(this.y / TILE_SIZE);
        const candidates = [];
        const dirs = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 1, dy: -1 }, { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
        ];
        for (const { dx, dy } of dirs) {
            const tx = curTX + dx;
            const ty = curTY + dy;
            if (!grid.inBounds(tx, ty) || !isFriendlyWalkable(tx, ty)) continue;
            if (dx !== 0 && dy !== 0 &&
                (!isFriendlyWalkable(curTX + dx, curTY) ||
                 !isFriendlyWalkable(curTX, curTY + dy))) continue;
            if (anchorTX >= 0 && anchorTY >= 0) {
                const distFromAnchor = Math.max(Math.abs(tx - anchorTX), Math.abs(ty - anchorTY));
                if (distFromAnchor > radius) continue;
            }
            candidates.push({ tx, ty });
        }
        if (!candidates.length) return false;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return this._directWalkToTile(pick.tx, pick.ty, grid);
    }

    _tickAmbientWalk(dtSec, grid, anchorTX = -1, anchorTY = -1, radius = 2) {
        this._ambientTimer = (this._ambientTimer ?? 0) + dtSec;
        if (this._ambientTimer < (this._ambientWait ?? this._randomAmbientWait())) return false;
        this._ambientTimer = 0;
        this._ambientWait = this._randomAmbientWait();
        return this._tryAmbientWalk(grid, anchorTX, anchorTY, radius);
    }

    _wanderNearWorkplace(grid, radius = 2) {
        if (this._workTX < 0 || this._workTY < 0) return false;
        return this._tryAmbientWalk(grid, this._workTX, this._workTY, radius);
    }

    _isAtTile(tx, ty) {
        if (Math.hypot(this.x - (tx * TILE_SIZE + TILE_SIZE / 2),
                       this.y - (ty * TILE_SIZE + TILE_SIZE / 2)) < 4) return true;
        if (!isFriendlyWalkable(tx, ty)) {
            const cx = Math.floor(this.x / TILE_SIZE);
            const cy = Math.floor(this.y / TILE_SIZE);
            return (cx === tx && Math.abs(cy - ty) === 1) || (cy === ty && Math.abs(cx - tx) === 1);
        }
        return false;
    }

    // dtSec is SECONDS — same convention as Soldier/Archer/Knight/Raider.update.
    update(dtSec, grid) {
        this._updateVisualMotion(dtSec);
        // Hiding citizens are intentionally clustered inside a house during a
        // raid — leave them stacked rather than nudging them into view.
        const canSeparate = this.job !== 'hiding';
        if (this.state === 'walking') {
            this._moveTimer += dtSec;
            const _sm = SEASON_MODIFIERS[SEASONS.indexOf(gameState.season)];
            const t = Math.min(1.0, this._moveTimer / (this.speed / _sm.citizenSpeedMult));
            this.x = this._moveFromX + (this.targetX - this._moveFromX) * t;
            this.y = this._moveFromY + (this.targetY - this._moveFromY) * t;
            if (t >= 1.0) {
                this.x = this.targetX;
                this.y = this.targetY;
                this._advancePath(grid); // next waypoint or become idle
            }
            if (canSeparate) applySeparation(this, dtSec, isFriendlyWalkable);
            return;
        }
        if (this.job !== 'idle') {
            this._updateJob(dtSec, grid);
            if (canSeparate) applySeparation(this, dtSec, isFriendlyWalkable);
            return;
        }
        this._idleTimer += dtSec;
        if (this._idleTimer >= this._idleWait) {
            this._idleTimer = 0;
            this._idleWait = this._randomIdleWait();
            if (!this._tryAmbientWalk(grid)) this._pickTarget(grid);
        }
        if (canSeparate) applySeparation(this, dtSec, isFriendlyWalkable);
    }

    _updateJob(dtSec, grid) {
        // Hiding overrides all other jobs
        if (this.job === 'hiding') {
            if (this._phase === 'go_hide' && this._workTX !== -1) {
                if (this._isAtTile(this._workTX, this._workTY)) {
                    this._phase = 'hidden';
                } else if (this.state !== 'walking') {
                    this._setTargetTile(this._workTX, this._workTY, grid);
                }
            }
            return;
        }
        // Strike: resource workers stand idle
        if (strikeActive && (this.job === 'farmer' || this.job === 'woodcutter' || this.job === 'stone_miner' || this.job === 'iron_miner')) return;
        if (this.job !== 'builder' && this.job !== 'rebel') {
            const ws = grid.structures[this._workTY]?.[this._workTX];
            const expectedJob = ws ? {
                farm: 'farmer',
                lumberyard: 'woodcutter',
                quarry: 'stone_miner',
                mine: 'iron_miner',
            }[ws.def.key] : null;
            if (!ws || expectedJob !== this.job) {
                this.job = 'idle';
                this._phase = 'idle';
                this._workTX = -1;
                this._workTY = -1;
                this._nodeTX = -1;
                this._nodeTY = -1;
                return;
            }
        }
        switch (this.job) {
            case 'farmer':      this._updateFarmer(dtSec, grid); break;
            case 'woodcutter':  this._updateWoodcutter(dtSec, grid); break;
            case 'stone_miner': this._updateMiner(dtSec, grid, 'stone_deposit', 'stone', 'quarry'); break;
            case 'iron_miner':  this._updateMiner(dtSec, grid, 'iron_vein', 'iron', 'mine'); break;
            case 'builder':     this._updateBuilder(dtSec, grid); break;
            case 'rebel':       this._updateRebel(dtSec, grid); break;
        }
    }

    _updateFarmer(dtSec, grid) {
        if (this._phase === 'go_work') {
            if (this._isAtTile(this._workTX, this._workTY)) {
                this._phase = 'farming'; this._phaseTimer = 0;
            } else {
                this._setTargetTile(this._workTX, this._workTY, grid);
            }
        } else if (this._phase === 'farming') {
            this._phaseTimer += dtSec;
            this._tickAmbientWalk(dtSec, grid, this._workTX, this._workTY, 2);
            if (this._phaseTimer >= 2.0) {
                if (!droughtActive) {
                    const farmKey = `${this._workTX},${this._workTY}`;
                    const farmBaseFood = window.PRODUCTION_BALANCE?.farmBaseFoodPerCycle ?? 6;
                    let foodBonus = farmBaseFood * SEASON_MODIFIERS[SEASONS.indexOf(gameState.season)].foodYieldMult;
                    if (gameState.upgrades?.crop_rotation) foodBonus += 2;
                    foodBonus += getAdjacencyBonus(this._workTX, this._workTY, 'farm');
                    if (_tier2Upgrades[farmKey]) foodBonus += 2;
                    gameState.food += foodBonus;
                    gameState.food = Math.min(gameState.food, getFoodCap());
                    spawnFloat(this.x, this.y - 10, `+${Math.round(foodBonus)} Food`, '#88cc44', 1.0);
                    // Proxy marks UI dirty on gameState.food write; flushUI() syncs next frame
                }
                this._phaseTimer = 0;
                this._phase = 'go_work';
                this._wanderNearWorkplace(grid, 2);
            }
        }
    }

    _updateWoodcutter(dtSec, grid) {
        if (this._phase === 'go_work') {
            if (this._isAtTile(this._workTX, this._workTY)) {
                this._phase = 'seek';
            } else {
                this._setTargetTile(this._workTX, this._workTY, grid);
            }
        } else if (this._phase === 'seek') {
            const myTX = Math.floor(this.x / TILE_SIZE);
            const myTY = Math.floor(this.y / TILE_SIZE);
            let bx = -1, by = -1, bd = Infinity;
            for (let dy = -15; dy <= 15; dy++) {
                for (let dx = -15; dx <= 15; dx++) {
                    const nx = myTX + dx, ny = myTY + dy;
                    if (!grid.inBounds(nx, ny)) continue;
                    // Spare trees orthogonally adjacent to the lumberyard — they
                    // grant its adjacency bonus, which chopping would destroy.
                    if (Math.abs(nx - this._workTX) + Math.abs(ny - this._workTY) === 1) continue;
                    const s = grid.structures[ny][nx];
                    if (s && s.def.key === 'obstacle_tree') {
                        const d = dx * dx + dy * dy; // squared distance — sufficient for nearest-node comparison, no sqrt
                        if (d < bd) { bd = d; bx = nx; by = ny; }
                    }
                }
            }
            if (bx !== -1) {
                this._nodeTX = bx; this._nodeTY = by;
                this._phase = 'go_node';
                this._setTargetTile(bx, by, grid);
            } else {
                this._nodeTX = -1;
                this._nodeTY = -1;
                this._phase = 'work';
                this._phaseTimer = 0;
            }
        } else if (this._phase === 'go_node') {
            const s = grid.structures[this._nodeTY]?.[this._nodeTX];
            if (s && s.def.key === 'obstacle_tree') {
                this._phase = 'work'; this._phaseTimer = 0;
            } else {
                this._phase = 'seek';
            }
        } else if (this._phase === 'work') {
            this._phaseTimer += dtSec;
            if (this._phaseTimer >= 2.0) {
                const s = grid.structures[this._nodeTY]?.[this._nodeTX];
                this._carrying = false;
                if (s && s.def.key === 'obstacle_tree') {
                    grid.structures[this._nodeTY][this._nodeTX] = null;
                    window.patchStaticCache?.(this._nodeTX, this._nodeTY);
                    this._carrying = true; // an actual tree was felled
                }
                playChopSFX();
                this._phase = 'returning';
                this._setTargetTile(this._workTX, this._workTY, grid);
            }
        } else if (this._phase === 'returning') {
            if (this._isAtTile(this._workTX, this._workTY)) {
                const lumberKey = `${this._workTX},${this._workTY}`;
                let woodBonus = 10 * SEASON_MODIFIERS[SEASONS.indexOf(gameState.season)].woodYieldMult;
                woodBonus += getAdjacencyBonus(this._workTX, this._workTY, 'lumberyard');
                if (_tier2Upgrades[lumberKey]) woodBonus += 2;
                // No tree actually harvested → reduced "gleaning" yield, so
                // real nodes matter but a deforested map doesn't zero the economy.
                if (!this._carrying) woodBonus *= window.PRODUCTION_BALANCE?.gleanYieldMult ?? 0.4;
                this._carrying = false;
                gameState.wood += woodBonus;
                spawnFloat(this.x, this.y - 10, `+${Math.round(woodBonus)} Wood`, '#a06428', 1.0);
                // Proxy marks UI dirty on gameState.wood write; flushUI() syncs next frame
                this._phase = 'seek';
                this._wanderNearWorkplace(grid, 2);
            } else if (this.state !== 'walking') {
                this._setTargetTile(this._workTX, this._workTY, grid);
            }
        }
    }

    _updateMiner(dtSec, grid, nodeKey, resourceKey, adjacencyType) {
        if (this._phase === 'go_work') {
            if (this._isAtTile(this._workTX, this._workTY)) {
                this._phase = 'seek';
            } else {
                this._setTargetTile(this._workTX, this._workTY, grid);
            }
        } else if (this._phase === 'seek') {
            const myTX = Math.floor(this.x / TILE_SIZE);
            const myTY = Math.floor(this.y / TILE_SIZE);
            let bx = -1, by = -1, bd = Infinity;
            for (let dy = -15; dy <= 15; dy++) {
                for (let dx = -15; dx <= 15; dx++) {
                    const nx = myTX + dx, ny = myTY + dy;
                    if (!grid.inBounds(nx, ny)) continue;
                    const s = grid.structures[ny][nx];
                    if (s && s.def.key === nodeKey) {
                        const d = dx * dx + dy * dy; // squared distance — sufficient for nearest-node comparison, no sqrt
                        if (d < bd) { bd = d; bx = nx; by = ny; }
                    }
                }
            }
            if (bx !== -1) {
                this._nodeTX = bx; this._nodeTY = by;
                this._phase = 'go_node';
                this._setTargetTile(bx, by, grid);
            } else {
                this._nodeTX = -1;
                this._nodeTY = -1;
                this._phase = 'work';
                this._phaseTimer = 0;
            }
        } else if (this._phase === 'go_node') {
            const s = grid.structures[this._nodeTY]?.[this._nodeTX];
            if (s && s.def.key === nodeKey) {
                this._phase = 'work'; this._phaseTimer = 0;
            } else {
                this._phase = 'seek';
            }
        } else if (this._phase === 'work') {
            this._phaseTimer += dtSec;
            if (this._phaseTimer >= 2.0) {
                const s = grid.structures[this._nodeTY]?.[this._nodeTX];
                this._carrying = false;
                if (s && s.def.key === nodeKey) {
                    s.hp = (s.hp ?? 5) - 1;
                    this._carrying = true; // an actual deposit was worked
                    if (s.hp <= 0) {
                        grid.structures[this._nodeTY][this._nodeTX] = null;
                        window.patchStaticCache?.(this._nodeTX, this._nodeTY);
                    }
                }
                playClankSFX();
                this._phase = 'returning';
                this._setTargetTile(this._workTX, this._workTY, grid);
            }
        } else if (this._phase === 'returning') {
            if (this._isAtTile(this._workTX, this._workTY)) {
                const mineKey = `${this._workTX},${this._workTY}`;
                const adjBonus = getAdjacencyBonus(this._workTX, this._workTY, adjacencyType);
                const t2Bonus = (resourceKey === 'iron' && _tier2Upgrades[mineKey]) ? 2 : 0;
                // Reduced "gleaning" yield when no deposit was actually worked.
                const gleanMult = this._carrying ? 1 : (window.PRODUCTION_BALANCE?.gleanYieldMult ?? 0.4);
                this._carrying = false;
                const mineYield = (10 + adjBonus + t2Bonus) * gleanMult;
                gameState[resourceKey] = (gameState[resourceKey] ?? 0) + mineYield;
                const floatColor = resourceKey === 'stone' ? '#aaaaaa' : '#b0b8c8';
                const floatLabel = resourceKey === 'stone' ? `+${Math.round(mineYield)} Stone` : `+${Math.round(mineYield)} Iron`;
                spawnFloat(this.x, this.y - 10, floatLabel, floatColor, 1.0);
                // Proxy marks UI dirty on gameState[resourceKey] write; flushUI() syncs next frame
                this._phase = 'seek';
                this._wanderNearWorkplace(grid, 2);
            } else if (this.state !== 'walking') {
                this._setTargetTile(this._workTX, this._workTY, grid);
            }
        }
    }

    _updateRebel(dtSec, grid) {
        // Calm down when happiness recovers, during raids, or no soldiers left
        if (gameState.happiness >= 50 || raidActive || soldiers.length === 0) {
            this.job = 'idle'; this._phase = 'idle'; this._rebelTarget = null; return;
        }
        // Find nearest soldier if needed
        if (!this._rebelTarget || !soldiers.includes(this._rebelTarget)) {
            let best = null, bd = Infinity;
            for (const sol of soldiers) {
                const d = Math.hypot(sol.x - this.x, sol.y - this.y);
                if (d < bd) { bd = d; best = sol; }
            }
            this._rebelTarget = best;
            this._phaseTimer = 0;
            if (!best) { this.job = 'idle'; return; }
        }
        const sol = this._rebelTarget;
        const dist = Math.hypot(sol.x - this.x, sol.y - this.y);
        if (dist > TILE_SIZE * 1.5) {
            if (this.state !== 'walking') {
                this._setTargetTile(Math.floor(sol.x / TILE_SIZE), Math.floor(sol.y / TILE_SIZE), grid);
            }
        } else {
            this._phaseTimer += dtSec;
            if (this._phaseTimer >= 1.5) {
                this._phaseTimer = 0;
                // Soldiers fight back: each swing has a chance the rebel is
                // subdued and calms down, so a happiness dip can no longer
                // silently delete an army that never defends itself.
                if (Math.random() < 0.35) {
                    spawnFloat(this.x, this.y - 12, 'Subdued', '#88aacc', 0.9);
                    this.job = 'idle'; this._phase = 'idle'; this._rebelTarget = null;
                    return;
                }
                sol.hp -= 15;
                spawnFloat(sol.x, sol.y - 12, '-15', '#ff4444', 0.8);
                if (sol.hp <= 0) {
                    const idx = soldiers.indexOf(sol);
                    if (idx !== -1) {
                        soldiers.splice(idx, 1);
                        const p = getPooledParticle();
                        p.x = sol.x; p.y = sol.y; p.type = 'puff'; p.timer = 0; p.duration = 0.4; p.alpha = 1.0;
                        particles.push(p);
                        gameState.defense = calcDefense();
                        // Proxy marks UI dirty; flushUI() syncs next frame
                    }
                    this._rebelTarget = null;
                    this.job = 'idle'; this._phase = 'idle'; // calm after routing target
                }
            }
        }
    }

    _updateBuilder(dtSec, grid) {
        const s = grid.structures[this._workTY]?.[this._workTX];
        if (!s || (s.progress ?? 1.0) >= 1.0) {
            this.job = 'idle';
            this._phase = 'idle';
            this._workTX = -1;
            this._workTY = -1;
            return;
        }
        if (this._phase === 'go_work') {
            if (this._isAtTile(this._workTX, this._workTY)) {
                this._phase = 'building';
            } else {
                this._setTargetTile(this._workTX, this._workTY, grid);
            }
        } else if (this._phase === 'building') {
            s.progress = Math.min(1.0, (s.progress ?? 0) + 0.1 * dtSec);
            this._tickAmbientWalk(dtSec, grid, this._workTX, this._workTY, 1);
            if (Math.random() < dtSec * 3) playTapSFX();
            if (s.progress >= 1.0) {
                this.job = 'idle';
                this._phase = 'idle';
                this._workTX = -1;
                this._workTY = -1;
            }
        }
    }
}

// ===================== SOLDIER =====================
export class Soldier {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.speed = 1.5;
        this._moveFromX = x;
        this._moveFromY = y;
        this._moveTimer = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.state = 'idle';
        this._idleTimer = 0;
        this._idleWait = 1.0 + Math.random() * 2.0;
        this._chasePath = [];
        this._chaseIndex = 0;
        this._chaseRepathTimer = 0;
        this._chaseTarget = null;
        this._path = [];
        this._pathIndex = 0;
        this._pathState = null;
        this._defendRepathTimer = 0;
    }

    _setTarget(nx, ny, grid) {
        this.targetX = nx * TILE_SIZE + TILE_SIZE / 2;
        this.targetY = ny * TILE_SIZE + TILE_SIZE / 2;
        this._moveFromX = this.x;
        this._moveFromY = this.y;
        this._moveTimer = 0;
        this.speed = grid.tiles[ny][nx] === 'tile_road' ? 0.75 : 1.5;
        this.state = 'patrolling';
    }

    _pickPatrolTarget(grid) {
        if (_combatMode === 'defend') {
            const rally = _getDefendRallyTile();
            if (rally) {
                const sx = Math.floor(this.x / TILE_SIZE);
                const sy = Math.floor(this.y / TILE_SIZE);
                const path = aStarPath(sx, sy, rally.tx, rally.ty, isFriendlyWalkable);
                if (path && path.length > 0) {
                    _assignUnitPath(this, path, grid, 1.5, 'patrolling');
                    return;
                }
                if (path && path.length === 0) {
                    this._idleWait = 1.5 + Math.random() * 2.0;
                    return;
                }
            }
        }
        const curTX = Math.floor(this.x / TILE_SIZE);
        const curTY = Math.floor(this.y / TILE_SIZE);
        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        for (let i = dirs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }
        const military = new Set(['wall', 'tower', 'barracks']);
        for (const { dx, dy } of dirs) {
            const nx = curTX + dx, ny = curTY + dy;
            if (!grid.inBounds(nx, ny)) continue;
            if (Math.hypot(nx - 32, ny - 32) > currentTerritoryRadius + 1) continue;
            const s = grid.structures[ny][nx];
            if (s && military.has(s.def.key)) {
                const post = _getNearestOpenNeighbor(nx, ny, isFriendlyWalkable);
                if (post) { this._setTarget(post.tx, post.ty, grid); return; }
            }
        }
        for (const { dx, dy } of dirs) {
            const nx = curTX + dx, ny = curTY + dy;
            if (!grid.inBounds(nx, ny)) continue;
            if (Math.hypot(nx - 32, ny - 32) > currentTerritoryRadius + 1) continue;
            const tile = grid.tiles[ny][nx];
            if ((tile === 'tile_grass' || tile === 'tile_dirt' || tile === 'tile_road') && !grid.structures[ny][nx]) {
                this._setTarget(nx, ny, grid); return;
            }
        }
    }

    update(dtSec, grid, activeRaiders) {
        _clampToTerritory(this);
        // Attack mode: engage any active raider. Defend mode: only raiders
        // inside the rally leash are engaged — the army holds the walls and
        // lets towers/archers handle distant stragglers.
        const engageable = _selectEngageableRaiders(activeRaiders);
        if (engageable.length > 0) {
            this._assaulting = false;
            const closest = _pickMeleeTarget(this, engageable);
            if (closest) {
                this._chaseRepathTimer += dtSec;
                if (this._chaseTarget !== closest || this._chaseRepathTimer >= 1.5 || this._chaseIndex >= this._chasePath.length) {
                    this._chaseTarget = closest;
                    this._chaseRepathTimer = 0;
                    const sx = Math.floor(this.x / TILE_SIZE), sy = Math.floor(this.y / TILE_SIZE);
                    const ex = Math.floor(closest.x / TILE_SIZE), ey = Math.floor(closest.y / TILE_SIZE);
                    const p = aStarPath(sx, sy, ex, ey, isFriendlyWalkable);
                    this._chasePath = (p && p.length > 0) ? p : [];
                    this._chaseIndex = 0;
                }
                if (this._chaseIndex < this._chasePath.length) {
                    const wp = this._chasePath[this._chaseIndex];
                    const tx = wp % GRID_WIDTH;
                    const ty = (wp / GRID_WIDTH) | 0;
                    const wpX = tx * TILE_SIZE + TILE_SIZE / 2, wpY = ty * TILE_SIZE + TILE_SIZE / 2;
                    const d = Math.hypot(wpX - this.x, wpY - this.y);
                    const spd = TILE_SIZE * 1.5 * dtSec;
                    if (d <= spd) { this.x = wpX; this.y = wpY; this._chaseIndex++; }
                    else { this.x += (wpX - this.x) / d * spd; this.y += (wpY - this.y) / d * spd; }
                    applySeparation(this, dtSec, isFriendlyWalkable);
                    _clampToTerritory(this);
                }
            }
            return;
        }
        // ATTACK mode with standing raider camps and nothing else to fight:
        // march out and raze them (the whole point of attack mode).
        if (_combatMode === 'attack' && (window.raiderCamps?.length ?? 0) > 0) {
            this._assaulting = true;
            _marchOnCamp(this, dtSec, grid, 1.5);
            return;
        }
        this._assaulting = false;
        this._chasePath = []; this._chaseIndex = 0; this._chaseTarget = null;
        this.hp = Math.min(this.maxHp, this.hp + (gameState.upgrades?.field_medicine ? 6 : 3) * dtSec); // heal out of combat
        if (this.state === 'idle') {
            this._idleTimer += dtSec;
            if (this._idleTimer >= this._idleWait) {
                this._idleTimer = 0;
                this._idleWait = 1.0 + Math.random() * 2.0;
                this._pickPatrolTarget(grid);
            }
        } else {
            _moveUnitAlongPath(this, dtSec, grid, 1.5);
        }
        applySeparation(this, dtSec, isFriendlyWalkable);
        _clampToTerritory(this);
    }
}

// ===================== ARCHER =====================
export class Archer {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.targetX = x; this.targetY = y;
        this.hp = 80; this.maxHp = 80;
        this._moveFromX = x; this._moveFromY = y;
        this._moveTimer = 0; this.speed = 1.5;
        this.state = 'seeking_post';
        this._postTX = -1; this._postTY = -1;
        this._postStandTX = -1; this._postStandTY = -1;
        this._fireTimer = 0;
        this._searchTimer = 0;
        this._path = [];
        this._pathIndex = 0;
        this._followPathTimer = 0;
    }

    update(dtSec, grid, activeRaiders) {
        _clampToTerritory(this);
        // Mode-sync: switch state when _combatMode changes
        if (_combatMode === 'attack' && (this._postTX !== -1 || this.state === 'seeking_post' || this.state === 'at_post')) {
            this._postTX = -1; this._postTY = -1;
            this._postStandTX = -1; this._postStandTY = -1;
            this.state = 'following';
            this._path = [];
            this._pathIndex = 0;
        } else if (_combatMode === 'defend' && this.state === 'following') {
            this.state = 'seeking_post';
            this._path = [];
            this._pathIndex = 0;
        }

        if (this._postTX !== -1) {
            const s = grid.structures[this._postTY]?.[this._postTX];
            if (!s || (s.def.key !== 'wall' && s.def.key !== 'tower' && s.def.key !== 'gate')) {
                this._postTX = -1; this._postTY = -1;
                this._postStandTX = -1; this._postStandTY = -1;
                this.state = 'seeking_post';
            }
        }
        if (this.state === 'following') {
            // Follow army centroid; fire at nearest raider from current position
            const army = [...soldiers, ...knights];
            if (army.length === 0) { this.state = 'seeking_post'; return; }
            this._followPathTimer += dtSec;
            if (this._followPathTimer >= 1.0 || this._pathIndex >= this._path.length) {
                this._followPathTimer = 0;
                const followCX = army.reduce((s, u) => s + u.x, 0) / army.length;
                const followCY = army.reduce((s, u) => s + u.y, 0) / army.length;
                const destTX = Math.floor(followCX / TILE_SIZE);
                const destTY = Math.floor(followCY / TILE_SIZE);
                const sx = Math.floor(this.x / TILE_SIZE);
                const sy = Math.floor(this.y / TILE_SIZE);
                const path = aStarPath(sx, sy, destTX, destTY, isFriendlyWalkable);
                if (path && path.length > 0) {
                    this._path = path;
                    this._pathIndex = 0;
                    this.state = 'moving_to_post';
                    _stepUnitPath(this, grid, 1.5, 'moving_to_post');
                }
            }
            this._fireTimer = Math.max(0, this._fireTimer - dtSec);
            if (this._fireTimer <= 0 && activeRaiders.length > 0) {
                const CB = window.COMBAT_BALANCE?.archer;
                const range = (CB?.rangeTiles ?? 12) * TILE_SIZE;
                const limitSq = range * range;
                let closest = null, cdSq = Infinity;
                for (const r of activeRaiders) {
                    const dx = r.x - this.x, dy = r.y - this.y;
                    const dSq = dx * dx + dy * dy;
                    if (dSq <= limitSq && dSq < cdSq) { closest = r; cdSq = dSq; }
                }
                if (closest) {
                    this._fireTimer = CB?.fireIntervalSec ?? 1.5;
                    const dmg = gameState.upgrades?.steel_bows ? (CB?.steelBowsDamage ?? 25) : (CB?.damage ?? 20);
                    fireArrow(this.x, this.y, closest, dmg);
                }
            }
            applySeparation(this, dtSec, isFriendlyWalkable);
            _clampToTerritory(this);
            return;
        }
        if (this.state === 'seeking_post') {
            this._searchTimer += dtSec;
            if (this._searchTimer < 1.0) return;
            this._searchTimer = 0;
            const protectedPost = _findProtectedWallPost(this, activeRaiders);
            if (protectedPost) {
                const { tx: bx, ty: by, standTX, standTY } = protectedPost;
                this._postTX = bx; this._postTY = by;
                this._postStandTX = standTX; this._postStandTY = standTY;
                const aSX = Math.floor(this.x / TILE_SIZE), aSY = Math.floor(this.y / TILE_SIZE);
                const ap = aStarPath(aSX, aSY, standTX, standTY, isFriendlyWalkable);
                this._path = (ap && ap.length > 0) ? ap : [];
                this._pathIndex = 0;
                this._moveFromX = this.x; this._moveFromY = this.y;
                this._moveTimer = 0;
                this.state = 'moving_to_post';
                applySeparation(this, dtSec, isFriendlyWalkable);
                _clampToTerritory(this);
                return;
            }
            const mTX = Math.floor(this.x / TILE_SIZE);
            const mTY = Math.floor(this.y / TILE_SIZE);
            // Claimed posts → O(1) lookup, built once (replaces per-candidate archers.some()).
            // Search the maintained wall/tower lists within a 25-tile box instead of sweeping
            // 51×51 grid cells. Stale list entries self-correct via the post check above.
            let bx = -1, by = -1, bd = Infinity;
            let nearestRaider = null;
            let nearestRaiderDistSq = Infinity;
            let nearestRaiderTX = -1;
            let nearestRaiderTY = -1;
            for (const r of activeRaiders) {
                const dx = Math.floor(r.x / TILE_SIZE) - mTX;
                const dy = Math.floor(r.y / TILE_SIZE) - mTY;
                const dSq = dx * dx + dy * dy;
                if (dSq < nearestRaiderDistSq) {
                    nearestRaiderDistSq = dSq;
                    nearestRaider = r;
                    nearestRaiderTX = Math.floor(r.x / TILE_SIZE);
                    nearestRaiderTY = Math.floor(r.y / TILE_SIZE);
                }
            }
            for (const list of [activeWalls, activeTowers]) {
                for (const { tx: nx, ty: ny } of list) {
                    const dx = nx - mTX, dy = ny - mTY;
                    if (dx < -25 || dx > 25 || dy < -25 || dy > 25) continue;
                    const postKey = nx + ',' + ny;
                    const postCount = _archerDefenseContext.postCounts.get(postKey) || 0;
                    if (postCount > ((this._postTX === nx && this._postTY === ny) ? 1 : 0)) continue;
                    let raiderScore = Infinity;
                    if (nearestRaider) {
                        const rdx = nx - nearestRaiderTX;
                        const rdy = ny - nearestRaiderTY;
                        raiderScore = rdx * rdx + rdy * rdy;
                    }
                    const selfScore = dx * dx + dy * dy;
                    const score = nearestRaider ? (raiderScore * 1000 + selfScore) : selfScore;
                    if (score < bd) { bd = score; bx = nx; by = ny; }
                }
            }
            if (bx !== -1) {
                this._postTX = bx; this._postTY = by;
                const aSX = Math.floor(this.x / TILE_SIZE), aSY = Math.floor(this.y / TILE_SIZE);
                // Path to an adjacent walkable tile next to the post
                let destTX = bx, destTY = by;
                if (!isFriendlyWalkable(bx, by)) {
                    for (const { a, b } of [{a:0,b:-1},{a:0,b:1},{a:-1,b:0},{a:1,b:0}]) {
                        if (isFriendlyWalkable(bx + a, by + b)) { destTX = bx + a; destTY = by + b; break; }
                    }
                }
                const ap = aStarPath(aSX, aSY, destTX, destTY, isFriendlyWalkable);
                this._path = (ap && ap.length > 0) ? ap : [];
                this._pathIndex = 0;
                this._moveFromX = this.x; this._moveFromY = this.y;
                this._moveTimer = 0;
                this.state = 'moving_to_post';
            }
        } else if (this.state === 'moving_to_post') {
            if (this.state === 'moving_to_post' && this._pathIndex < this._path.length) {
                _moveUnitAlongPath(this, dtSec, grid, 1.5, 0.25, 0.5);
                if (this.state === 'idle') this.state = this._postTX === -1 ? 'following' : 'at_post';
            } else {
                this.state = this._postTX === -1 ? 'following' : 'at_post';
            }
        } else if (this.state === 'at_post') {
            this.hp = Math.min(this.maxHp, this.hp + (gameState.upgrades?.field_medicine ? 4 : 2) * dtSec); // heal at post
            this._fireTimer = Math.max(0, this._fireTimer - dtSec);
            if (this._fireTimer <= 0 && activeRaiders.length > 0) {
                // Arrows come from the manned post — but only if the archer's
                // body actually made it there. A failed path used to leave the
                // archer far away while arrows spawned from empty wall.
                let px = this._postTX * TILE_SIZE + TILE_SIZE / 2;
                let py = this._postTY * TILE_SIZE + TILE_SIZE / 2;
                const postDX = px - this.x, postDY = py - this.y;
                if (postDX * postDX + postDY * postDY > (2 * TILE_SIZE) * (2 * TILE_SIZE)) {
                    px = this.x; py = this.y;
                }
                const CB = window.COMBAT_BALANCE?.archer;
                const range = (CB?.rangeTiles ?? 12) * TILE_SIZE;
                const limitSq = range * range;
                let closest = null, cdSq = Infinity;
                for (const r of activeRaiders) {
                    const dx = r.x - px, dy = r.y - py;
                    const dSq = dx * dx + dy * dy;
                    if (dSq <= limitSq && dSq < cdSq) { closest = r; cdSq = dSq; }
                }
                if (closest) {
                    this._fireTimer = CB?.fireIntervalSec ?? 1.5;
                    const dmg = gameState.upgrades?.steel_bows ? (CB?.steelBowsDamage ?? 25) : (CB?.damage ?? 20);
                    fireArrow(px, py, closest, dmg);
                }
            }
        }
        applySeparation(this, dtSec, isFriendlyWalkable);
        _clampToTerritory(this);
    }
}

// ===================== KNIGHT =====================
export class Knight {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.maxHp = (gameState.upgrades && gameState.upgrades.heavy_armor) ? 200 : 150;
        this.hp = this.maxHp;
        this.speed = 1.2;
        this.targetX = x; this.targetY = y;
        this._moveFromX = x; this._moveFromY = y;
        this._moveTimer = 0;
        this.state = 'idle';
        this._idleTimer = 0; this._idleWait = 1 + Math.random() * 2;
        this._chasePath = [];
        this._chaseIndex = 0;
        this._chaseRepathTimer = 0;
        this._chaseTarget = null;
        this._path = [];
        this._pathIndex = 0;
        this._pathState = null;
    }

    update(dtSec, grid, activeRaiders) {
        _clampToTerritory(this);
        // Attack mode: engage any active raider. Defend mode: leash to rally
        // (see _selectEngageableRaiders) so knights hold position with the line.
        const engageable = _selectEngageableRaiders(activeRaiders);
        if (engageable.length > 0) {
            this._assaulting = false;
            const closest = _pickMeleeTarget(this, engageable);
            if (closest) {
                this._chaseRepathTimer += dtSec;
                if (this._chaseTarget !== closest || this._chaseRepathTimer >= 1.5 || this._chaseIndex >= this._chasePath.length) {
                    this._chaseTarget = closest;
                    this._chaseRepathTimer = 0;
                    const sx = Math.floor(this.x / TILE_SIZE), sy = Math.floor(this.y / TILE_SIZE);
                    const ex = Math.floor(closest.x / TILE_SIZE), ey = Math.floor(closest.y / TILE_SIZE);
                    const p = aStarPath(sx, sy, ex, ey, isFriendlyWalkable);
                    this._chasePath = (p && p.length > 0) ? p : [];
                    this._chaseIndex = 0;
                }
                if (this._chaseIndex < this._chasePath.length) {
                    const wp = this._chasePath[this._chaseIndex];
                    const tx = wp % GRID_WIDTH;
                    const ty = (wp / GRID_WIDTH) | 0;
                    const wpX = tx * TILE_SIZE + TILE_SIZE / 2, wpY = ty * TILE_SIZE + TILE_SIZE / 2;
                    const d = Math.hypot(wpX - this.x, wpY - this.y);
                    const spd = TILE_SIZE * 1.2 * dtSec;
                    if (d <= spd) { this.x = wpX; this.y = wpY; this._chaseIndex++; }
                    else { this.x += (wpX - this.x) / d * spd; this.y += (wpY - this.y) / d * spd; }
                    applySeparation(this, dtSec, isFriendlyWalkable);
                    _clampToTerritory(this);
                }
            }
            return;
        }
        // ATTACK mode: knights join camp assaults alongside soldiers
        if (_combatMode === 'attack' && (window.raiderCamps?.length ?? 0) > 0) {
            this._assaulting = true;
            _marchOnCamp(this, dtSec, grid, 1.2);
            return;
        }
        this._assaulting = false;
        this._chasePath = []; this._chaseIndex = 0; this._chaseTarget = null;
        this.hp = Math.min(this.maxHp, this.hp + (gameState.upgrades?.field_medicine ? 6 : 3) * dtSec); // heal out of combat
        if (this.state === 'idle') {
            this._idleTimer += dtSec;
            if (this._idleTimer >= this._idleWait) {
                this._idleTimer = 0; this._idleWait = 0.5 + Math.random() * 2;
                if (_combatMode === 'defend') {
                    const rally = _getDefendRallyTile();
                    if (rally) {
                        const sx = Math.floor(this.x / TILE_SIZE);
                        const sy = Math.floor(this.y / TILE_SIZE);
                        const path = aStarPath(sx, sy, rally.tx, rally.ty, isFriendlyWalkable);
                        if (path && path.length > 0) {
                            _assignUnitPath(this, path, grid, 1.2, 'patrolling');
                            return;
                        }
                        if (path && path.length === 0) {
                            this._idleWait = 1.5 + Math.random() * 2.0;
                            return;
                        }
                    }
                }
                const cx = Math.floor(this.x / TILE_SIZE), cy = Math.floor(this.y / TILE_SIZE);
                const dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
                for (let i = dirs.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [dirs[i],dirs[j]] = [dirs[j],dirs[i]]; }
                for (const {dx,dy} of dirs) {
                    const nx = cx+dx, ny = cy+dy;
                    if (!grid.inBounds(nx,ny)) continue;
                    if (Math.hypot(nx - 32, ny - 32) > currentTerritoryRadius + 1) continue;
                    const tile = grid.tiles[ny][nx];
                    if ((tile==='tile_grass'||tile==='tile_dirt'||tile==='tile_road') && !grid.structures[ny][nx]) {
                        this.targetX = nx*TILE_SIZE+TILE_SIZE/2; this.targetY = ny*TILE_SIZE+TILE_SIZE/2;
                        this._moveFromX = this.x; this._moveFromY = this.y;
                        this._moveTimer = 0; this.speed = tile==='tile_road'?0.75:1.2;
                        this.state = 'patrolling'; break;
                    }
                }
            }
        } else {
            _moveUnitAlongPath(this, dtSec, grid, 1.2);
        }
        applySeparation(this, dtSec, isFriendlyWalkable);
        _clampToTerritory(this);
    }
}

// ===================== MERCHANT NPC =====================
export class MerchantNPC {
    constructor() {
        const edge = Math.floor(Math.random() * 4);
        const W = GRID_WIDTH * TILE_SIZE, H = GRID_HEIGHT * TILE_SIZE;
        if      (edge === 0) { this.x = Math.random() * W; this.y = 0; }
        else if (edge === 1) { this.x = Math.random() * W; this.y = H; }
        else if (edge === 2) { this.x = 0;                 this.y = Math.random() * H; }
        else                 { this.x = W;                 this.y = Math.random() * H; }
        this.startX = this.x; this.startY = this.y;
        this.speed = 0.8; // tiles/sec
        this.state = 'approaching';
        this._tradeOpened = false;
    }

    update(dtSec) {
        if (this.state === 'approaching') {
            const destX = 32 * TILE_SIZE + TILE_SIZE / 2;
            const destY = 32 * TILE_SIZE + TILE_SIZE / 2;
            const dist = Math.hypot(destX - this.x, destY - this.y);
            if (dist < 2) { this.state = 'trading'; if (!this._tradeOpened) { this._tradeOpened = true; openTradeModal(); } return; }
            const spd = this.speed * TILE_SIZE * dtSec;
            this.x += (destX - this.x) / dist * Math.min(spd, dist);
            this.y += (destY - this.y) / dist * Math.min(spd, dist);
            if (!this._tradeOpened) {
                const tx = Math.floor(this.x / TILE_SIZE), ty = Math.floor(this.y / TILE_SIZE);
                for (let dy = -5; dy <= 5 && !this._tradeOpened; dy++) {
                    for (let dx = -5; dx <= 5 && !this._tradeOpened; dx++) {
                        const nx = tx + dx, ny = ty + dy;
                        if (!grid.inBounds(nx, ny)) continue;
                        const s = grid.structures[ny][nx];
                        if (s && BUILDINGS[s.def.key] && Math.hypot(dx, dy) <= 5) {
                            this._tradeOpened = true;
                            this.state = 'trading';
                            openTradeModal();
                        }
                    }
                }
            }
        } else if (this.state === 'departing') {
            const dist = Math.hypot(this.startX - this.x, this.startY - this.y);
            if (dist < 2) { this.state = 'done'; return; }
            const spd = this.speed * TILE_SIZE * dtSec;
            this.x += (this.startX - this.x) / dist * Math.min(spd, dist);
            this.y += (this.startY - this.y) / dist * Math.min(spd, dist);
        }
    }
}

// ===================== RAIDER =====================
export class Raider {
    constructor(x, y, type = 'normal') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.state = 'walking';
        this.hp = type === 'siege' ? 150 : 100;
        this._alpha = 1.0;
        this._rotation = 0; // victory-spin animation (main.js updateEffects) — do not repurpose
        this._victoryTimer = 0;
        this._defeatTimer = 0;
        this._defeatFromX = x; this._defeatFromY = y;
        this._defeatTargetX = x; this._defeatTargetY = y;
        // Smooth tile-to-tile movement at 1.25× citizen speed (1.5s → 1.2s per tile)
        this._path = [];
        this._pathIndex = 0;
        this._moveFromX = x; this._moveFromY = y;
        this.targetX = x; this.targetY = y;
        this._moveTimer = 0;
        this._moveDuration = 1.2;
        // Stagger pathfinding so raiders don't all call A* on the same frame
        this._repathTimer = Math.random() * 2.0;
        this._periodicRepathTimer = Math.random() * 3.0;
        this._noPathTimer = 0;
        this._stuckTimer = 0;
        // Objective (hidden from player)
        const roll = Math.random();
        this.objective = roll < 0.35 ? 'kill' : roll < 0.70 ? 'pillage' : 'breach';
        this._target = null;
        this._attacking = false;
        this._attackTimer = 0;
        this._attackDuration = 3.0;
        this._objectivesCompleted = 0;
    }

    _pickObjectiveTarget(depth = 0) {
        if (depth > 3 || this._objectivesCompleted >= 4) {
            this._target = { type: 'retreat' };
            return;
        }
        // Siege raiders always prefer walls/gates first
        if (this.type === 'siege') {
            const sg = activeGates.length > 0 ? activeGates : activeWalls.length > 0 ? activeWalls : null;
            if (sg && sg.length > 0) {
                const sx = Math.floor(this.x / TILE_SIZE), sy = Math.floor(this.y / TILE_SIZE);
                let best = null, bestD = Infinity;
                for (const { tx, ty } of sg) {
                    const d = Math.hypot(tx - sx, ty - sy);
                    if (d < bestD) { bestD = d; best = { tx, ty }; }
                }
                if (best) { this._target = { type: 'building', tx: best.tx, ty: best.ty }; return; }
            }
        }
        if (this.objective === 'kill') {
            if (citizens.length === 0) { this.objective = 'pillage'; return this._pickObjectiveTarget(depth + 1); }
            this._target = { type: 'citizen', citizen: citizens[Math.floor(Math.random() * citizens.length)] };
        } else if (this.objective === 'pillage') {
            if (activePillageable.length === 0) { this.objective = 'breach'; return this._pickObjectiveTarget(depth + 1); }
            const t = activePillageable[Math.floor(Math.random() * activePillageable.length)];
            this._target = { type: 'building', tx: t.tx, ty: t.ty };
        } else {
            // breach: prefer gates, then walls, then towers
            const breachable = activeGates.length > 0 ? activeGates
                             : activeWalls.length > 0  ? activeWalls
                             : activeTowers;
            if (breachable.length === 0) { this.objective = 'pillage'; return this._pickObjectiveTarget(depth + 1); }
            const t = breachable[Math.floor(Math.random() * breachable.length)];
            this._target = { type: 'building', tx: t.tx, ty: t.ty };
        }
    }

    // Drop the current (invalid) target and re-path, but cap the retry depth so an objective
    // pool containing only stale/unreachable targets can never recurse without bound (a hard
    // freeze). On exhaustion the raider retreats instead of looping forever.
    _retryObjective(depth) {
        this._target = null;
        if (depth >= 8) { this._target = { type: 'retreat' }; }
        else { this._pickObjectiveTarget(); }
        this._requestPath(depth + 1);
    }

    _requestPath(_depth = 0) {
        if (!this._target) this._pickObjectiveTarget();
        if (!this._target) return;

        if (this._target.type === 'retreat') {
            const cx = Math.floor(this.x / TILE_SIZE);
            const cy = Math.floor(this.y / TILE_SIZE);
            const ex = this.x < grid.width * TILE_SIZE / 2 ? 0 : grid.width - 1;
            const ey = this.y < grid.height * TILE_SIZE / 2 ? 0 : grid.height - 1;
            const path = aStarPath(cx, cy, ex, ey);
            if (path && path.length > 0) { this._path = path; this._pathIndex = 0; this._startNextWaypoint(); }
            return;
        }

        const sx = Math.floor(this.x / TILE_SIZE);
        const sy = Math.floor(this.y / TILE_SIZE);
        let dx, dy;

        if (this._target.type === 'citizen') {
            if (!this._target.citizen._alive) {
                this._retryObjective(_depth); return;
            }
            dx = Math.floor(this._target.citizen.x / TILE_SIZE);
            dy = Math.floor(this._target.citizen.y / TILE_SIZE);
        } else {
            const s = grid.structures[this._target.ty]?.[this._target.tx];
            if (!s || s.def.key === 'rubble') {
                this._retryObjective(_depth); return;
            }
            dx = this._target.tx;
            dy = this._target.ty;
        }

        // Non-walkable targets (walls/towers): navigate to nearest adjacent walkable tile
        let finalDX = dx, finalDY = dy;
        if (!isRaiderWalkable(dx, dy)) {
            let best = null, bestD = Infinity;
            for (const { a, b } of [{a:0,b:-1},{a:0,b:1},{a:-1,b:0},{a:1,b:0}]) {
                const ax = dx + a, ay = dy + b;
                if (isRaiderWalkable(ax, ay)) {
                    const d = Math.hypot(ax - sx, ay - sy);
                    if (d < bestD) { bestD = d; best = { tx: ax, ty: ay }; }
                }
            }
            if (!best) { this._target = null; return; }
            finalDX = best.tx; finalDY = best.ty;
        }

        const path = aStarPath(sx, sy, finalDX, finalDY);
        if (path === false) {
            // Budget exhausted — will retry next frame via _noPathTimer
        } else if (path === null) {
            // Truly blocked — if targeting a citizen, break through nearest gate instead
            if (this._target?.type === 'citizen') {
                this._switchToGateBreaching();
            } else {
                // Already targeting a structure but fully blocked — wander toward center
                const wx = Math.floor(grid.width / 2) + Math.floor((Math.random() - 0.5) * 10);
                const wy = Math.floor(grid.height / 2) + Math.floor((Math.random() - 0.5) * 10);
                const wp = aStarPath(sx, sy, wx, wy);
                if (wp && wp.length > 0) { this._path = wp; this._pathIndex = 0; this._startNextWaypoint(); }
            }
        } else if (path.length === 0) {
            this._checkAttack();
        } else {
            this._path = path;
            this._pathIndex = 0;
            this._startNextWaypoint();
        }
    }

    _switchToGateBreaching() {
        const sx = Math.floor(this.x / TILE_SIZE);
        const sy = Math.floor(this.y / TILE_SIZE);
        let best = null, bestD = Infinity;
        // Prefer gates, fall back to walls — use cached lists instead of full grid scan
        for (const { tx, ty } of activeGates) {
            const d = Math.hypot(tx - sx, ty - sy);
            if (d < bestD) { bestD = d; best = { tx, ty }; }
        }
        if (!best) {
            for (const { tx, ty } of activeWalls) {
                const d = Math.hypot(tx - sx, ty - sy);
                if (d < bestD) { bestD = d; best = { tx, ty }; }
            }
        }
        if (best) {
            this._target = { type: 'building', tx: best.tx, ty: best.ty };
            this._requestPath();
        }
    }

    _startNextWaypoint() {
        if (!this._path || this._pathIndex >= this._path.length) return;
        const wp = this._path[this._pathIndex];
        const tx = wp % GRID_WIDTH;
        const ty = (wp / GRID_WIDTH) | 0;
        this._moveFromX = this.x;
        this._moveFromY = this.y;
        this.targetX = tx * TILE_SIZE + TILE_SIZE / 2;
        this.targetY = ty * TILE_SIZE + TILE_SIZE / 2;
        this._moveTimer = 0;
    }

    _checkAttack() {
        if (!this._target || this._target.type === 'retreat') return;
        if (this._target.type === 'citizen') {
            const c = this._target.citizen;
            if (!citizens.includes(c)) { this._target = null; return; }
            if (Math.hypot(c.x - this.x, c.y - this.y) < TILE_SIZE * 1.5) {
                this._attacking = true; this._attackTimer = 0; this._attackDuration = 1.5;
            } else { this._target = null; }
        } else {
            const s = grid.structures[this._target.ty]?.[this._target.tx];
            if (!s || s.def.key === 'rubble') { this._target = null; return; }
            const bx = this._target.tx * TILE_SIZE + TILE_SIZE / 2;
            const by = this._target.ty * TILE_SIZE + TILE_SIZE / 2;
            if (Math.hypot(bx - this.x, by - this.y) < TILE_SIZE * 1.5) {
                this._attacking = true; this._attackTimer = 0; this._attackDuration = 3.0;
            } else { this._target = null; }
        }
    }

    _completeAttack() {
        this._attacking = false;
        this._attackTimer = 0;
        this._objectivesCompleted++;
        if (this._target?.type === 'citizen') {
            const idx = citizens.indexOf(this._target.citizen);
            if (idx !== -1) {
                const c = this._target.citizen;
                c._alive = false;
                citizens.splice(idx, 1);
                gameState.population = Math.max(0, gameState.population - 1);
                // Setters keep the module-scoped copies in state.js in sync
                // (bare assignment only updated window.*, letting saves go stale)
                window.setRaidCitizensKilled(raidCitizensKilled + 1);
                window.setGriefPenalty(Math.min(15, _griefPenalty + 5));
                const p = getPooledParticle();
                p.x = c.x; p.y = c.y; p.type = 'puff'; p.timer = 0; p.duration = 0.4; p.alpha = 1.0;
                particles.push(p);
                triggerShake(3);
                // Proxy marks UI dirty on gameState.population write; flushUI() syncs next frame
            }
        } else if (this._target?.type === 'building') {
            const { tx, ty } = this._target;
            let s = grid.structures[ty]?.[tx];
            if (s && s.def.key !== 'rubble') {
                let parentTX = tx;
                let parentTY = ty;
                if (s.isChild) {
                    parentTX = s.parentX;
                    parentTY = s.parentY;
                    s = grid.structures[parentTY]?.[parentTX];
                }
                if (s && s.def.key !== 'rubble') {
                    // Torch raider: attempt to start fire; if successful retreat immediately
                    if (this.type === 'torch') {
                        if (_startFireAtTile(parentTX, parentTY)) {
                            this._attacking = false; this._attackTimer = 0; this._objectivesCompleted++;
                            this._target = { type: 'retreat' };
                            this._path = [];
                            this._pathIndex = 0;
                            this._requestPath();
                            return;
                        }
                        // Fire not possible — fall through to normal HP damage
                    }
                    // Deal HP damage; destroy only when HP exhausted
                    const maxHp = getMaxHP(s.def.key);
                    const _isWallGate = s.def.key === 'wall' || s.def.key === 'gate';
                    const RB = window.COMBAT_BALANCE?.raider;
                    s.hp = (s.hp ?? maxHp) - (this.type === 'siege' && _isWallGate
                        ? (RB?.siegeWallDamage ?? 75) : (RB?.buildingDamage ?? 50));
                    const p = getPooledParticle();
                    p.x = parentTX * TILE_SIZE + TILE_SIZE / 2; p.y = parentTY * TILE_SIZE + TILE_SIZE / 2; p.type = 'slash'; p.timer = 0; p.duration = 0.8; p.alpha = 1.0;
                    particles.push(p);
                    triggerShake(3);
                    if (s.hp <= 0) {
                        gameState.housing = Math.max(0, gameState.housing - (s.def.housing || 0));
                        delete _tier2Upgrades[`${parentTX},${parentTY}`];
                        const w = s.def.width || 1;
                        const h = s.def.height || 1;
                        for (let dy = 0; dy < h; dy++) {
                            for (let dx = 0; dx < w; dx++) {
                                const cy = parentTY + dy, cx = parentTX + dx;
                                grid.structures[cy][cx] = (dx === 0 && dy === 0) ? { def: RUBBLE_DEF, decayTimer: DAY_DURATION } : null;
                            }
                        }
                        window.setRaidBuildingsDestroyed(raidBuildingsDestroyed + 1);
                        window.patchStaticCache?.(parentTX, parentTY, w, h);
                        rebuildStructureLists();
                        if (window.markUIDirty) window.markUIDirty();
                        triggerShake(5);
                    }
                    // Proxy marks UI dirty on housing/food changes; flushUI() syncs next frame
                }
            }
        }
        this._target = null;
        this._path = [];
        this._pathIndex = 0;
        this._pickObjectiveTarget();
        this._requestPath();
    }

    update(dtSec) {
        if (this.state !== 'walking') return;

        if (this._repathTimer > 0) { this._repathTimer -= dtSec; return; }

        if (this._attacking) {
            applySeparation(this, dtSec, isRaiderWalkable);
            this._attackTimer += dtSec;
            if (this._attackTimer >= this._attackDuration) this._completeAttack();
            return;
        }

        // Retreat: velocity-based move toward map edge, no A*
        if (this._target?.type === 'retreat') {
            const cx = grid.width * TILE_SIZE / 2, cy = grid.height * TILE_SIZE / 2;
            const ddx = this.x - cx, ddy = this.y - cy;
            const dist = Math.hypot(ddx, ddy) || 1;
            const spd = TILE_SIZE / this._moveDuration;
            this.x += (ddx / dist) * spd * dtSec;
            this.y += (ddy / dist) * spd * dtSec;
            const W = grid.width * TILE_SIZE, H = grid.height * TILE_SIZE;
            if (this.x < -TILE_SIZE * 2 || this.x > W + TILE_SIZE * 2 ||
                this.y < -TILE_SIZE * 2 || this.y > H + TILE_SIZE * 2) {
                this.state = 'dead';
            }
            return;
        }

        if (this._path && this._pathIndex < this._path.length) {
            this._stuckTimer = 0;
            // Periodically repath to track moving citizen targets
            if (this._target?.type === 'citizen') {
                this._periodicRepathTimer += dtSec;
                if (this._periodicRepathTimer >= 3.0) {
                    this._periodicRepathTimer = 0;
                    this._requestPath();
                    return;
                }
            }
            this._moveTimer += dtSec;
            const t = Math.min(1.0, this._moveTimer / this._moveDuration);
            this.x = this._moveFromX + (this.targetX - this._moveFromX) * t;
            this.y = this._moveFromY + (this.targetY - this._moveFromY) * t;
            applySeparation(this, dtSec, isRaiderWalkable);
            if (t >= 1.0) {
                this.x = this.targetX;
                this.y = this.targetY;
                this._pathIndex++;
                if (this._pathIndex < this._path.length) {
                    this._startNextWaypoint();
                } else {
                    this._checkAttack();
                    if (!this._attacking) {
                        this._target = null;
                        this._pickObjectiveTarget();
                        this._requestPath();
                    }
                }
            }
        } else {
            this._noPathTimer += dtSec;
            this._stuckTimer += dtSec;
            if (this._noPathTimer >= 0.8) {
                this._noPathTimer = 0;
                if (!this._target) this._pickObjectiveTarget();
                this._requestPath();
            }
            if (this._stuckTimer >= 10.0) {
                this._stuckTimer = 0;
                this._target = { type: 'retreat' };
                this._path = [];
                this._pathIndex = 0;
                this._requestPath();
            }
        }
    }
}

// Bind to window for global legacy namespace access
Object.assign(window, {
    Citizen, Soldier, Archer, Knight, MerchantNPC, Raider, _archerDefenseContext,
    rebuildSeparationGrid, _combatTargetCounts, _getDefendRallyTile
});
