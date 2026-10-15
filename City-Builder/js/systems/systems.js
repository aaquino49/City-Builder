import {
    sim,
} from '../core/state.js';

// Pixel Dominion — Systems Module (Incidents, Diplomacy, Audio, and Time Helpers)

// ===================== INCIDENTS =====================
const _BUILDING_HP = { house: 80, tower: 200, wall: 100, barracks: 150, farm: 80, lumberyard: 80, quarry: 120, mine: 150, archery_range: 100, ballista_tower: 200, academy: 150, monument: 1000, market: 120 };

function getMaxHP(key, tx, ty) {
    // Tier-2 bonus needs the tile: +100 wall (Stone Rampart), +150 gate (Iron-Bound).
    const isT2 = tx !== undefined && ty !== undefined && !!sim.tier2Upgrades[`${tx},${ty}`];
    if (key === 'gate') {
        let hp = gameState.upgrades?.reinforced_masonry ? 350 : 250;
        if (isT2) hp += 150;
        return hp;
    }
    let base = _BUILDING_HP[key] ?? 100;
    if (key === 'wall' && gameState.upgrades?.reinforced_masonry) {
        base += 100;
    }
    if (key === 'wall' && isT2) base += 100;
    return base;
}
export const _NON_BURNABLE = new Set(['obstacle_tree', 'rubble', 'stone_deposit', 'iron_vein']);

class IncidentManager {
    constructor() {
        this.active = null;
        this._nextTimer = 45 + Math.random() * 45;
    }

    // Post-raid grace period is intentionally shorter than the normal 45–90s
    // cadence so the peace after a raid isn't dead air for too long.
    resetTimer() { this._nextTimer = 30 + Math.random() * 30; }

    update(dtSec) {
        if (sim.gameIsPaused) return;
        const hasWalkingRaiders = raiders.some(r => r.state === 'walking');
        if (this.active) {
            this._updateActive(dtSec);
        } else if (!hasWalkingRaiders) {
            this._nextTimer -= dtSec;
            if (this._nextTimer <= 0) {
                this._nextTimer = 45 + Math.random() * 45;
                this._pickIncident();
            }
        }
    }

    _pickIncident() {
        const availableDiplomacy = _DIPLOMACY_POOL.filter(e => e.guard());
        let pool = [
            { type: 'fire',      weight: 25 },
            { type: 'drought',   weight: 20 * SEASON_MODIFIERS[SEASONS.indexOf(gameState.season)].droughtWeightMult },
            { type: 'merchant',  weight: 30 },
            { type: 'strike',    weight: 25 },
        ];
        if (availableDiplomacy.length > 0) pool.push({ type: 'diplomacy', weight: 30 });
        if (gameState.happiness >= 60) pool = pool.filter(e => e.type !== 'strike');
        if (!pool.length) return;
        const total = pool.reduce((s, e) => s + e.weight, 0);
        let rnd = Math.random() * total;
        let chosen = pool[pool.length - 1].type;
        for (const e of pool) { rnd -= e.weight; if (rnd <= 0) { chosen = e.type; break; } }
        this._startIncident(chosen);
    }

    _startIncident(type) {
        switch (type) {
            case 'fire':      this._startFire();      break;
            case 'drought':   this._startDrought();   break;
            case 'merchant':  this._startMerchant();  break;
            case 'strike':    this._startStrike();    break;
            case 'diplomacy': this._startDiplomacy(); break;
        }
    }

    _startFire() {
        const burnable = [];
        for (let ty = 0; ty < sim.grid.height; ty++)
            for (let tx = 0; tx < sim.grid.width; tx++) {
                const s = sim.grid.structures[ty][tx];
                if (s && !_NON_BURNABLE.has(s.def.key) && (s.progress ?? 1.0) >= 1.0) burnable.push({ tx, ty });
            }
        if (!burnable.length) return;
        const pick = burnable[Math.floor(Math.random() * burnable.length)];
        const s = sim.grid.structures[pick.ty][pick.tx];
        if (s.hp === undefined) s.hp = _BUILDING_HP[s.def.key] ?? 100;
        this.active = { type: 'fire', fires: [{ tx: pick.tx, ty: pick.ty, timer: 0 }], spreadTimer: 0, timer: 0, duration: 15 };
        showEventBanner('FIRE!', `A ${s.def.label ?? s.def.key} has caught fire!`);
        playFireSFX();
    }

    _startDrought() {
        this.active = { type: 'drought', timer: 0, duration: 30 };
        sim.droughtActive = true;
        showEventBanner('DROUGHT!', 'Farms are barren!');
        playDroughtSFX();
    }

    _startMerchant() {
        this.active = { type: 'merchant', timer: 0, duration: 180 };
        sim.merchantNPC = new MerchantNPC();
        showEventBanner('MERCHANT ARRIVAL!', 'A trader approaches your town...');
        playMerchantSFX();
    }

    _startStrike() {
        this.active = { type: 'strike', timer: 0, duration: 20 };
        sim.strikeActive = true;
        showEventBanner('WORKERS ON STRIKE!', 'Workers demand better conditions!');
        playStrikeSFX();
    }

    _updateActive(dtSec) {
        const a = this.active;
        a.timer += dtSec;
        switch (a.type) {
            case 'fire':      this._updateFire(dtSec);     break;
            case 'drought':   this._updateDrought(dtSec);  break;
            case 'merchant':  this._updateMerchant(dtSec); break;
            case 'strike':    this._updateStrike(dtSec);   break;
            case 'diplomacy': break; // resolved via modal choice
        }
        if (a.type !== 'fire' && a.type !== 'merchant' && a.type !== 'diplomacy' && a.timer >= a.duration) this._endIncident();
    }

    _startDiplomacy() {
        const available = _DIPLOMACY_POOL.filter(e => e.guard());
        if (!available.length) return;
        const event = available[Math.floor(Math.random() * available.length)];
        this.active = { type: 'diplomacy', event, timer: 0 };
        sim.gameIsPaused = true;
        showDiplomacyModal(event);
    }

    _updateFire(dtSec) {
        const a = this.active;
        a.spreadTimer += dtSec;
        for (let fi = a.fires.length - 1; fi >= 0; fi--) {
            const fire = a.fires[fi];
            fire.timer += dtSec;
            if (fire.timer >= 15) { a.fires.splice(fi, 1); continue; }
            let s = sim.grid.structures[fire.ty]?.[fire.tx];
            if (s && s.isChild) {
                const parentX = s.parentX;
                const parentY = s.parentY;
                s = sim.grid.structures[parentY]?.[parentX];
            }
            if (!s || _NON_BURNABLE.has(s.def.key)) { a.fires.splice(fi, 1); continue; }
            const fx = fire.tx * TILE_SIZE + TILE_SIZE / 2;
            const fy = fire.ty * TILE_SIZE + TILE_SIZE / 2;
            // Count ALL nearby citizens as firefighters (each reduces damage 25%; 4 = full extinguish)
            const firefightRange = 3 * TILE_SIZE;
            const firefighters = citizens.filter(c => c.job !== 'hiding' && Math.hypot(c.x - fx, c.y - fy) <= firefightRange).length;
            const damageMult = Math.max(0, 1 - firefighters * 0.25);
            s.hp = (s.hp ?? getMaxHP(s.def.key)) - 5 * dtSec * damageMult;
            if (Math.random() < dtSec * 0.4) playFireSFX();
            // Attract idle citizens within 10 tiles — throttled to avoid per-frame A* calls.
            // Only IDLE citizens respond: pulling workers created a tug-of-war where their
            // job state machine immediately re-pathed them back to the workplace.
            if (!s._fireAttractTimer || s._fireAttractTimer <= 0) {
                s._fireAttractTimer = 2.0;
                for (const c of citizens) {
                    if (c.job !== 'idle' || c.state === 'walking') continue;
                    const dist = Math.hypot(c.x - fx, c.y - fy);
                    if (dist <= 10 * TILE_SIZE && dist > firefightRange) {
                        const angle = Math.atan2(c.y - fy, c.x - fx);
                        const r = firefightRange * 0.9;
                        const destPX = Math.max(TILE_SIZE, Math.min((GRID_WIDTH - 1) * TILE_SIZE, fx + Math.cos(angle) * r + (Math.random() - 0.5) * TILE_SIZE));
                        const destPY = Math.max(TILE_SIZE, Math.min((GRID_HEIGHT - 1) * TILE_SIZE, fy + Math.sin(angle) * r + (Math.random() - 0.5) * TILE_SIZE));
                        const dTX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor(destPX / TILE_SIZE)));
                        const dTY = Math.max(0, Math.min(GRID_HEIGHT - 1, Math.floor(destPY / TILE_SIZE)));
                        c._navigateTo(dTX, dTY, sim.grid);
                    }
                }
            } else {
                s._fireAttractTimer -= dtSec;
            }
            if (s.hp <= 0) {
                const parentTX = s.isChild ? s.parentX : fire.tx;
                const parentTY = s.isChild ? s.parentY : fire.ty;
                delete sim.tier2Upgrades[`${parentTX},${parentTY}`];
                const w = s.def.width || 1;
                const h = s.def.height || 1;
                for (let dy = 0; dy < h; dy++) {
                    for (let dx = 0; dx < w; dx++) {
                        const cy = parentTY + dy;
                        const cx = parentTX + dx;
                        if (dx === 0 && dy === 0) {
                            sim.grid.structures[cy][cx] = { def: RUBBLE_DEF, decayTimer: DAY_DURATION };
                        } else {
                            sim.grid.structures[cy][cx] = null;
                        }
                    }
                }
                const p = getPooledParticle();
                p.x = fx; p.y = fy; p.type = 'puff'; p.timer = 0; p.duration = 0.5; p.alpha = 1.0;
                particles.push(p);
                triggerShake(5);
                window.patchStaticCache?.(parentTX, parentTY, w, h);
                rebuildStructureLists();
                a.fires.splice(fi, 1);
            }
        }
        if (a.spreadTimer >= 3) {
            a.spreadTimer = 0;
            if (Math.random() < 0.2 && a.fires.length > 0) {
                const src = a.fires[Math.floor(Math.random() * a.fires.length)];
                const candidates = [];
                for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                    if (!dx && !dy) continue;
                    const nx = src.tx + dx, ny = src.ty + dy;
                    if (!sim.grid.inBounds(nx, ny)) continue;
                    const s2 = sim.grid.structures[ny][nx];
                    if (!s2 || _NON_BURNABLE.has(s2.def.key)) continue;
                    // Under-construction buildings can't be ignited directly — don't
                    // let spread reach them either (was an inconsistency).
                    if ((s2.progress ?? 1.0) < 1.0) continue;
                    if (a.fires.some(f => f.tx === nx && f.ty === ny)) continue;
                    if (s2.hp === undefined) s2.hp = _BUILDING_HP[s2.def.key] ?? 100;
                    candidates.push({ tx: nx, ty: ny });
                }
                if (candidates.length) {
                    const pick = candidates[Math.floor(Math.random() * candidates.length)];
                    a.fires.push({ tx: pick.tx, ty: pick.ty, timer: 0 });
                }
            }
        }
        if (!a.fires.length) this._endIncident();
    }

    _updateDrought(dtSec) {
        // No direct happiness drain — calcHappiness already applies a Drought factor.
    }

    _updateMerchant(dtSec) {
        if (!sim.merchantNPC) { this._endIncident(); return; }
        if (!sim.gameIsPaused) sim.merchantNPC.update(dtSec);
        // return after ending — _endIncident() nulls this.active, and reading
        // this.active.timer afterwards threw a TypeError every merchant departure
        if (sim.merchantNPC.state === 'done') { sim.merchantNPC = null; this._endIncident(); return; }
        if (this.active.timer >= this.active.duration) { sim.merchantNPC = null; this._endIncident(); }
    }

    _updateStrike(dtSec) {
        if (gameState.happiness >= 60) { sim.strikeActive = false; this._endIncident(); }
    }

    _endIncident() {
        const type = this.active?.type;
        if (type === 'drought') sim.droughtActive = false;
        if (type === 'strike')  sim.strikeActive = false;
        if (type === 'merchant' && sim.merchantNPC) { sim.merchantNPC = null; }
        this.active = null;
    }

    serialize() {
        const s = { nextTimer: this._nextTimer, active: null };
        if (this.active) s.active = { ...this.active, fires: this.active.fires ? this.active.fires.map(f => ({ ...f })) : undefined };
        return s;
    }

    deserialize(data) {
        if (!data) return;
        this._nextTimer = data.nextTimer ?? 45;
        if (data.active) {
            this.active = data.active;
            if (data.active.type === 'drought') sim.droughtActive = true;
            if (data.active.type === 'strike')  sim.strikeActive = true;
        }
    }
}

// ===================== DIPLOMACY =====================
export const _DIPLOMACY_ACTION_MAP = {
    // Delayed diplomacy consequences mutate the shared simulation state.
    'raid': () => { sim.raidTimer = 0; },
    'raid_strong': () => { sim.raidTimer = 0; sim.raidStrength = Math.ceil(sim.raidStrength * 1.5); },
    'return_soldiers_10': () => {
        const cx = 32.5 * TILE_SIZE, cy = 32.5 * TILE_SIZE;
        for (let i = 0; i < 10; i++) soldiers.push(new Soldier(cx + (Math.random() - 0.5) * TILE_SIZE, cy + (Math.random() - 0.5) * TILE_SIZE));
        showEventBanner('SOLDIERS RETURNED', 'Your soldiers have returned from the western campaign!');
        window.markUIDirty(); // soldiers array changed; Proxy doesn't watch arrays, need explicit mark
    },
    'return_soldiers_5': () => {
        const cx = 32.5 * TILE_SIZE, cy = 32.5 * TILE_SIZE;
        for (let i = 0; i < 5; i++) soldiers.push(new Soldier(cx + (Math.random() - 0.5) * TILE_SIZE, cy + (Math.random() - 0.5) * TILE_SIZE));
        showEventBanner('SOLDIERS RETURNED', 'Your soldiers have returned from the royal campaign!');
        window.markUIDirty(); // soldiers array changed; Proxy doesn't watch arrays, need explicit mark
    },
};

// Diplomacy chain flags — earlier choices set flags here; follow-up events
// guard on them, so decisions echo later instead of every event being one-off.
const _dFlags = () => (gameState.diplomacyFlags ??= {});

function scheduleDiplomacyAction(actionKey, delayDays) {
    const action = _DIPLOMACY_ACTION_MAP[actionKey];
    if (!action) {
        console.warn(`[Pixel Dominion] Unknown diplomacy action: ${actionKey}`);
        return;
    }
    sim.diplomacyTimers.push({ remainingSec: delayDays * DAY_DURATION, actionKey, action });
}

// Decaying morale modifier so event happiness effects survive the 5s tax-tick
// recompute (calcHappiness reads it back) instead of being overwritten.
function adjustMorale(delta) {
    sim.moraleModifier = Math.max(-30, Math.min(30, sim.moraleModifier + delta));
    gameState.happiness = calcHappiness();
}

// Levy helper: removes up to n non-captain soldiers (from the end) so the
// unique Captain can never be conscripted away by diplomacy choices.
function _removeRegularSoldiers(n) {
    for (let i = soldiers.length - 1; i >= 0 && n > 0; i--) {
        if (!soldiers[i].isCaptain) { soldiers.splice(i, 1); n--; }
    }
}

const _DIPLOMACY_POOL = [
    {
        id: 'grain_trade',
        description: 'A neighbour to the north requests grain for their struggling villages.',
        guard: () => gameState.food >= 60,
        optionA: { label: 'Send Grain',      cost: '−50 Food  +30 Iron',
            apply: () => { gameState.food = Math.max(0, gameState.food - 50); gameState.iron += 30; } },
        optionB: { label: 'Refuse',           cost: 'Raid in 2 days',
            apply: () => scheduleDiplomacyAction('raid', 2) },
    },
    {
        id: 'soldier_levy',
        description: 'Your brother the western king needs soldiers to hold the frontier.',
        guard: () => soldiers.filter(s => !s.isCaptain).length >= 10,
        optionA: { label: 'Send Soldiers',    cost: '−10 Soldiers (14 days)  +200 Gold',
            apply: () => {
                _removeRegularSoldiers(10);
                gameState.gold += 200;
                scheduleDiplomacyAction('return_soldiers_10', 14);
                window.markUIDirty();
                // Proxy marks UI dirty on gameState.gold write; flushUI() syncs next frame
            }
        },
        optionB: { label: 'Decline',          cost: '−10 Happiness',
            apply: () => { adjustMorale(-10); } },
    },
    {
        id: 'noble_refuge',
        description: 'A noble fleeing his monarch requests sanctuary within your walls.',
        guard: () => true,
        optionA: { label: 'Grant Refuge',     cost: '+1 Folk  +50 Gold  Raid in 3 days',
            apply: () => {
                const cx = 32.5 * TILE_SIZE, cy = 32.5 * TILE_SIZE;
                citizens.push(new Citizen(cx, cy));
                gameState.population++;
                gameState.gold += 50;
                scheduleDiplomacyAction('raid', 3);
                _dFlags().noble_sheltered = true; // chain: noble_return
                // Proxy marks UI dirty on gold/population writes; flushUI() syncs next frame
            }
        },
        optionB: { label: 'Refuse',           cost: '−5 Happiness',
            apply: () => { adjustMorale(-5); } },
    },
    {
        id: 'safe_passage',
        description: 'Travelling merchants request safe passage through your territory.',
        guard: () => true,
        optionA: { label: 'Grant Passage',    cost: '+80 Gold  −5 Happiness',
            apply: () => {
                gameState.gold += 80;
                adjustMorale(-5);
            } },
        optionB: { label: 'Deny',             cost: 'Raid in 2 days',
            apply: () => scheduleDiplomacyAction('raid', 2) },
    },
    {
        id: 'rival_alliance',
        description: 'A rival city proposes a mutual non-aggression alliance.',
        guard: () => true,
        optionA: { label: 'Accept Alliance',  cost: 'Raids suppressed 1 season',
            apply: () => { sim.allianceTimer = SEASON_DURATION; } },
        optionB: { label: 'Reject',           cost: 'Raid in 2 days',
            apply: () => scheduleDiplomacyAction('raid', 2) },
    },
    {
        id: 'tribute_demand',
        description: 'A warlord to the east demands tribute or he will march on your city.',
        guard: () => true,
        optionA: { label: 'Pay Tribute',      cost: '−100 Gold  No attack',
            apply: () => {
                gameState.gold = Math.max(0, gameState.gold - 100);
                _dFlags().tribute_paid = true; // chain: warlord_returns
            } },
        optionB: { label: 'Refuse',           cost: '+50% Raid in 2 days',
            apply: () => scheduleDiplomacyAction('raid_strong', 2) },
    },
    {
        id: 'defecting_knight',
        description: 'A rival knight defects from his lord and requests asylum in your city.',
        guard: () => true,
        optionA: { label: 'Accept',           cost: '+1 Knight  Raid in 3 days',
            apply: () => {
                const cx = 32.5 * TILE_SIZE, cy = 32.5 * TILE_SIZE;
                knights.push(new Knight(cx, cy));
                scheduleDiplomacyAction('raid', 3);
                // Proxy marks UI dirty; flushUI() syncs next frame
            }
        },
        optionB: { label: 'Refuse',           cost: 'No effect', apply: () => {} },
    },
    {
        id: 'mercenary_company',
        description: 'A mercenary company offers their swords for hire.',
        guard: () => gameState.gold >= 150,
        optionA: { label: 'Hire Mercenaries', cost: '−150 Gold  +3 Soldiers',
            apply: () => {
                gameState.gold -= 150;
                const cx = 32.5 * TILE_SIZE, cy = 32.5 * TILE_SIZE;
                for (let i = 0; i < 3; i++) soldiers.push(new Soldier(cx + (Math.random() - 0.5) * TILE_SIZE, cy + (Math.random() - 0.5) * TILE_SIZE));
                // Proxy marks UI dirty on gameState.gold write; flushUI() syncs next frame
            }
        },
        optionB: { label: 'Decline',          cost: 'No effect', apply: () => {} },
    },
    {
        id: 'lost_caravan',
        description: 'A desperate merchant caravan offers to sell their goods at a discount.',
        guard: () => gameState.gold >= 80,
        optionA: { label: 'Buy Goods',        cost: '−80 Gold  +50 Food  +20 Wood',
            apply: () => {
                gameState.gold -= 80;
                gameState.food = Math.min(gameState.food + 50, getFoodCap());
                gameState.wood += 20;
            }
        },
        optionB: { label: 'Take By Force',    cost: '+30 Food  +10 Wood  −10 Happiness',
            apply: () => {
                gameState.food = Math.min(gameState.food + 30, getFoodCap());
                gameState.wood += 10;
                adjustMorale(-10);
            }
        },
    },
    {
        id: 'iron_shortage',
        description: "The local smith's guild is short on iron and petitions your stockpile.",
        guard: () => gameState.iron >= 20,
        optionA: { label: 'Send Iron',        cost: '−20 Iron  +120 Gold',
            apply: () => { gameState.iron = Math.max(0, gameState.iron - 20); gameState.gold += 120; } },
        optionB: { label: 'Decline',          cost: 'Soldier cost +50% for 3 days',
            apply: () => { sim.soldierCostMult = 1.5; sim.soldierCostTimer = 3 * DAY_DURATION; } },
    },
    {
        id: 'wandering_bard',
        description: 'A wandering bard arrives at your gates and requests to perform for your folk.',
        guard: () => true,
        optionA: { label: 'Allow Performance', cost: '+15 Happiness  −10 Food',
            apply: () => {
                adjustMorale(15);
                gameState.food = Math.max(0, gameState.food - 10);
            }
        },
        optionB: { label: 'Decline',          cost: 'No effect', apply: () => {} },
    },
    {
        id: 'harvest_festival',
        description: 'Nearby villages invite your city to join their harvest festival.',
        guard: () => gameState.food >= 30,
        optionA: { label: 'Participate',      cost: '−30 Food  +20 Happiness',
            apply: () => {
                gameState.food = Math.max(0, gameState.food - 30);
                adjustMorale(20);
                _dFlags().festival_friend = true; // chain: village_gift
            }
        },
        optionB: { label: 'Decline',          cost: '−8 Happiness',
            apply: () => { adjustMorale(-8); } },
    },
    {
        id: 'flood_warning',
        description: 'A messenger warns of a major flood upstream that will reach your food stores.',
        guard: () => gameState.wood >= 50,
        optionA: { label: 'Prepare Defences', cost: '−50 Wood  Food protected',
            apply: () => { gameState.wood = Math.max(0, gameState.wood - 50); } },
        optionB: { label: 'Ignore Warning',   cost: '−30% stored Food',
            apply: () => { gameState.food = Math.floor(gameState.food * 0.7); } },
    },
    {
        id: 'royal_decree',
        description: 'The distant king demands soldiers for his military campaign.',
        guard: () => soldiers.filter(s => !s.isCaptain).length >= 5,
        optionA: { label: 'Comply',           cost: '−5 Soldiers (10 days)  +300 Gold  +10 Happiness',
            apply: () => {
                _removeRegularSoldiers(5);
                gameState.gold += 300;
                adjustMorale(10);
                scheduleDiplomacyAction('return_soldiers_5', 10);
                window.markUIDirty();
                // Proxy marks UI dirty on gold/happiness writes; flushUI() syncs next frame
            }
        },
        optionB: { label: 'Refuse',           cost: '−8 Happiness',
            apply: () => { adjustMorale(-8); } },
    },
    // --- Chain follow-ups (unlocked by earlier choices) ---
    {
        id: 'noble_return',
        description: 'The noble you sheltered has reclaimed his lands, and returns to repay your kindness.',
        guard: () => _dFlags().noble_sheltered && !_dFlags().noble_returned,
        optionA: { label: 'Welcome Him',      cost: '+3 Soldiers  +100 Gold',
            apply: () => {
                _dFlags().noble_returned = true;
                const cx = 32.5 * TILE_SIZE, cy = 32.5 * TILE_SIZE;
                for (let i = 0; i < 3; i++) soldiers.push(new Soldier(cx + (Math.random() - 0.5) * TILE_SIZE, cy + (Math.random() - 0.5) * TILE_SIZE));
                gameState.gold += 100;
                window.markUIDirty();
            }
        },
        optionB: { label: 'Ask For Iron',     cost: '+40 Iron',
            apply: () => { _dFlags().noble_returned = true; gameState.iron += 40; } },
    },
    {
        id: 'warlord_returns',
        description: 'Emboldened by your earlier tribute, the eastern warlord returns demanding double.',
        guard: () => _dFlags().tribute_paid && !_dFlags().warlord_resolved,
        optionA: { label: 'Pay Again',        cost: '−200 Gold  No attack',
            apply: () => { _dFlags().warlord_resolved = true; gameState.gold = Math.max(0, gameState.gold - 200); } },
        optionB: { label: 'Never Again',      cost: '+50% Raid in 2 days',
            apply: () => { _dFlags().warlord_resolved = true; scheduleDiplomacyAction('raid_strong', 2); } },
    },
    {
        id: 'village_gift',
        description: 'The villages you feasted with send a gift caravan in thanks.',
        guard: () => _dFlags().festival_friend && !_dFlags().village_thanked,
        optionA: { label: 'Accept Gladly',    cost: '+40 Food  +40 Wood',
            apply: () => {
                _dFlags().village_thanked = true;
                gameState.food = Math.min(gameState.food + 40, getFoodCap());
                gameState.wood += 40;
            }
        },
        optionB: { label: 'Share With Folk',  cost: '+10 Happiness',
            apply: () => { _dFlags().village_thanked = true; adjustMorale(10); } },
    },
    {
        id: 'plague_refugees',
        description: 'Refugees fleeing a plague rumour beg for shelter within your walls.',
        guard: () => true,
        optionA: { label: 'Accept Refugees',  cost: '+2 Folk  +40 Gold  −8 Happiness',
            apply: () => {
                const cx = 32.5 * TILE_SIZE, cy = 32.5 * TILE_SIZE;
                citizens.push(new Citizen(cx, cy));
                citizens.push(new Citizen(cx, cy));
                gameState.population += 2;
                gameState.gold += 40;
                adjustMorale(-8);
                // Proxy marks UI dirty on population/gold/happiness writes; flushUI() syncs next frame
            }
        },
        optionB: { label: 'Turn Them Away',   cost: 'Raid in 1 day',
            apply: () => scheduleDiplomacyAction('raid', 1) },
    },
];

// ===================== AUDIO =====================
let _audioCtx = null;
let _masterGain = null;
let _musicGain  = null;
let _sfxGain    = null;
let _audioMuted = false;
let _raidWarningOsc = null;

// Settings persistence
const _SETTINGS_KEY = 'pixel_dominion_settings';
let _volMaster = 100; // 0–100
let _volMusic  = 70;
let _volSfx    = 100;

function _applyVolumes() {
    if (!_masterGain) return;
    _masterGain.gain.value = _audioMuted ? 0 : (_volMaster / 100);
    _musicGain.gain.value  = _volMusic  / 100;
    _sfxGain.gain.value    = _volSfx    / 100;
}

function _saveSettings() {
    try {
        localStorage.setItem(_SETTINGS_KEY, JSON.stringify({
            volMaster: _volMaster, volMusic: _volMusic, volSfx: _volSfx, muted: _audioMuted
        }));
    } catch (_) {}
}

function _loadSettings() {
    try {
        const raw = localStorage.getItem(_SETTINGS_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.volMaster !== undefined) _volMaster = s.volMaster;
        if (s.volMusic  !== undefined) _volMusic  = s.volMusic;
        if (s.volSfx    !== undefined) _volSfx    = s.volSfx;
        if (s.muted     !== undefined) _audioMuted = s.muted;
    } catch (_) {}
    // Sync slider DOM positions
    const masterEl = document.getElementById('vol-master');
    const musicEl  = document.getElementById('vol-music');
    const sfxEl    = document.getElementById('vol-sfx');
    if (masterEl) masterEl.value = _volMaster;
    if (musicEl)  musicEl.value  = _volMusic;
    if (sfxEl)    sfxEl.value    = _volSfx;
    // Sync mute button labels
    const muteBtn  = document.getElementById('btn-mute');
    const muteIcon = document.getElementById('btn-mute-icon');
    if (muteBtn)  muteBtn.textContent  = _audioMuted ? '♪ UNMUTE' : '♪ MUTE';
    if (muteIcon) muteIcon.textContent = _audioMuted ? '✕' : '♪';
}

function setVolume(kind, value) {
    // Single entry point so sliders/hotkeys always hit the module variables
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    if (kind === 'master') _volMaster = v;
    else if (kind === 'music') _volMusic = v;
    else if (kind === 'sfx') _volSfx = v;
    else return;
    _applyVolumes();
    _saveSettings();
}

function getVolume(kind) {
    if (kind === 'master') return _volMaster;
    if (kind === 'music') return _volMusic;
    if (kind === 'sfx') return _volSfx;
    return 0;
}

// Music scheduler state
let _musicTheme     = null;  // 'peace' | 'alert' | 'battle' | null
let _musicScheduler = null;
let _musicBeatIdx   = 0;
let _musicNextTime  = 0;

const _PEACE_CHORDS = [
    [261.63, 329.63, 392.00],
    [196.00, 246.94, 293.66],
    [220.00, 261.63, 329.63],
    [174.61, 220.00, 261.63],
];
const _ALERT_NOTES  = [220, 261.63, 329.63, 392.00, 440.00, 392.00, 329.63, 261.63];
const _BATTLE_BASS  = [110, 110, 146.83, 110, 130.81, 110, 146.83, 164.81];

function _getAudioCtx() {
    if (!_audioCtx) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        _masterGain = _audioCtx.createGain();
        _musicGain  = _audioCtx.createGain();
        _sfxGain    = _audioCtx.createGain();
        _masterGain.gain.value = _audioMuted ? 0 : (_volMaster / 100);
        _musicGain.gain.value  = _volMusic / 100;
        _sfxGain.gain.value    = _volSfx   / 100;
        _musicGain.connect(_masterGain);
        _sfxGain.connect(_masterGain);
        _masterGain.connect(_audioCtx.destination);
    }
    return _audioCtx;
}

function _playTone(type, freqStart, freqEnd, duration, gainLevel = 0.25) {
    if (!_audioCtx || _audioCtx.state !== 'running') return;
    const ac = _audioCtx;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);
    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(gain);
    gain.connect(_sfxGain);
    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + duration);
}

function _scheduleMusicBeat(ac) {
    if (_musicTheme === 'peace') {
        const chord = _PEACE_CHORDS[_musicBeatIdx % _PEACE_CHORDS.length];
        const dur = 1.6;
        chord.forEach(freq => {
            const osc = ac.createOscillator(); const g = ac.createGain();
            osc.type = _musicBeatIdx % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, _musicNextTime);
            g.gain.setValueAtTime(0, _musicNextTime);
            g.gain.linearRampToValueAtTime(0.06, _musicNextTime + 0.1);
            g.gain.setValueAtTime(0.06, _musicNextTime + dur - 0.3);
            g.gain.linearRampToValueAtTime(0, _musicNextTime + dur);
            osc.connect(g); g.connect(_musicGain);
            osc.onended = () => {
                osc.disconnect();
                g.disconnect();
            };
            osc.start(_musicNextTime); osc.stop(_musicNextTime + dur);
        });
        _musicBeatIdx = (_musicBeatIdx + 1) % _PEACE_CHORDS.length;
        _musicNextTime += dur;
    } else if (_musicTheme === 'alert') {
        const freq = _ALERT_NOTES[_musicBeatIdx % _ALERT_NOTES.length];
        const dur = 0.18;
        const osc = ac.createOscillator(); const g = ac.createGain();
        osc.type = _musicBeatIdx % 4 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, _musicNextTime);
        g.gain.setValueAtTime(0, _musicNextTime);
        g.gain.linearRampToValueAtTime(0.07, _musicNextTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, _musicNextTime + dur * 0.9);
        osc.connect(g); g.connect(_musicGain);
        osc.onended = () => {
            osc.disconnect();
            g.disconnect();
        };
        osc.start(_musicNextTime); osc.stop(_musicNextTime + dur);
        _musicBeatIdx++;
        _musicNextTime += dur;
    } else if (_musicTheme === 'battle') {
        const freq = _BATTLE_BASS[_musicBeatIdx % _BATTLE_BASS.length];
        const dur = 0.12;
        const osc = ac.createOscillator(); const g = ac.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, _musicNextTime);
        g.gain.setValueAtTime(0.12, _musicNextTime);
        g.gain.exponentialRampToValueAtTime(0.001, _musicNextTime + dur * 0.7);
        osc.connect(g); g.connect(_musicGain);
        osc.onended = () => {
            osc.disconnect();
            g.disconnect();
        };
        osc.start(_musicNextTime); osc.stop(_musicNextTime + dur);
        _musicBeatIdx++;
        _musicNextTime += dur;
    }
}

function _musicTick() {
    if (!_audioCtx || _audioCtx.state !== 'running' || !_musicTheme) return;
    const ac = _audioCtx;
    // Resync if scheduler fell behind (e.g., context was suspended)
    if (_musicNextTime < ac.currentTime - 1.5) _musicNextTime = ac.currentTime;
    while (_musicNextTime < ac.currentTime + 0.2) _scheduleMusicBeat(ac);
}

function setMusicTheme(theme) {
    if (_musicTheme === theme) return;
    _musicTheme = theme;
    _musicBeatIdx = 0;
    _musicNextTime = _getAudioCtx().currentTime + 0.05;
    if (!_musicScheduler) _musicScheduler = setInterval(_musicTick, 50);
}

function stopMusic() {
    _musicTheme = null;
    if (_musicScheduler) { clearInterval(_musicScheduler); _musicScheduler = null; }
}

function updateMusicTheme() {
    if (!gameState.started) return;
    const hasActiveRaiders = sim.raidActive || raiders.some(r => r.state === 'walking');
    if (hasActiveRaiders) { setMusicTheme('battle'); return; }
    if (sim.scoutPhase || (sim.raidTimer <= 30 && sim.raidTimer > 0)) { setMusicTheme('alert'); return; }
    setMusicTheme('peace');
}

function playBuildSFX()    { _playTone('triangle', 150, 350, 0.1, 0.3); }
function playDemolishSFX() { _playTone('sawtooth', 350, 50, 0.15, 0.25); }
function playTaxSFX()      { _playTone('sine', 988, 1200, 0.08, 0.2); }
function playChopSFX()     { _playTone('triangle', 180, 60, 0.08, 0.35); }
function playRoadSFX() {
    _playTone('triangle', 440, 600, 0.05, 0.25);
    _playTone('triangle', 500, 800, 0.05, 0.20);
}

function playRaidWarningSFX() {
    if (_raidWarningOsc) return;
    const ac = _getAudioCtx();
    const now = ac.currentTime;
    _raidWarningOsc = { stop: () => {}, disconnect: () => {} };
    const pattern = [220, 261.63, 329.63, 392.0, 329.63, 440.0, 392.0, 329.63];
    pattern.forEach((freq, i) => {
        const t = now + i * 0.11;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(g);
        g.connect(_musicGain);
        osc.onended = () => {
            osc.disconnect();
            g.disconnect();
        };
        osc.start(t);
        osc.stop(t + 0.18);
    });
    setTimeout(() => { _raidWarningOsc = null; }, 1200);
}

function stopRaidWarningSFX() {
    if (_raidWarningOsc) {
        try { _raidWarningOsc.stop(); } catch (_) {}
        _raidWarningOsc.disconnect();
        _raidWarningOsc = null;
    }
}

function playRaidResultSFX(isVictory) {
    _getAudioCtx();
    stopRaidWarningSFX();
    const notes = isVictory ? [523.25, 659.25, 783.99, 1046.50] : [392.00, 311.13, 261.63];
    const waveType = isVictory ? 'triangle' : 'sawtooth';
    const spacing = isVictory ? 0.13 : 0.22;
    notes.forEach((freq, i) => {
        const t = _audioCtx.currentTime + i * spacing;
        const osc = _audioCtx.createOscillator();
        const gain = _audioCtx.createGain();
        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(isVictory ? 0.3 : 0.25, t);
        gain.gain.linearRampToValueAtTime(0, t + spacing - 0.01);
        osc.connect(gain);
        gain.connect(_sfxGain);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + spacing);
    });
}

function toggleMute() {
    _audioMuted = !_audioMuted;
    _applyVolumes();
    _saveSettings();
    return _audioMuted;
}

function playShootSFX()      { _playTone('square', 1200, 400, 0.05, 0.2); }
function playEnemyDeathSFX() { _playTone('triangle', 400, 100, 0.05, 0.25); }

function playVictorySFX() {
    const ac = _getAudioCtx();
    const now = ac.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    const spacing = 0.15;
    notes.forEach((freq, i) => {
        const t = now + i * spacing;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.connect(gain);
        gain.connect(_sfxGain);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + 0.45);
    });
}

function playDefeatSFX() {
    const ac = _getAudioCtx();
    const now = ac.currentTime;
    const notes = [523.25, 466.16, 369.99, 311.13, 261.63];
    const spacing = 0.2;
    notes.forEach((freq, i) => {
        const t = now + i * spacing;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.connect(gain);
        gain.connect(_sfxGain);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + 0.55);
    });
}

function playResearchCompleteSFX() {
    const ac = _getAudioCtx();
    const now = ac.currentTime;
    const notes = [392.00, 523.25, 659.25, 783.99];
    const spacing = 0.1;
    notes.forEach((freq, i) => {
        const t = now + i * spacing;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.connect(gain);
        gain.connect(_sfxGain);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + 0.35);
    });
}

function playTrainSFX() {
    const ac = _getAudioCtx();
    [523, 659, 783].forEach((freq, i) => {
        const t = ac.currentTime + i * 0.07;
        const osc = ac.createOscillator(); const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.07);
        osc.connect(gain); gain.connect(_sfxGain);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        osc.start(t); osc.stop(t + 0.07);
    });
}

function playRubbleSFX() {
    _playTone('sawtooth', 120, 40, 0.12, 0.3);
    _playTone('sawtooth', 80,  20, 0.08, 0.15);
}

function playErrorSFX() {
    _playTone('square', 150, 100, 0.15, 0.25);
}

function playExpansionSFX() {
    const ac = _getAudioCtx();
    const now = ac.currentTime;
    const notes = [523.25, 659.25, 783.99];
    const duration = 0.25;
    const spacing = duration / notes.length;
    notes.forEach((freq, i) => {
        const t = now + i * spacing;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.linearRampToValueAtTime(0, t + spacing);
        osc.connect(gain);
        gain.connect(_sfxGain);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + spacing);
    });
}

function playClankSFX() {
    _playTone('sawtooth', 300, 200, 0.06, 0.3);
    _playTone('triangle', 180, 120, 0.04, 0.2);
}

function playTapSFX() {
    _playTone('triangle', 800, 600, 0.04, 0.18);
}

function playArrowSFX() { _playTone('triangle', 900, 300, 0.05, 0.18); }

function playBallistaSFX() {
    _playTone('sawtooth', 200, 80, 0.18, 0.4);
    _playTone('triangle', 150, 50, 0.1, 0.25);
}

function playFireSFX() {
    try {
        const ac = _getAudioCtx();
        const bufLen = Math.floor(ac.sampleRate * 0.3);
        const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(); src.buffer = buf;
        const filt = ac.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 0.8;
        const gain = ac.createGain(); gain.gain.setValueAtTime(0.12, ac.currentTime); gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3);
        const lfo = ac.createOscillator(); lfo.frequency.value = 4 + Math.random() * 3;
        const lfoG = ac.createGain(); lfoG.gain.value = 0.04;
        lfo.connect(lfoG); lfoG.connect(gain.gain);
        src.connect(filt); filt.connect(gain); gain.connect(_sfxGain);
        src.onended = () => {
            src.disconnect();
            filt.disconnect();
            gain.disconnect();
            lfo.disconnect();
            lfoG.disconnect();
        };
        src.start(); src.stop(ac.currentTime + 0.3); lfo.start(); lfo.stop(ac.currentTime + 0.3);
    } catch (_) {}
}

function playDroughtSFX() {
    try {
        const ac = _getAudioCtx();
        const bufLen = ac.sampleRate;
        const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
        const d = buf.getChannelData(0);
        let b = 0;
        for (let i = 0; i < bufLen; i++) { b = 0.99 * b + 0.01 * (Math.random() * 2 - 1); d[i] = b * 3.5; }
        const src = ac.createBufferSource(); src.buffer = buf;
        const filt = ac.createBiquadFilter(); filt.type = 'bandpass';
        filt.frequency.setValueAtTime(200, ac.currentTime);
        filt.frequency.linearRampToValueAtTime(600, ac.currentTime + 1.0); filt.Q.value = 0.3;
        const gain = ac.createGain(); gain.gain.setValueAtTime(0.1, ac.currentTime);
        gain.gain.setValueAtTime(0.07, ac.currentTime + 0.5); gain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.0);
        src.connect(filt); filt.connect(gain); gain.connect(_sfxGain);
        src.onended = () => {
            src.disconnect();
            filt.disconnect();
            gain.disconnect();
        };
        src.start(); src.stop(ac.currentTime + 1.0);
    } catch (_) {}
}

function playMerchantSFX() {
    const ac = _getAudioCtx();
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const t = ac.currentTime + i * 0.3;
        const osc = ac.createOscillator(); const gain = ac.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.28, t); gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.connect(gain); gain.connect(_sfxGain);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        osc.start(t); osc.stop(t + 0.3);
    });
}

function playStrikeSFX() {
    const ac = _getAudioCtx();
    [100, 150, 130, 180, 120, 200, 250].forEach(freq => {
        const t = ac.currentTime;
        const osc = ac.createOscillator(); const gain = ac.createGain();
        osc.type = 'sine'; osc.frequency.value = freq + (Math.random() - 0.5) * 20;
        gain.gain.setValueAtTime(0.05, t); gain.gain.linearRampToValueAtTime(0, t + 0.8);
        osc.connect(gain); gain.connect(_sfxGain);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        osc.start(t); osc.stop(t + 0.8);
    });
}

// Camera Shake
function triggerShake(intensity) {
    sim.shakeIntensity = Math.max(sim.shakeIntensity, intensity);
}

function updateCameraShake() {
    if (sim.shakeIntensity < 0.1) { sim.shakeIntensity = 0; sim.shakeX = 0; sim.shakeY = 0; return; }
    sim.shakeX = (Math.random() * 2 - 1) * sim.shakeIntensity;
    sim.shakeY = (Math.random() * 2 - 1) * sim.shakeIntensity;
    sim.shakeIntensity *= 0.9;
}

// Floating text helper
function spawnFloat(x, y, text, color, duration) {
    const p = getPooledParticle();
    p.x = x; p.y = y; p.type = 'floating_text'; p.text = text; p.color = color; p.timer = 0; p.duration = duration ?? 1.0; p.alpha = 1.0;
    p.driftX = (Math.random() - 0.5) * 12; // spread stacked numbers apart
    particles.push(p);
}

// Event banner
export function showEventBanner(title, desc) {
    // Chronicle feed: newest-first cap handled by readers; keep the log bounded.
    sim.eventLog.push({ day: gameState.day, season: gameState.season, title, desc });
    if (sim.eventLog.length > 80) sim.eventLog.splice(0, sim.eventLog.length - 80);
    // Queue instead of showing immediately, so back-to-back events are all readable.
    queueBanner({ kind: 'event', title, desc });
}

// ---- Shared banner queue (events + expansion) ----
// One banner at a time; uses setTimeout so it keeps running while the game is paused.
let _bannerQueue = [];
let _bannerShowing = false;
let _bannerSeq = 0;
// These urgent titles cut the line (front of the waiting queue).
const _BANNER_PRIORITY = ['RAID WAVE', 'SCOUTS SPOTTED', 'FIRE!', 'CAMP DESTROYED'];

export function queueBanner(item) {
    if (!item) return;
    // Collapse a duplicate title that is still waiting (never the one showing).
    if (item.title && _bannerQueue.some(q => q.title === item.title)) return;
    // Expansion banners carry no title — collapse on kind instead.
    if (item.kind === 'expansion' && _bannerQueue.some(q => q.kind === 'expansion')) return;
    item._seq = ++_bannerSeq;
    const priority = item.title && _BANNER_PRIORITY.some(p => item.title.startsWith(p));
    if (priority) _bannerQueue.unshift(item);
    else _bannerQueue.push(item);
    // Cap the waiting queue at 4, dropping the oldest waiting item (smallest seq).
    while (_bannerQueue.length > 4) {
        let oldest = 0;
        for (let i = 1; i < _bannerQueue.length; i++) {
            if (_bannerQueue[i]._seq < _bannerQueue[oldest]._seq) oldest = i;
        }
        _bannerQueue.splice(oldest, 1);
    }
    _pumpBannerQueue();
}

function _pumpBannerQueue() {
    if (_bannerShowing) return;
    const item = _bannerQueue.shift();
    if (!item) return;
    _bannerShowing = true;
    const hasMore = _bannerQueue.length > 0;
    // Longer display when nothing else waits, shorter when sharing time.
    const dur = item.kind === 'expansion' ? 1500 : (hasMore ? 2200 : 4000);
    if (item.kind === 'expansion') {
        if (typeof window._showExpansionBannerDOM === 'function') window._showExpansionBannerDOM(dur);
    } else {
        _showEventBannerDOM(item.title, item.desc, dur);
    }
    if (sim.bannerTimeout) clearTimeout(sim.bannerTimeout);
    // Advance after the display time plus the 0.5s fade-out transition.
    sim.bannerTimeout = setTimeout(() => {
        sim.bannerTimeout = null;
        _bannerShowing = false;
        _pumpBannerQueue();
    }, dur + 500);
}

// Show/hide the event banner DOM for the given duration (fade matches old behaviour).
function _showEventBannerDOM(title, desc, durationMs) {
    const banner = document.getElementById('event-banner');
    const titleEl = document.getElementById('event-banner-title');
    const descEl  = document.getElementById('event-banner-desc');
    if (!banner) return;
    if (titleEl) titleEl.textContent = title;
    if (descEl)  descEl.textContent  = desc;
    banner.style.transition = 'none';
    banner.style.opacity = '0';
    banner.style.display = 'flex';
    banner.offsetHeight;
    banner.style.transition = 'opacity 0.5s ease';
    banner.style.opacity = '1';
    setTimeout(() => {
        banner.style.opacity = '0';
        setTimeout(() => { if (banner.style.opacity === '0') banner.style.display = 'none'; }, 500);
    }, durationMs);
}

// Stats overlay
function toggleStatsOverlay() {
    sim.statsOverlayVisible = !sim.statsOverlayVisible;
    const overlay = document.getElementById('stats-overlay');
    if (overlay) overlay.classList.toggle('visible', sim.statsOverlayVisible);
    if (sim.statsOverlayVisible) updateStatsOverlay();
}

function updateStatsOverlay() {
    const overlay = document.getElementById('stats-overlay');
    if (!overlay || !sim.statsOverlayVisible) return;
    const farmers   = citizens.filter(c => c.job === 'farmer').length;
    const cutters   = citizens.filter(c => c.job === 'woodcutter').length;
    const stoneMins = citizens.filter(c => c.job === 'stone_miner').length;
    const ironMins  = citizens.filter(c => c.job === 'iron_miner').length;
    const builders  = citizens.filter(c => c.job === 'builder').length;
    const citizenCount = gameState.happiness < 40 ? Math.floor(gameState.population * 0.5) : gameState.population;
    const baseTax = citizenCount * (ECONOMY_BALANCE?.baseGoldPerCitizen ?? 1);
    const tradeBonus = gameState.upgrades?.trade_guilds ? Math.floor(citizenCount * ECONOMY_BALANCE.tradeGuildsGoldPerCitizen) : 0;
    const upkeep = soldiers.filter(s => !s.isMilitia).length * (ECONOMY_BALANCE?.militaryUpkeep?.soldier ?? 2)
                 + archers.length  * (ECONOMY_BALANCE?.militaryUpkeep?.archer ?? 2)
                 + knights.length  * (ECONOMY_BALANCE?.militaryUpkeep?.knight ?? 3);
    const taxPerMin = Math.round((baseTax + tradeBonus - upkeep) / TAX_INTERVAL * 60);
    // Real production math (was hardcoded estimates that misinformed the player)
    const seasonMod = SEASON_MODIFIERS[SEASONS.indexOf(gameState.season)];
    const PB = window.PRODUCTION_BALANCE || {};
    const cycleSec = PB.farmCycleSec ?? 2.0;
    const cropRotation = !!gameState.upgrades?.crop_rotation;
    const workerFoodPerCycle = (PB.farmBaseFoodPerCycle ?? 13.5) * seasonMod.foodYieldMult + (cropRotation ? 2 : 0);
    const passivePerFarmCycle = (PB.farmPassiveFoodPerCycle ?? 2.25) + (cropRotation ? 0.5 : 0);
    const farmCount = sim.activeFarms?.length ?? 0;
    const foodProdPerMin = sim.droughtActive ? 0 : Math.round(
        farmers * workerFoodPerCycle * (60 / cycleSec) +
        farmCount * passivePerFarmCycle * (60 / cycleSec));
    const militaryCount = soldiers.length + archers.length + knights.length;
    let _drainMult = seasonMod.foodDrainMult;
    if (gameState.season === 'Winter' && gameState.upgrades?.preserved_stores) _drainMult = 1.75;
    const foodDrainPerMin = Math.round((gameState.population + militaryCount) * _drainMult / TAX_INTERVAL * 60);
    const foodPerMin = `+${foodProdPerMin} / -${foodDrainPerMin}`;
    // Gather trips vary with travel distance — estimate from a typical round trip
    const tripSec = PB.gatherTripSecEstimate ?? 8;
    const woodPerMin = Math.round(cutters * 10 * seasonMod.woodYieldMult * (60 / tripSec));
    const stonePerMin = Math.round(stoneMins * 10 * (60 / tripSec));
    const ironPerMin = Math.round(ironMins * 10 * (60 / tripSec));
    overlay.innerHTML = `
        <div class="stats-panel">
            <div class="stats-panel-title">REALM LEDGER · ${gameState.season} Day ${gameState.day}</div>
            <div class="stats-ledger-grid">
                <div class="ledger-row"><span class="ledger-label">Citizens</span><span class="ledger-value">${citizens.length} / ${gameState.housing}</span></div>
                <div class="ledger-row"><span class="ledger-label">Builders</span><span class="ledger-value">${builders}</span></div>
                <div class="ledger-row"><span class="ledger-label">Soldiers</span><span class="ledger-value">${soldiers.length}</span></div>
                <div class="ledger-row"><span class="ledger-label">Archers</span><span class="ledger-value">${archers.length}</span></div>
                <div class="ledger-row"><span class="ledger-label">Knights</span><span class="ledger-value">${knights.length}</span></div>
                <div class="ledger-row"><span class="ledger-label">Happiness</span><span class="ledger-value positive">${gameState.happiness.toFixed(0)}%</span></div>
                <div class="ledger-row"><span class="ledger-label">Defense</span><span class="ledger-value">${gameState.defense}</span></div>
                <div class="ledger-row"><span class="ledger-label">Next Raid</span><span class="ledger-value">${formatTime(sim.raidTimer)}</span></div>
            </div>
            <div class="stats-income-title">PRODUCTION · PER MINUTE</div>
            <div class="stats-income-grid">
                <div class="ledger-row"><span class="ledger-label">Gold</span><span class="ledger-value positive">${taxPerMin >= 0 ? '+' : ''}${taxPerMin}</span></div>
                <div class="ledger-row"><span class="ledger-label">Food</span><span class="ledger-value positive">${foodPerMin}${sim.droughtActive ? ' (drought)' : ''}</span></div>
                <div class="ledger-row"><span class="ledger-label">Wood</span><span class="ledger-value positive">${cutters > 0 ? '≈+' + woodPerMin : '0'}</span></div>
                <div class="ledger-row"><span class="ledger-label">Stone</span><span class="ledger-value positive">${stoneMins > 0 ? '≈+' + stonePerMin : '0'}</span></div>
                <div class="ledger-row"><span class="ledger-label">Iron</span><span class="ledger-value positive">${ironMins > 0 ? '≈+' + ironPerMin : '0'}</span></div>
            </div>
            <div class="stats-footer">[TAB] to close</div>
        </div>
    `;
}

// Trade modal
const _TRADE_POOL = [
    { label: 'Buy 50 Wood',     cost: '-30 Gold',           canDo: gs => gs.gold >= 30,             apply: gs => { gs.gold -= 30;  gs.wood += 50; } },
    { label: 'Sell 20 Iron',    cost: '+60 Gold  -20 Iron', canDo: gs => gs.iron >= 20,             apply: gs => { gs.gold += 60;  gs.iron -= 20; } },
    { label: 'Buy 100 Food',    cost: '-40 Gold',           canDo: gs => gs.gold >= 40,             apply: gs => { gs.gold -= 40;  gs.food += 100; gs.food = Math.min(gs.food, getFoodCap()); } },
    { label: 'Buy 30 Stone',    cost: '-25 Gold',           canDo: gs => gs.gold >= 25,             apply: gs => { gs.gold -= 25;  gs.stone += 30; } },
    { label: 'Sell 30 Wood',    cost: '+15 Gold  -30 Wood', canDo: gs => gs.wood >= 30,             apply: gs => { gs.gold += 15;  gs.wood -= 30; } },
    { label: 'Buy 25 Iron',     cost: '-100 Gold',          canDo: gs => gs.gold >= 100,            apply: gs => { gs.gold -= 100; gs.iron += 25; } },
    { label: 'Sell 5 Iron',     cost: '+15 Gold  -5 Iron',  canDo: gs => gs.iron >= 5,              apply: gs => { gs.gold += 15;  gs.iron -= 5; } },
    { label: 'Buy Provisions',  cost: '-50 Gold  +50 Food +20 Wood', canDo: gs => gs.gold >= 50,   apply: gs => { gs.gold -= 50;  gs.food += 50; gs.food = Math.min(gs.food, getFoodCap()); gs.wood += 20; } },
];

function openTradeModal() {
    // Deals are chosen once per merchant visit so reopening can't re-roll them.
    let deals;
    if (sim.merchantNPC) {
        if (!sim.merchantNPC.deals) {
            const idxs = [..._TRADE_POOL.keys()].sort(() => Math.random() - 0.5).slice(0, 3);
            sim.merchantNPC.deals = idxs.map(idx => ({ idx, done: false }));
        }
        deals = sim.merchantNPC.deals;
    } else {
        const shuffled = [..._TRADE_POOL.keys()].sort(() => Math.random() - 0.5);
        deals = shuffled.slice(0, 3).map(idx => ({ idx, done: false }));
    }
    const dealsEl = document.getElementById('trade-deals');
    if (!dealsEl) return;
    dealsEl.innerHTML = deals.map((e, i) => {
        const d = _TRADE_POOL[e.idx];
        return `
        <div class="trade-deal-row">
            <button class="trade-deal-btn" data-deal="${i}"${e.done ? ' disabled' : ''}>${e.done ? 'DONE' : 'ACCEPT'}</button>
            <div class="trade-deal-info">
                <div class="trade-deal-label">${d.label}</div>
                <div class="trade-deal-cost">${d.cost}</div>
            </div>
        </div>`;
    }).join('');
    document.querySelectorAll('.trade-deal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.deal);
            const entry = deals[idx];
            const deal = entry && _TRADE_POOL[entry.idx];
            if (!deal || entry.done) return;
            if (deal.canDo(gameState)) {
                deal.apply(gameState);
                entry.done = true;
                btn.textContent = 'DONE'; btn.disabled = true;
                // Proxy marks UI dirty on any gameState resource mutation; flushUI() syncs next frame
            } else {
                btn.textContent = 'CAN\'T'; btn.disabled = true;
            }
        });
    });
    sim.gameIsPaused = true;
    document.getElementById('trade-modal').classList.add('open');
}

function _restartMusic() {
    // Stop the old scheduler and force a clean restart from current time.
    if (_musicScheduler) { clearInterval(_musicScheduler); _musicScheduler = null; }
    _musicTheme = null;
    _musicBeatIdx = 0;
    _musicNextTime = _audioCtx.currentTime + 0.05;
    updateMusicTheme();
}

let _audioInitialized = false;
function initAudio() {
    const ac = _getAudioCtx();
    if (ac.state === 'running') {
        _restartMusic();
    } else {
        ac.resume().then(_restartMusic).catch(() => {});
    }
    // Play a silent buffer to unlock audio on all browsers
    try {
        const buf = ac.createBuffer(1, 1, ac.sampleRate);
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(_masterGain);
        src.start(0);
    } catch (_) {}
    // Re-unlock on any subsequent interaction — register once only
    if (!_audioInitialized) {
        _audioInitialized = true;
        const onInteract = () => {
            if (!_audioCtx) return;
            if (_audioCtx.state === 'suspended') {
                _audioCtx.resume().then(_restartMusic).catch(() => {});
            }
        };
        document.addEventListener('click', onInteract);
        document.addEventListener('keydown', onInteract);
    }
}


// ===================== DAY PHASE HELPER =====================
export function _getDayPhase(t) {
    if (t < 12) return 'dawn';
    if (t < 42) return 'day';
    if (t < 52) return 'dusk';
    return 'night';
}

// Bind to window for global legacy compatibility
Object.assign(window, {
    getMaxHP, IncidentManager, _DIPLOMACY_ACTION_MAP, _DIPLOMACY_POOL,
    adjustMorale,
    _getDayPhase, toggleStatsOverlay, showEventBanner, queueBanner, _NON_BURNABLE,
    // Audio globals and API
    _audioCtx, _masterGain, _musicGain, _sfxGain, _raidWarningOsc,
    _applyVolumes, _saveSettings, _loadSettings, setVolume, getVolume,
    playArrowSFX, playBallistaSFX, playTapSFX, playBuildSFX, playDemolishSFX,
    playTaxSFX, playChopSFX, playRoadSFX, playRaidWarningSFX, playRaidResultSFX,
    playShootSFX, playEnemyDeathSFX, playVictorySFX, playDefeatSFX,
    playResearchCompleteSFX, playTrainSFX, playRubbleSFX, playErrorSFX,
    playExpansionSFX, playClankSFX, playFireSFX, playDroughtSFX,
    playMerchantSFX, playStrikeSFX,
    initAudio, _restartMusic, updateMusicTheme, stopRaidWarningSFX,
    updateCameraShake, triggerShake, spawnFloat,
    toggleMute, openTradeModal, updateStatsOverlay
});
