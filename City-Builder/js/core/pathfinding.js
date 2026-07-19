// Pixel Dominion — Pathfinding Module
import {
    GRID_WIDTH,
    GRID_HEIGHT,
    sim,
} from './state.js';

// Walking checks
export function isRaiderWalkable(tx, ty) {
    if (!sim.grid || !sim.grid.inBounds(tx, ty)) return false;
    const s = sim.grid.structures[ty][tx];
    if (!s) return true;
    const k = s.def.key;
    if (k === 'wall' || k === 'tower' || k === 'ballista_tower') return false;
    if (k === 'gate') return s.gateOpen !== false;
    if (k === 'obstacle_tree' || k === 'stone_deposit' || k === 'iron_vein') return false;
    return true;
}

export function isFriendlyWalkable(tx, ty) {
    if (!sim.grid || !sim.grid.inBounds(tx, ty)) return false;
    const s = sim.grid.structures[ty][tx];
    if (!s) return true;
    const k = s.def.key;
    if (k === 'gate') return !!s.gateOpen;
    if (k === 'rubble') return true;
    return false; // all other structures block movement
}

// Pre-allocated A* buffers — zero heap allocation per search, eliminating GC pressure
const _A_W = GRID_WIDTH, _A_H = GRID_HEIGHT, _A_SZ = _A_W * _A_H;
const _A_g      = new Float32Array(_A_SZ);   // best g-cost per tile
const _A_f      = new Float32Array(_A_SZ);   // f-cost per tile (for heap comparison)
const _A_parent = new Int32Array(_A_SZ);     // parent tile key (-1 = start/unvisited)
const _A_seen   = new Uint32Array(_A_SZ);    // search generation for initialized tiles
const _A_closed = new Uint32Array(_A_SZ);    // search generation for closed tiles
const _A_heap   = new Int32Array(_A_SZ);     // binary min-heap of tile keys
let   _A_hSz    = 0;
let   _A_gen    = 1;

const _A_DIRS = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0},
                 {dx:1,dy:-1},{dx:-1,dy:-1},{dx:1,dy:1},{dx:-1,dy:1}];

function _aHeapPush(key) {
    let i = _A_hSz++;
    _A_heap[i] = key;
    while (i > 0) {
        const p = (i - 1) >> 1;
        if (_A_f[_A_heap[p]] <= _A_f[_A_heap[i]]) break;
        const t = _A_heap[p]; _A_heap[p] = _A_heap[i]; _A_heap[i] = t;
        i = p;
    }
}

function _aHeapPop() {
    const top = _A_heap[0];
    if (--_A_hSz > 0) {
        _A_heap[0] = _A_heap[_A_hSz];
        let i = 0;
        for (;;) {
            let s = i, l = 2*i+1, r = 2*i+2;
            if (l < _A_hSz && _A_f[_A_heap[l]] < _A_f[_A_heap[s]]) s = l;
            if (r < _A_hSz && _A_f[_A_heap[r]] < _A_f[_A_heap[s]]) s = r;
            if (s === i) break;
            const t = _A_heap[s]; _A_heap[s] = _A_heap[i]; _A_heap[i] = t;
            i = s;
        }
    }
    return top;
}

export function aStarPath(sx, sy, ex, ey, walkableFn = isRaiderWalkable) {
    if (sim.raidPathBudget <= 0) return false; // budget exhausted — retry next frame
    sim.raidPathBudget = sim.raidPathBudget - 1;
    sx = Math.max(0, Math.min(_A_W - 1, sx | 0));
    sy = Math.max(0, Math.min(_A_H - 1, sy | 0));
    ex = Math.max(0, Math.min(_A_W - 1, ex | 0));
    ey = Math.max(0, Math.min(_A_H - 1, ey | 0));
    if (sx === ex && sy === ey) return [];

    const W = _A_W;
    const startKey = sy * W + sx;
    const endKey   = ey * W + ex;
    _A_gen++;
    if (_A_gen === 0xFFFFFFFF) {
        _A_seen.fill(0);
        _A_closed.fill(0);
        _A_gen = 1;
    }
    _A_hSz = 0;

    _A_g[startKey] = 0;
    _A_f[startKey] = Math.abs(sx - ex) + Math.abs(sy - ey);
    _A_parent[startKey] = -1;
    _A_seen[startKey] = _A_gen;
    _A_closed[startKey] = 0;
    _aHeapPush(startKey);

    let itr = 0;
    while (_A_hSz > 0 && itr++ < 1200) {
        const ck = _aHeapPop();
        if (_A_closed[ck] === _A_gen) continue; // stale entry — lazy deletion
        _A_closed[ck] = _A_gen;

        if (ck === endKey) {
            const path = [];
            let k = ck;
            while (_A_parent[k] !== -1) {
                path.push(k);
                k = _A_parent[k];
            }
            path.reverse();
            return path;
        }

        const cx = ck % W, cy = (ck / W) | 0;
        const cg = _A_g[ck];
        for (const { dx, dy } of _A_DIRS) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= _A_W || ny < 0 || ny >= _A_H) continue;
            const nk = ny * W + nx;
            if (_A_closed[nk] === _A_gen) continue;
            if (dx !== 0 && dy !== 0 &&
                (!walkableFn(cx + dx, cy) ||
                 !walkableFn(cx, cy + dy))) continue;
            if (nk !== endKey && !walkableFn(nx, ny)) continue;
            const ng = cg + (dx !== 0 && dy !== 0 ? 1.414 : 1);
            const seenThisSearch = _A_seen[nk] === _A_gen;
            if (seenThisSearch && ng >= _A_g[nk]) continue;
            _A_g[nk] = ng;
            _A_f[nk] = ng + Math.abs(nx - ex) + Math.abs(ny - ey);
            _A_parent[nk] = ck;
            _A_seen[nk] = _A_gen;
            _A_closed[nk] = 0;
            _aHeapPush(nk);
        }
    }
    return null;
}

// Bind to window for legacy scripts
Object.assign(window, {
    isRaiderWalkable, isFriendlyWalkable,
    aStarPath
});
