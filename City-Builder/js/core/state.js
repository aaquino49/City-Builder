// Pixel Dominion — State & Settings Module
import { rebuildStructureLists, _buildGrassCache, _buildStaticCache, refreshUI, updateRaidHUD, updateCombatModeUI, _updateDayPhaseGlyph, updateDaySeason } from '../ui/ui.js';
import { showEventBanner } from '../systems/systems.js';
import { Citizen, Soldier, Archer, Knight, MerchantNPC, Raider } from '../entities/entities.js';

// ===================== CONSTANTS & DEFS =====================
export const TILE_SIZE = 32;
export const GRID_WIDTH = 64;
export const GRID_HEIGHT = 64;

export const BUILDINGS = {
    house:          { key: 'house',          label: 'HOUSE',         cost: 50,  woodCost: 0,  ironCost: 0,  stoneCost: 0,  housing: 4,  defense: 0,  food: 0,  assetKey: 'building_house',         color: '#d9534f', maxWorkers: 0 },
    tower:          { key: 'tower',          label: 'TOWER',         cost: 150, woodCost: 0,  ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 10, food: 0,  assetKey: 'building_tower',         color: '#0275d8', maxWorkers: 0 },
    wall:           { key: 'wall',           label: 'WALL',          cost: 5,   woodCost: 2,  ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 2,  food: 0,  assetKey: 'building_wall',          color: '#777777', maxWorkers: 0 },
    barracks:       { key: 'barracks',       label: 'BARRACKS',      cost: 200, woodCost: 0,  ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 10, food: 0,  assetKey: 'building_barracks',      color: '#6d4c41', maxWorkers: 0 },
    farm:           { key: 'farm',           label: 'FARM',          cost: 80,  woodCost: 0,  ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 0,  food: 10, assetKey: 'building_farm',          color: '#f0ad4e', maxWorkers: 3 },
    lumberyard:     { key: 'lumberyard',     label: 'LUMBER YARD',   cost: 60,  woodCost: 0,  ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 0,  food: 0,  assetKey: 'building_lumberyard',    color: '#8B6914', maxWorkers: 3 },
    quarry:         { key: 'quarry',         label: 'QUARRY',        cost: 100, woodCost: 20, ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 0,  food: 0,  assetKey: 'building_quarry',        color: '#7a6a5a', maxWorkers: 3 },
    mine:           { key: 'mine',           label: 'MINE',          cost: 150, woodCost: 50, ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 0,  food: 0,  assetKey: 'building_mine',          color: '#4a4a4a', maxWorkers: 2 },
    gate:           { key: 'gate',           label: 'GATE',          cost: 15,  woodCost: 10, ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 3,  food: 0,  assetKey: 'building_gate_open',     color: '#8B7355', maxWorkers: 0 },
    archery_range:  { key: 'archery_range',  label: 'ARCHERY RANGE', cost: 80,  woodCost: 30, ironCost: 10, stoneCost: 0,  housing: 0,  defense: 0,  food: 0,  assetKey: 'building_archery_range', color: '#4a6a3a', maxWorkers: 0 },
    ballista_tower: { key: 'ballista_tower', label: 'BALLISTA TWR',  cost: 150, woodCost: 40, ironCost: 20, stoneCost: 0,  housing: 0,  defense: 15, food: 0,  assetKey: 'building_ballistatower', color: '#4a3a2a', maxWorkers: 0 },
    academy:        { key: 'academy',        label: 'ACADEMY',       cost: 200, woodCost: 50,  ironCost: 0,  stoneCost: 50,  housing: 0,  defense: 0,  food: 0,  assetKey: 'building_academy',       color: '#9c27b0', maxWorkers: 0 },
    monument:       { key: 'monument',       label: 'MONUMENT',      cost: 2000, woodCost: 500, ironCost: 100, stoneCost: 300, housing: 0,  defense: 0,  food: 0,  assetKey: 'building_monument',      color: '#00bcd4', maxWorkers: 0, width: 2, height: 2 },
    granary:        { key: 'granary',        label: 'GRANARY',       cost: 80,  woodCost: 30, ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 0,  food: 0,  assetKey: 'building_granary',       color: '#8B6914', maxWorkers: 0 },
    tavern:         { key: 'tavern',         label: 'TAVERN',        cost: 120, woodCost: 40, ironCost: 0,  stoneCost: 0,  housing: 0,  defense: 0,  food: 0,  assetKey: 'building_tavern',        color: '#b8860b', maxWorkers: 0 },
};

export const DIFFICULTY_PRESETS = Object.freeze({
    settler: Object.freeze({
        key: 'settler',
        label: 'Settler',
        monumentCost: Object.freeze({ gold: 1800, wood: 450, stone: 250, iron: 80 }),
        raidStrengths: Object.freeze([10, 15, 22, 30, 40, 52, 66, 82, 100, 122]),
    }),
    lord: Object.freeze({
        key: 'lord',
        label: 'Lord',
        monumentCost: Object.freeze({ gold: 2000, wood: 500, stone: 300, iron: 100 }),
        raidStrengths: Object.freeze([12, 18, 26, 36, 48, 62, 78, 96, 118, 145]),
    }),
    iron_crown: Object.freeze({
        key: 'iron_crown',
        label: 'Iron Crown',
        monumentCost: Object.freeze({ gold: 2400, wood: 650, stone: 400, iron: 140 }),
        raidStrengths: Object.freeze([14, 22, 32, 45, 60, 78, 98, 122, 150, 185]),
    }),
});
export const DEFAULT_DIFFICULTY_KEY = 'lord';

export const TREE_DEF = { key: 'obstacle_tree', assetKey: 'obstacle_tree', color: '#2d5a1b', housing: 0, food: 0, defense: 0, cost: 0 };
export const TREE_SPAWN_CHANCE = 0.05;
export const ROAD_DEF   = { key: 'road',   assetKey: 'tile_road',        color: '#888888', housing: 0, food: 0, defense: 0, cost: 5 };
export const RUBBLE_DEF    = { key: 'rubble',        assetKey: 'building_rubble', color: '#555555', housing: 0, food: 0, defense: 0, cost: 0 };
export const STONE_DEP_DEF = { key: 'stone_deposit', assetKey: 'obstacle_stone',  color: '#6e7275', housing: 0, food: 0, defense: 0, cost: 0 };
export const IRON_VEIN_DEF = { key: 'iron_vein',     assetKey: 'obstacle_iron',   color: '#b2b9c0', housing: 0, food: 0, defense: 0, cost: 0 };
export const STONE_SPAWN_CHANCE = 0.02;
export const IRON_SPAWN_CHANCE  = 0.01;
export const ROAD_COST = 5;
export const ALL_DEFS = Object.freeze(Object.assign({}, BUILDINGS, { road: ROAD_DEF }));

export const SEASON_MODIFIERS = [
    { foodYieldMult: 1.25, woodYieldMult: 1.0,  foodDrainMult: 1.0, droughtWeightMult: 0.5, citizenSpeedMult: 1.0, snowOverlay: false, autumnHarvest: false }, // Spring
    { foodYieldMult: 1.0,  woodYieldMult: 1.0,  foodDrainMult: 1.0, droughtWeightMult: 2.0, citizenSpeedMult: 1.0, snowOverlay: false, autumnHarvest: false }, // Summer
    { foodYieldMult: 1.0,  woodYieldMult: 1.25, foodDrainMult: 1.0, droughtWeightMult: 0.5, citizenSpeedMult: 1.0, snowOverlay: false, autumnHarvest: true  }, // Autumn
    { foodYieldMult: 0.75, woodYieldMult: 1.0,  foodDrainMult: 2.5, droughtWeightMult: 0.0, citizenSpeedMult: 0.6, snowOverlay: true,  autumnHarvest: false }, // Winter
];
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const DAY_PHASES = { dawn: [0, 12], day: [12, 42], dusk: [42, 52], night: [52, 60] };
export const DAY_DURATION = 60.0;
export const SEASON_DURATION = 7 * DAY_DURATION;
export const TAX_INTERVAL = 5.0;
export const FOOD_CAP_BASE = 200;
export const FOOD_CAP_PER_GRANARY = 200;
export const EMIGRATION_INTERVAL = 10.0;
export const AUTOSAVE_INTERVAL = 10.0;
export const SAVE_KEY = 'pixel_dominion_save';               // rolling autosave slot
export const MANUAL_SAVE_KEY = 'pixel_dominion_save_manual'; // player-initiated slot (survives autosaves)
export const RAID_DURATION = 180;
// Failsafe: if a raid is still unresolved after this long, all remaining
// walkers are force-retreated so a stuck raider can never stall the game.
export const RAID_ACTIVE_TIMEOUT = 240;
// Smooth ~1.5× growth per wave (previously spiked 6→15 and 35→60)
export const RAID_WAVE_SIZES = Object.freeze([3, 7, 12, 20, 32, 48, 70, 100, 140, 190]);
export const FINAL_RAID_WAVE = RAID_WAVE_SIZES.length;

export const TIER2_UPGRADES = {
    farm:        { name: 'Improved Farm',      goldCost: 80,  woodCost: 30, stoneCost: 0  },
    lumberyard:  { name: 'Expanded Mill',      goldCost: 80,  woodCost: 0,  stoneCost: 30 },
    mine:        { name: 'Deep Shaft',         goldCost: 100, woodCost: 30, stoneCost: 0  },
    barracks:    { name: 'Fortified Barracks', goldCost: 150, woodCost: 0,  stoneCost: 50 },
    tower:       { name: 'Reinforced Tower',   goldCost: 120, woodCost: 0,  stoneCost: 40 },
    granary:     { name: 'Extended Granary',   goldCost: 100, woodCost: 40, stoneCost: 0  },
};

export const UNIT_BALANCE = Object.freeze({
    soldier: Object.freeze({
        goldCost: 40,
        baseHp: 100,
        ironDisciplineHpBonus: 25,
        barracksTier2HpBonus: 25,
    }),
    archer: Object.freeze({
        goldCost: 40,
    }),
    knight: Object.freeze({
        goldCost: 60,
        ironCost: 20,
    }),
    captain: Object.freeze({
        goldCost: 150,
        ironCost: 30,
        baseHp: 250,
    }),
});

export const ECONOMY_BALANCE = Object.freeze({
    baseGoldPerCitizen: 1,
    tradeGuildsGoldPerCitizen: 1,
    militaryUpkeep: Object.freeze({
        soldier: 1,
        archer: 1,
        knight: 2,
    }),
});

export const PRODUCTION_BALANCE = Object.freeze({
    farmCycleSec: 2.0,
    farmPassiveFoodPerCycle: 2.25,
    farmBaseFoodPerCycle: 13.5,
    // Yield multiplier when a woodcutter/miner returns without having harvested
    // an actual node (no trees / deposits left in range) — "gleaning" keeps the
    // economy alive but makes real nodes clearly better.
    gleanYieldMult: 0.4,
    // Approximate gather round-trip used for the stats-overlay rate estimate.
    gatherTripSecEstimate: 8,
});

// Combat tuning — single source of truth for damage/range numbers that were
// previously inline literals scattered across entities.js and main.js.
export const COMBAT_BALANCE = Object.freeze({
    soldier:  Object.freeze({ meleeDps: 15 }),
    knight:   Object.freeze({ meleeDps: 20, damageTakenMult: 0.5 }),
    // One per city; nearby soldiers fight harder while he stands
    captain:  Object.freeze({ meleeDps: 30, auraRangeTiles: 5, auraDpsMult: 1.25 }),
    // Camps: each standing camp strengthens raids; assaulting them is what
    // ATTACK mode is for. Camp defenders graze attackers lightly.
    camp:     Object.freeze({ hp: 300, waveSizeBonusPerCamp: 0.15, counterDps: 3, destroyReward: 100, destroyRaidDelaySec: 45 }),
    archer:   Object.freeze({ damage: 20, steelBowsDamage: 25, rangeTiles: 12, fireIntervalSec: 1.5 }),
    tower:    Object.freeze({ damage: 25, tier2Damage: 30, rangeTiles: 8, tier2RangeTiles: 10, fireIntervalSec: 1.0 }),
    ballista: Object.freeze({ fireIntervalSec: 8.0 }),
    raider:   Object.freeze({ meleeDps: 15, buildingDamage: 50, siegeWallDamage: 75, gateBreachDps: 10 }),
    // Defend mode: soldiers/knights only engage raiders within this many tiles
    // of the rally point; anything further is left to towers/archers.
    defendLeashTiles: 10,
    // Melee target distribution: prefer the nearest raider with fewer than this
    // many attackers already on it (prevents 30 soldiers piling on one target).
    maxMeleeAttackersPerTarget: 3,
});

// Object Pools to mitigate Garbage Collection sweeps
export const PROJECTILE_POOL = [];
export const PARTICLE_POOL = [];
export const VISUAL_PROJECTILE_POOL = [];

export function getPooledProjectile() {
    if (PROJECTILE_POOL.length > 0) {
        const p = PROJECTILE_POOL.pop();
        p.timer = 0;
        return p;
    }
    return { x: 0, y: 0, vx: 0, vy: 0, g: 0, target: null, damage: 0, timer: 0, maxTime: 0, type: 'arrow' };
}

export function releaseProjectile(p) {
    p.target = null;
    PROJECTILE_POOL.push(p);
}

export function getPooledParticle() {
    if (PARTICLE_POOL.length > 0) {
        const p = PARTICLE_POOL.pop();
        p.timer = 0;
        return p;
    }
    return { x: 0, y: 0, type: '', timer: 0, duration: 0, alpha: 1.0 };
}

export function releaseParticle(p) {
    p.text = null;
    p.color = null;
    PARTICLE_POOL.push(p);
}

export function getPooledVisualProjectile() {
    if (VISUAL_PROJECTILE_POOL.length > 0) {
        const p = VISUAL_PROJECTILE_POOL.pop();
        p.timer = 0;
        return p;
    }
    return { fromX: 0, fromY: 0, toX: 0, toY: 0, timer: 0, duration: 0.15 };
}

export function releaseVisualProjectile(p) {
    VISUAL_PROJECTILE_POOL.push(p);
}

export function spawnParticle(x, y, type, duration = 0.4, text = null, color = null) {
    const p = getPooledParticle();
    p.x = x; p.y = y; p.type = type; p.timer = 0; p.duration = duration; p.text = text; p.color = color; p.alpha = 1.0;
    p.driftX = 0; // pooled particle may carry drift from a previous spawnFloat
    particles.push(p);
    return p;
}

// Bind constants to window
Object.assign(window, {
    TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, BUILDINGS, TREE_DEF,
    TREE_SPAWN_CHANCE, ROAD_DEF, RUBBLE_DEF, STONE_DEP_DEF, IRON_VEIN_DEF,
    STONE_SPAWN_CHANCE, IRON_SPAWN_CHANCE, ROAD_COST, ALL_DEFS, SEASON_MODIFIERS, SEASONS,
    DAY_PHASES, DAY_DURATION, SEASON_DURATION, TAX_INTERVAL, FOOD_CAP_BASE,
    FOOD_CAP_PER_GRANARY, EMIGRATION_INTERVAL, AUTOSAVE_INTERVAL, SAVE_KEY, MANUAL_SAVE_KEY, RAID_DURATION,
    RAID_ACTIVE_TIMEOUT, RAID_WAVE_SIZES, FINAL_RAID_WAVE,
    TIER2_UPGRADES, UNIT_BALANCE, ECONOMY_BALANCE, PRODUCTION_BALANCE, COMBAT_BALANCE,
    DIFFICULTY_PRESETS, DEFAULT_DIFFICULTY_KEY,
    PROJECTILE_POOL, PARTICLE_POOL, VISUAL_PROJECTILE_POOL, getPooledProjectile, releaseProjectile,
    getPooledParticle, releaseParticle, getPooledVisualProjectile, releaseVisualProjectile, spawnParticle
});

// ===================== STATE DECLARES =====================
export const canvas = document.getElementById('game-canvas');
export const ctx = canvas.getContext('2d');
export const statsEl = document.getElementById('stats-counter');

// Internal raw state object (Proxy wraps this)
const _rawGameState = {
    gold: 300, housing: 0, defense: 0,
    population: 0, food: 0, happiness: 100,
    wood: 100, stone: 50, iron: 0,
    selectedTool: null,
    difficulty: DEFAULT_DIFFICULTY_KEY,
    started: false,
    day: 1, season: 'Spring',
    upgrades: {
        reinforced_masonry: false,
        steel_bows: false,
        heavy_armor: false,
        crop_rotation: false,
        ballistic_engineering: false,
        iron_discipline: false,
        trade_guilds: false,
        field_medicine: false,
    },
    activeResearch: null,
    raidersDefeated: 0,
    housesBuilt: 0,
    farmsBuilt: 0,
    endless: false,          // player chose CONTINUE REIGN after victory — raids keep scaling
    victoryAchieved: false,  // guards against re-triggering the victory modal every frame
    diplomacyFlags: {},      // choices set flags here; follow-up events guard on them
};

export const STATE_SCHEMA = Object.freeze({
    simulation: Object.freeze([
        'gold', 'housing', 'defense', 'population', 'food', 'happiness',
        'wood', 'stone', 'iron',
    ]),
    uiSession: Object.freeze([
        'selectedTool', 'difficulty', 'started',
    ]),
    progression: Object.freeze([
        'day', 'season', 'upgrades', 'activeResearch', 'raidersDefeated',
        'housesBuilt', 'farmsBuilt', 'endless', 'victoryAchieved',
    ]),
    // Derived values are rebuilt from grid/entities and should not be treated as save owners.
    derived: Object.freeze([
        'activeTowers', 'activeBallistaTowers', 'activeGates', 'activeFarms',
        'activeMonuments', 'activeWalls', 'activePillageable', 'activeHouses',
        'activeGranaries', 'activeTaverns', 'activeRubble', 'activeBarracks',
        'activeArcheryRanges', 'buildingCounts',
        'jobfulStructures', 'underConstruction',
    ]),
});

// ===================== REACTIVE UI DIRTY FLAG =====================
// Keys whose mutations should schedule a UI refresh
const _UI_REACTIVE_KEYS = new Set([
    ...STATE_SCHEMA.simulation,
    'selectedTool',
]);

let _uiDirty = false;

/**
 * Mark the UI as needing a refresh. Called by the gameState Proxy.
 * Safe to call many times per frame — only one flush will occur.
 */
export function markUIDirty() { _uiDirty = true; }

/**
 * Flush pending UI updates. Called once per frame at the start of update().
 * Calls refreshUI() (which calls updateResourceUI + updateBuildMenu) only when
 * state has actually changed since the last flush.
 */
export function flushUI() {
    if (!_uiDirty) return;
    _uiDirty = false;
    // refreshUI is imported from ui.js and assigned to window during module init
    if (window.refreshUI) window.refreshUI();
}

/**
 * Reactive Proxy wrapper around _rawGameState.
 * Any write to a UI-reactive key (gold, food, wood, etc.) sets _uiDirty,
 * deferring the DOM update to the next flushUI() call at the top of update().
 * This batches all mid-frame resource mutations into a single DOM pass.
 */
export const gameState = new Proxy(_rawGameState, {
    set(target, key, value) {
        target[key] = value;
        if (_UI_REACTIVE_KEYS.has(key)) _uiDirty = true;
        return true;
    },
});

export const citizens = [];
export const soldiers = [];
export const archers = [];
export const knights = [];
export const activeProjectiles = [];
export const raiders = [];
// Raider camps: pillage bases that appear after mid-game waves. While one
// stands, raids grow stronger; destroying it (ATTACK mode) weakens/delays them.
export let raiderCamps = [];
export function setRaiderCamps(arr) { raiderCamps = arr; window.raiderCamps = arr; }

// Territory radius counts every population-derived unit so that training an
// archer/knight (which consumes a citizen) never shrinks the border.
export function calcTerritoryRadius() {
    return 3 + Math.floor((citizens.length + soldiers.length + archers.length + knights.length) / 4);
}
window.calcTerritoryRadius = calcTerritoryRadius;

export function getDifficultyPreset(key) {
    return DIFFICULTY_PRESETS[key] || DIFFICULTY_PRESETS[DEFAULT_DIFFICULTY_KEY];
}

export function getRaidStrengthForWave(waveNum, difficultyKey = gameState.difficulty ?? DEFAULT_DIFFICULTY_KEY) {
    const preset = getDifficultyPreset(difficultyKey);
    const clampedWave = Math.max(1, Math.min(waveNum, preset.raidStrengths.length));
    return preset.raidStrengths[clampedWave - 1];
}

export function applyDifficultyConfig(difficultyKey, { syncRaidStrength = false, refresh = true } = {}) {
    const preset = getDifficultyPreset(difficultyKey);
    const monumentCost = preset.monumentCost;
    gameState.difficulty = preset.key;
    BUILDINGS.monument.cost = monumentCost.gold;
    BUILDINGS.monument.woodCost = monumentCost.wood;
    BUILDINGS.monument.stoneCost = monumentCost.stone;
    BUILDINGS.monument.ironCost = monumentCost.iron;
    window.currentDifficultyPreset = preset;
    if (syncRaidStrength) {
        const nextWave = Math.max(1, Math.min((raidCount || 0) + 1, preset.raidStrengths.length));
        setRaidStrength(getRaidStrengthForWave(nextWave, preset.key));
    }
    if (refresh && window.refreshUI) window.refreshUI();
    return preset;
}
export const projectiles = [];
export const particles = [];
export const _activeRaiders = [];

export let activeTowers = [];
export let activeBallistaTowers = [];
export let activeGates = [];
export let activeFarms = [];
export let activeMonuments = [];
export let activeWalls = [];
export let activePillageable = [];
export let activeHouses = [];
export let activeGranaries = [];
export let activeTaverns = [];
export let activeRubble = [];
export let activeBarracks = [];
export let activeArcheryRanges = [];

export const _PILLAGEABLE = new Set(['farm','lumberyard','quarry','mine','house','barracks','archery_range','academy','monument']);
export let buildingCounts = {};
export let jobfulStructures = [];
export let underConstruction = [];

export let _shakeX = 0, _shakeY = 0, _shakeIntensity = 0;
export let incidentManager = null;
export let droughtActive = false;
export let strikeActive = false;
export let merchantNPC = null;
export let statsOverlayVisible = false;
export let _statsUpdateTimer = 0;
export let _bannerTimeout = null;

export let spawnTimer = 0, taxTimer = 0, emigrationTimer = 0, autoSaveTimer = 0, jobScanTimer = 0;
export let dayTimer = 0;
export let _dayPhase = 'day';
export let _overlayAlpha = 0;
export let _raidQueued = false;
export let _griefPenalty = 0;
export let _happinessFactors = [];
export let _combatMode = 'defend';
export let _diplomacyTimers = [];
export let _allianceTimer = 0;
export let _soldierCostMult = 1.0;
export let _soldierCostTimer = 0;

export let _tier2Upgrades = {};
export let _buildingPanelOpen = false;
export let _buildingPanelTX = 0;
export let _buildingPanelTY = 0;
export let _lastSeason = 'Spring';
export let _snowParticles = [];
export let userPaused = false;
export let timeScale = 1;
export const JOB_SCAN_INTERVAL = 3.0;
export let currentTerritoryRadius = 3;
export let expansionBannerTimer = null;

export let raidTimer = RAID_DURATION;
export let raidStrength = 10;
export let raidCount = 0;
export let raidActive = false;
export let _scoutPhase = false;
export let _scoutTimer = 0;
export let raidActiveTimer = 0;
export let raidBuildingsDestroyed = 0;
export let raidCitizensKilled = 0;
export let gameIsPaused = false;
export let raidWarningPlayed = false;

export const towerFireTimers = {};
export let raidWarningSpawnCount = 0;
export const keys = {};
export const _BUILD_SHORTCUT_TOOLS = ['house','tower','wall','barracks','farm','lumberyard','quarry','mine','gate'];
export let isDragging = false, dragStartX = 0, dragStartY = 0, lastMouseX = 0, lastMouseY = 0;
export let mouseScreenX = canvas.width / 2, mouseScreenY = canvas.height / 2;
export let grid = null;
export let camera = null;
export let assets = null;

// Bind mutable variables to window so standard script referencing is compatible
const _bindGlobals = () => {
    Object.assign(window, {
        canvas, ctx, statsEl, gameState, citizens, soldiers, archers, knights, activeProjectiles,
        raiders, projectiles, particles, _activeRaiders, _PILLAGEABLE, towerFireTimers, keys,
        _BUILD_SHORTCUT_TOOLS, assets,
        grid, camera,
        _shakeX, _shakeY, _shakeIntensity, incidentManager, droughtActive, strikeActive,
        merchantNPC, statsOverlayVisible, _statsUpdateTimer, _bannerTimeout,
        spawnTimer, taxTimer, emigrationTimer, autoSaveTimer, jobScanTimer,
        dayTimer, _dayPhase, _overlayAlpha, _raidQueued, _griefPenalty,
        _happinessFactors, _combatMode, _diplomacyTimers, _allianceTimer,
        _soldierCostMult, _soldierCostTimer, _tier2Upgrades, _buildingPanelOpen,
        _buildingPanelTX, _buildingPanelTY, _lastSeason, _snowParticles,
        userPaused, timeScale, currentTerritoryRadius, expansionBannerTimer,
        raidTimer, raidStrength, raidCount, raidActive, _scoutPhase, _scoutTimer,
        raidActiveTimer, raidBuildingsDestroyed, raidCitizensKilled, gameIsPaused,
        raidWarningPlayed, raidWarningSpawnCount, isDragging, dragStartX, dragStartY,
        lastMouseX, lastMouseY, mouseScreenX, mouseScreenY,
        activeTowers, activeBallistaTowers, activeGates, activeFarms, activeMonuments,
        activeWalls, activePillageable, activeHouses, activeGranaries, activeTaverns,
        activeRubble, activeBarracks, activeArcheryRanges,
        buildingCounts, jobfulStructures, underConstruction
    });
};
_bindGlobals();

// ===================== SYNCED WINDOW ACCESSORS =====================
// Every mutable module-scope binding above is re-exposed on window as an
// accessor pair backed by the SAME module binding. A bare `window.raidTimer = 0`
// (or `raidTimer = 0` from any module — it resolves to the window property) now
// updates the storage that state.js readers, saveGame(), and the exported
// setters all use. This eliminates the "bare assignment only updated the window
// copy, so the save went stale" desync bug class documented in past fixes.
function _sync(name, get, set) {
    Object.defineProperty(window, name, { get, set, configurable: true });
}
_sync('_shakeX', () => _shakeX, v => { _shakeX = v; });
_sync('_shakeY', () => _shakeY, v => { _shakeY = v; });
_sync('_shakeIntensity', () => _shakeIntensity, v => { _shakeIntensity = v; });
_sync('incidentManager', () => incidentManager, v => { incidentManager = v; });
_sync('droughtActive', () => droughtActive, v => { droughtActive = v; });
_sync('strikeActive', () => strikeActive, v => { strikeActive = v; });
_sync('merchantNPC', () => merchantNPC, v => { merchantNPC = v; });
_sync('statsOverlayVisible', () => statsOverlayVisible, v => { statsOverlayVisible = v; });
_sync('_statsUpdateTimer', () => _statsUpdateTimer, v => { _statsUpdateTimer = v; });
_sync('_bannerTimeout', () => _bannerTimeout, v => { _bannerTimeout = v; });
_sync('spawnTimer', () => spawnTimer, v => { spawnTimer = v; });
_sync('taxTimer', () => taxTimer, v => { taxTimer = v; });
_sync('emigrationTimer', () => emigrationTimer, v => { emigrationTimer = v; });
_sync('autoSaveTimer', () => autoSaveTimer, v => { autoSaveTimer = v; });
_sync('jobScanTimer', () => jobScanTimer, v => { jobScanTimer = v; });
_sync('dayTimer', () => dayTimer, v => { dayTimer = v; });
_sync('_dayPhase', () => _dayPhase, v => { _dayPhase = v; });
_sync('_overlayAlpha', () => _overlayAlpha, v => { _overlayAlpha = v; });
_sync('_raidQueued', () => _raidQueued, v => { _raidQueued = v; });
_sync('_griefPenalty', () => _griefPenalty, v => { _griefPenalty = v; });
_sync('_happinessFactors', () => _happinessFactors, v => { _happinessFactors = v; });
_sync('_combatMode', () => _combatMode, v => { _combatMode = v; });
_sync('_diplomacyTimers', () => _diplomacyTimers, v => { _diplomacyTimers = v; });
_sync('_allianceTimer', () => _allianceTimer, v => { _allianceTimer = v; });
_sync('_soldierCostMult', () => _soldierCostMult, v => { _soldierCostMult = v; });
_sync('_soldierCostTimer', () => _soldierCostTimer, v => { _soldierCostTimer = v; });
_sync('_tier2Upgrades', () => _tier2Upgrades, v => { _tier2Upgrades = v; });
_sync('_buildingPanelOpen', () => _buildingPanelOpen, v => { _buildingPanelOpen = v; });
_sync('_buildingPanelTX', () => _buildingPanelTX, v => { _buildingPanelTX = v; });
_sync('_buildingPanelTY', () => _buildingPanelTY, v => { _buildingPanelTY = v; });
_sync('_lastSeason', () => _lastSeason, v => { _lastSeason = v; });
_sync('_snowParticles', () => _snowParticles, v => { _snowParticles = v; });
_sync('userPaused', () => userPaused, v => { userPaused = v; });
_sync('timeScale', () => timeScale, v => { timeScale = v; });
_sync('currentTerritoryRadius', () => currentTerritoryRadius, v => { currentTerritoryRadius = v; });
_sync('expansionBannerTimer', () => expansionBannerTimer, v => { expansionBannerTimer = v; });
_sync('raidTimer', () => raidTimer, v => { raidTimer = v; });
_sync('raidStrength', () => raidStrength, v => { raidStrength = v; });
_sync('raidCount', () => raidCount, v => { raidCount = v; });
_sync('raidActive', () => raidActive, v => { raidActive = v; });
_sync('_scoutPhase', () => _scoutPhase, v => { _scoutPhase = v; });
_sync('_scoutTimer', () => _scoutTimer, v => { _scoutTimer = v; });
_sync('raidActiveTimer', () => raidActiveTimer, v => { raidActiveTimer = v; });
_sync('raidBuildingsDestroyed', () => raidBuildingsDestroyed, v => { raidBuildingsDestroyed = v; });
_sync('raidCitizensKilled', () => raidCitizensKilled, v => { raidCitizensKilled = v; });
_sync('gameIsPaused', () => gameIsPaused, v => { gameIsPaused = v; });
_sync('raidWarningPlayed', () => raidWarningPlayed, v => { raidWarningPlayed = v; });
_sync('raidWarningSpawnCount', () => raidWarningSpawnCount, v => { raidWarningSpawnCount = v; });
_sync('isDragging', () => isDragging, v => { isDragging = v; });
_sync('dragStartX', () => dragStartX, v => { dragStartX = v; });
_sync('dragStartY', () => dragStartY, v => { dragStartY = v; });
_sync('lastMouseX', () => lastMouseX, v => { lastMouseX = v; });
_sync('lastMouseY', () => lastMouseY, v => { lastMouseY = v; });
_sync('mouseScreenX', () => mouseScreenX, v => { mouseScreenX = v; });
_sync('mouseScreenY', () => mouseScreenY, v => { mouseScreenY = v; });
_sync('grid', () => grid, v => { grid = v; });
_sync('camera', () => camera, v => { camera = v; });
_sync('assets', () => assets, v => { assets = v; });
_sync('raiderCamps', () => raiderCamps, v => { raiderCamps = v; });
_sync('activeTowers', () => activeTowers, v => { activeTowers = v; });
_sync('activeBallistaTowers', () => activeBallistaTowers, v => { activeBallistaTowers = v; });
_sync('activeGates', () => activeGates, v => { activeGates = v; });
_sync('activeFarms', () => activeFarms, v => { activeFarms = v; });
_sync('activeMonuments', () => activeMonuments, v => { activeMonuments = v; });
_sync('activeWalls', () => activeWalls, v => { activeWalls = v; });
_sync('activePillageable', () => activePillageable, v => { activePillageable = v; });
_sync('activeHouses', () => activeHouses, v => { activeHouses = v; });
_sync('activeGranaries', () => activeGranaries, v => { activeGranaries = v; });
_sync('activeTaverns', () => activeTaverns, v => { activeTaverns = v; });
_sync('activeRubble', () => activeRubble, v => { activeRubble = v; });
_sync('activeBarracks', () => activeBarracks, v => { activeBarracks = v; });
_sync('activeArcheryRanges', () => activeArcheryRanges, v => { activeArcheryRanges = v; });
_sync('buildingCounts', () => buildingCounts, v => { buildingCounts = v; });
_sync('jobfulStructures', () => jobfulStructures, v => { jobfulStructures = v; });
_sync('underConstruction', () => underConstruction, v => { underConstruction = v; });

export function setGridAndCamera(g) {
    grid = g;
    camera = g.camera;
    window.grid = g;
    window.camera = g.camera;
}

export function getStructureAt(tx, ty) {
    if (!grid || !grid.inBounds(tx, ty)) return null;
    return grid.structures[ty]?.[tx] ?? null;
}

export function getRootStructureAt(tx, ty) {
    const s = getStructureAt(tx, ty);
    if (!s) return { structure: null, tx, ty };
    if (!s.isChild) return { structure: s, tx, ty };
    const parent = getStructureAt(s.parentX, s.parentY);
    return { structure: parent, tx: s.parentX, ty: s.parentY };
}

// Global update getters/setters for primitives
export function setShake(sx, sy, si) { _shakeX = sx; _shakeY = sy; _shakeIntensity = si; window._shakeX = sx; window._shakeY = sy; window._shakeIntensity = si; }
export function setIncidentManager(im) { incidentManager = im; window.incidentManager = im; }
export function setDroughtActive(val) { droughtActive = val; window.droughtActive = val; }
export function setStrikeActive(val) { strikeActive = val; window.strikeActive = val; }
export function setMerchantNPC(npc) { merchantNPC = npc; window.merchantNPC = npc; }
export function setStatsOverlayVisible(val) { statsOverlayVisible = val; window.statsOverlayVisible = val; }
export function setStatsUpdateTimer(val) { _statsUpdateTimer = val; window._statsUpdateTimer = val; }
export function setBannerTimeout(val) { _bannerTimeout = val; window._bannerTimeout = val; }
export function setSpawnTimer(val) { spawnTimer = val; window.spawnTimer = val; }
export function setTaxTimer(val) { taxTimer = val; window.taxTimer = val; }
export function setEmigrationTimer(val) { emigrationTimer = val; window.emigrationTimer = val; }
export function setAutoSaveTimer(val) { autoSaveTimer = val; window.autoSaveTimer = val; }
export function setJobScanTimer(val) { jobScanTimer = val; window.jobScanTimer = val; }
export function setDayTimer(val) { dayTimer = val; window.dayTimer = val; }
export function setDayPhase(val) { _dayPhase = val; window._dayPhase = val; }
export function setOverlayAlpha(val) { _overlayAlpha = val; window._overlayAlpha = val; }
export function setRaidQueued(val) { _raidQueued = val; window._raidQueued = val; }
export function setGriefPenalty(val) { _griefPenalty = val; window._griefPenalty = val; }
export function setHappinessFactors(arr) { _happinessFactors = arr; window._happinessFactors = arr; }
export function setCombatMode(val) { _combatMode = val; window._combatMode = val; }
export function setDiplomacyTimers(arr) { _diplomacyTimers = arr; window._diplomacyTimers = arr; }
export function setAllianceTimer(val) { _allianceTimer = val; window._allianceTimer = val; }
export function setSoldierCostMult(val) { _soldierCostMult = val; window._soldierCostMult = val; }
export function setSoldierCostTimer(val) { _soldierCostTimer = val; window._soldierCostTimer = val; }
export function setTier2Upgrades(obj) { _tier2Upgrades = obj; window._tier2Upgrades = obj; }
export function setBuildingPanelOpen(val) { _buildingPanelOpen = val; window._buildingPanelOpen = val; }
export function setBuildingPanelTX(val) { _buildingPanelTX = val; window._buildingPanelTX = val; }
export function setBuildingPanelTY(val) { _buildingPanelTY = val; window._buildingPanelTY = val; }
export function setLastSeason(val) { _lastSeason = val; window._lastSeason = val; }
export function setSnowParticles(arr) { _snowParticles = arr; window._snowParticles = arr; }
export function setUserPaused(val) { userPaused = val; window.userPaused = val; }
export function setTimeScale(val) { timeScale = val; window.timeScale = val; }
export function setCurrentTerritoryRadius(val) { currentTerritoryRadius = val; window.currentTerritoryRadius = val; }
export function setExpansionBannerTimer(val) { expansionBannerTimer = val; window.expansionBannerTimer = val; }

export function setRaidTimer(val) { raidTimer = val; window.raidTimer = val; }
export function setRaidStrength(val) { raidStrength = val; window.raidStrength = val; }
export function setRaidCount(val) { raidCount = val; window.raidCount = val; }
export function setRaidActive(val) { raidActive = val; window.raidActive = val; }
export function setScoutPhase(val) { _scoutPhase = val; window._scoutPhase = val; }
export function setScoutTimer(val) { _scoutTimer = val; window._scoutTimer = val; }
export function setRaidActiveTimer(val) { raidActiveTimer = val; window.raidActiveTimer = val; }
export function setRaidBuildingsDestroyed(val) { raidBuildingsDestroyed = val; window.raidBuildingsDestroyed = val; }
export function setRaidCitizensKilled(val) { raidCitizensKilled = val; window.raidCitizensKilled = val; }
export function setGameIsPaused(val) { gameIsPaused = val; window.gameIsPaused = val; }
export function setRaidWarningPlayed(val) { raidWarningPlayed = val; window.raidWarningPlayed = val; }
export function setRaidWarningSpawnCount(val) { raidWarningSpawnCount = val; window.raidWarningSpawnCount = val; }
export function setIsDragging(val) { isDragging = val; window.isDragging = val; }
export function setDragStartX(val) { dragStartX = val; window.dragStartX = val; }
export function setDragStartY(val) { dragStartY = val; window.dragStartY = val; }
export function setLastMouseX(val) { lastMouseX = val; window.lastMouseX = val; }
export function setLastMouseY(val) { lastMouseY = val; window.lastMouseY = val; }
export function setMouseScreenX(val) { mouseScreenX = val; window.mouseScreenX = val; }
export function setMouseScreenY(val) { mouseScreenY = val; window.mouseScreenY = val; }

// Direct binds of collections that change reference
export function setBuildingLists(lists) {
    activeTowers = lists.activeTowers; window.activeTowers = lists.activeTowers;
    activeBallistaTowers = lists.activeBallistaTowers; window.activeBallistaTowers = lists.activeBallistaTowers;
    activeGates = lists.activeGates; window.activeGates = lists.activeGates;
    activeFarms = lists.activeFarms; window.activeFarms = lists.activeFarms;
    activeMonuments = lists.activeMonuments; window.activeMonuments = lists.activeMonuments;
    activeWalls = lists.activeWalls; window.activeWalls = lists.activeWalls;
    activePillageable = lists.activePillageable; window.activePillageable = lists.activePillageable;
    activeHouses = lists.activeHouses; window.activeHouses = lists.activeHouses;
    activeGranaries = lists.activeGranaries; window.activeGranaries = lists.activeGranaries;
    activeTaverns = lists.activeTaverns; window.activeTaverns = lists.activeTaverns;
    activeRubble = lists.activeRubble; window.activeRubble = lists.activeRubble;
    activeBarracks = lists.activeBarracks; window.activeBarracks = lists.activeBarracks;
    activeArcheryRanges = lists.activeArcheryRanges; window.activeArcheryRanges = lists.activeArcheryRanges;
    buildingCounts = lists.buildingCounts; window.buildingCounts = lists.buildingCounts;
    jobfulStructures = lists.jobfulStructures; window.jobfulStructures = lists.jobfulStructures;
    underConstruction = lists.underConstruction; window.underConstruction = lists.underConstruction;
}

// Expose setters to window
Object.assign(window, {
    setGridAndCamera, getStructureAt, getRootStructureAt,
    setShake, setIncidentManager, setDroughtActive, setStrikeActive,
    setMerchantNPC, setStatsOverlayVisible, setStatsUpdateTimer, setBannerTimeout,
    setSpawnTimer, setTaxTimer, setEmigrationTimer, setAutoSaveTimer, setJobScanTimer,
    setDayTimer, setDayPhase, setOverlayAlpha, setRaidQueued, setGriefPenalty,
    setHappinessFactors, setCombatMode, setDiplomacyTimers, setAllianceTimer,
    setSoldierCostMult, setSoldierCostTimer, setTier2Upgrades, setBuildingPanelOpen,
    setBuildingPanelTX, setBuildingPanelTY, setLastSeason, setSnowParticles,
    setUserPaused, setTimeScale, setCurrentTerritoryRadius, setExpansionBannerTimer,
    setRaidTimer, setRaidStrength, setRaidCount, setRaidActive, setScoutPhase, setScoutTimer,
    setRaidActiveTimer, setRaidBuildingsDestroyed, setRaidCitizensKilled, setGameIsPaused,
    setRaidWarningPlayed, setRaidWarningSpawnCount, setIsDragging, setDragStartX,
    setDragStartY, setLastMouseX, setLastMouseY, setMouseScreenX, setMouseScreenY,
    setBuildingLists, markUIDirty, flushUI, setRaiderCamps
});

// ===================== PERSISTENCE / SAVING =====================
export const SAVE_VERSION = 7;

function migrateSaveToV3(data) {
    return Object.assign(data, {
        raiders: data.raiders || [],
        spawnTimer: data.spawnTimer || 0,
        taxTimer: data.taxTimer || 0,
        emigrationTimer: data.emigrationTimer || 0,
        autoSaveTimer: data.autoSaveTimer || 0,
        jobScanTimer: data.jobScanTimer || 0,
        version: 3,
    });
}

function migrateSaveToV4(data) {
    // V4 has no data structure changes; it records the reactive-UI architecture bump.
    data.version = 4;
    return data;
}

function migrateSaveToV5(data) {
    // V5 removes the obsolete Monument victory countdown. Building the Monument
    // is now an immediate win condition once construction is complete.
    data.structures = (data.structures || []).map(s => {
        if (s?.key !== 'monument' || s.victoryTimer === undefined) return s;
        const { victoryTimer, ...rest } = s;
        return rest;
    });
    data.version = 5;
    return data;
}

function migrateSaveToV6(data) {
    const difficultyKey = getDifficultyPreset(data.difficulty).key;
    const preset = getDifficultyPreset(difficultyKey);
    const nextWave = Math.max(1, Math.min((data.raidCount ?? 0) + 1, preset.raidStrengths.length));
    data.difficulty = difficultyKey;
    data.raidStrength = getRaidStrengthForWave(nextWave, difficultyKey);
    data.version = 6;
    return data;
}

function migrateSaveToV7(data) {
    // V7 persists active-raid state. Older saves derive it from the raiders array
    // so a mid-raid save no longer loads into a broken "raiders but no raid" state.
    if (data.raidActive === undefined) {
        data.raidActive = (data.raiders || []).some(r => r.state === 'walking');
    }
    if (data.raidActiveTimer === undefined) data.raidActiveTimer = 0;
    if (data.raidBuildingsDestroyed === undefined) data.raidBuildingsDestroyed = 0;
    if (data.raidCitizensKilled === undefined) data.raidCitizensKilled = 0;
    // Research entries gained a per-entry duration (was a hardcoded 15s)
    if (data.activeResearch && data.activeResearch.duration === undefined) {
        data.activeResearch.duration = 15;
    }
    data.version = 7;
    return data;
}

export function migrateSaveData(data) {
    if (!data || typeof data !== 'object') return null;
    if (!data.version || data.version < 3) {
        console.log('[Pixel Dominion] Migrating old save schema to Version 3...');
        data = migrateSaveToV3(data);
    }
    if (data.version < 4) {
        data = migrateSaveToV4(data);
    }
    if (data.version < 5) {
        data = migrateSaveToV5(data);
    }
    if (data.version < 6) {
        data = migrateSaveToV6(data);
    }
    if (data.version < 7) {
        data = migrateSaveToV7(data);
    }
    data.version = Math.min(data.version || SAVE_VERSION, SAVE_VERSION);
    return data;
}

export function saveGame(slotKey = SAVE_KEY) {
    const data = {
        version: SAVE_VERSION,
        endless: gameState.endless || false,
        victoryAchieved: gameState.victoryAchieved || false,
        gold: gameState.gold, housing: gameState.housing, defense: gameState.defense,
        population: gameState.population, food: gameState.food, happiness: gameState.happiness,
        difficulty: gameState.difficulty,
        wood: gameState.wood, stone: gameState.stone, iron: gameState.iron,
        raidTimer, raidStrength, raidCount, _scoutTimer, _scoutPhase, _raidQueued, _dayPhase, _griefPenalty, _combatMode,
        raidActive, raidActiveTimer, raidBuildingsDestroyed, raidCitizensKilled,
        _allianceTimer, _soldierCostMult, _soldierCostTimer,
        diplomacyTimers: _diplomacyTimers.map(t => ({ remainingSec: t.remainingSec, actionKey: t.actionKey })),
        dayTimer, day: gameState.day, season: gameState.season,
        camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
        structures: [], roads: [],
        raiderCamps: raiderCamps.map(c => ({ x: c.x, y: c.y, hp: c.hp, maxHp: c.maxHp })),
        diplomacyFlags: Object.assign({}, gameState.diplomacyFlags || {}),
        soldiers: soldiers.map(s => ({ x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp, isCaptain: s.isCaptain || undefined })),
        archers:  archers.map(a => ({ x: a.x, y: a.y, hp: a.hp, maxHp: a.maxHp })),
        knights:  knights.map(k => ({ x: k.x, y: k.y, hp: k.hp, maxHp: k.maxHp })),
        raiders:  raiders.map(r => ({ x: r.x, y: r.y, hp: r.hp, maxHp: r.maxHp, type: r.type, state: r.state, objective: r.objective, destTX: r.destTX, destTY: r.destTY })),
        incidentState: incidentManager ? incidentManager.serialize() : null,
        droughtActive, strikeActive,
        merchantNPC: merchantNPC ? {
            x: merchantNPC.x, y: merchantNPC.y, startX: merchantNPC.startX, startY: merchantNPC.startY,
            speed: merchantNPC.speed, state: merchantNPC.state, _tradeOpened: merchantNPC._tradeOpened
        } : null,
        upgrades: gameState.upgrades,
        activeResearch: gameState.activeResearch,
        raidersDefeated: gameState.raidersDefeated,
        housesBuilt: gameState.housesBuilt || 0,
        farmsBuilt: gameState.farmsBuilt || 0,
        lastSeason: _lastSeason,
        tier2Upgrades: Object.assign({}, _tier2Upgrades),
        // Timers to prevent save-scumming
        spawnTimer, taxTimer, emigrationTimer, autoSaveTimer, jobScanTimer
    };
    for (let ty = 0; ty < grid.height; ty++) {
        for (let tx = 0; tx < grid.width; tx++) {
            const s = grid.structures[ty][tx];
            if (s) {
                const entry = { tx, ty, key: s.def.key };
                if (s.progress !== undefined) entry.progress = s.progress;
                if (s.hp !== undefined) entry.hp = s.hp;
                if (s.gateOpen !== undefined) entry.gateOpen = s.gateOpen;
                if (s.manuallyLocked) entry.manuallyLocked = true;
                if (s.decayTimer !== undefined) entry.decayTimer = s.decayTimer;
                if (s.isChild) {
                    entry.isChild = true;
                    entry.parentX = s.parentX;
                    entry.parentY = s.parentY;
                }
                data.structures.push(entry);
            }
            if (grid.tiles[ty][tx] === 'tile_road') {
                data.roads.push({ tx, ty });
            }
        }
    }
    localStorage.setItem(slotKey, JSON.stringify(data));
    console.log(`[Pixel Dominion] Game saved (${slotKey === MANUAL_SAVE_KEY ? 'manual slot' : 'autosave slot'}).`);
}
window.saveGame = saveGame;

export function flashAutosave() {
    const b = document.getElementById('autosave-banner');
    if (!b) return;
    b.classList.add('active');
    setTimeout(() => b.classList.remove('active'), 1000);
}
window.flashAutosave = flashAutosave;

export function loadGame(slotKey = SAVE_KEY) {
    const raw = localStorage.getItem(slotKey);
    if (!raw) { alert('No save found!'); return false; }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        console.error('[Pixel Dominion] Save data could not be parsed:', err);
        alert('Save data is corrupted and could not be loaded.');
        return false;
    }
    const d = migrateSaveData(parsed);
    if (!d) { alert('Save data is invalid.'); return false; }
    applyDifficultyConfig(d.difficulty ?? DEFAULT_DIFFICULTY_KEY, { refresh: false });
    
    // Schema Migrations: V1/V2 → V3 → V4
        // V4: no data structure changes — just versioning the reactive-UI architecture

    gameState.gold       = d.gold       ?? 200;
    gameState.housing    = d.housing    ?? 0;
    gameState.defense    = d.defense    ?? 0;
    gameState.population = d.population ?? 0;
    gameState.food       = d.food       ?? 0;
    gameState.happiness  = d.happiness  ?? 100;
    gameState.wood       = d.wood       ?? 100;
    gameState.stone      = d.stone      ?? 50;
    gameState.iron       = d.iron       ?? 0;
    
    setRaidTimer(Math.min(d.raidTimer ?? RAID_DURATION, RAID_DURATION));
    setRaidStrength(d.raidStrength ?? getRaidStrengthForWave((d.raidCount ?? 0) + 1, gameState.difficulty));
    setRaidCount(d.raidCount ?? 0);
    setScoutTimer(d._scoutTimer ?? 0);
    setScoutPhase(d._scoutPhase ?? false);
    setRaidQueued(d._raidQueued ?? false);
    setDayTimer(d.dayTimer ?? 0);
    
    gameState.day = d.day ?? 1;
    gameState.season = d.season ?? 'Spring';
    
    // Fallback getter from window
    const getDayPhaseFn = window._getDayPhase || ((t) => {
        const hr = (t / 60.0) * 24.0;
        for (const [phase, [start, end]] of Object.entries(DAY_PHASES)) {
            if (hr >= start && hr < end) return phase;
        }
        return 'day';
    });
    setDayPhase(d._dayPhase ?? getDayPhaseFn(dayTimer));
    setGriefPenalty(d._griefPenalty ?? 0);
    setCombatMode(d._combatMode ?? 'defend');
    setAllianceTimer(d._allianceTimer ?? 0);
    setSoldierCostMult(d._soldierCostMult ?? 1.0);
    setSoldierCostTimer(d._soldierCostTimer ?? 0);

    // Retrieve Action Map or fallback
    const actionMap = window._DIPLOMACY_ACTION_MAP || {};
    setDiplomacyTimers((d.diplomacyTimers || []).map(t => {
        const action = actionMap[t.actionKey];
        if (!action) return null;
        return { remainingSec: t.remainingSec, actionKey: t.actionKey, action };
    }).filter(Boolean));

    updateCombatModeUI();
    if (_scoutPhase) showEventBanner('SCOUTS SPOTTED!', 'Raiders approach — close your gates!');
    _updateDayPhaseGlyph();
    updateDaySeason();
    
    gameState.housesBuilt = d.housesBuilt ?? 0;
    gameState.farmsBuilt  = d.farmsBuilt  ?? 0;
    
    if (d.camera) {
        camera.x = d.camera.x ?? 0;
        camera.y = d.camera.y ?? 0;
        camera.zoom = d.camera.zoom ?? 1;
    }
    
    grid.tiles = grid._generateTiles();
    for (let ty = 0; ty < grid.height; ty++) {
        for (let tx = 0; tx < grid.width; tx++) {
            grid.structures[ty][tx] = null;
        }
    }
    
    (d.structures || []).forEach(({ tx, ty, key, progress, hp, gateOpen, manuallyLocked, decayTimer, isChild, parentX, parentY }) => {
        let def = BUILDINGS[key];
        if (!def && key === 'obstacle_tree')  def = TREE_DEF;
        if (!def && key === 'rubble')         def = RUBBLE_DEF;
        if (!def && key === 'stone_deposit')  def = STONE_DEP_DEF;
        if (!def && key === 'iron_vein')      def = IRON_VEIN_DEF;
        if (def && grid.inBounds(tx, ty)) {
            const entry = { def };
            if (progress !== undefined) entry.progress = progress;
            if (hp !== undefined) entry.hp = hp;
            if (key === 'gate') { entry.gateOpen = gateOpen ?? true; if (manuallyLocked) entry.manuallyLocked = true; }
            if (decayTimer !== undefined) entry.decayTimer = decayTimer;
            else if (key === 'rubble') entry.decayTimer = DAY_DURATION;
            if (isChild) {
                entry.isChild = true;
                entry.parentX = parentX;
                entry.parentY = parentY;
            }
            grid.structures[ty][tx] = entry;
        }
    });
    (d.roads || []).forEach(({ tx, ty }) => {
        if (grid.inBounds(tx, ty)) grid.tiles[ty][tx] = 'tile_road';
    });
    
    citizens.length = 0;
    soldiers.length = 0;
    archers.length  = 0;
    knights.length  = 0;
    raiders.length  = 0;
    activeProjectiles.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    
    setDroughtActive(d.droughtActive ?? false);
    setStrikeActive(d.strikeActive ?? false);
    
    if (d.merchantNPC) {
        const npc = new MerchantNPC();
        npc.x = d.merchantNPC.x;
        npc.y = d.merchantNPC.y;
        npc.startX = d.merchantNPC.startX;
        npc.startY = d.merchantNPC.startY;
        npc.speed = d.merchantNPC.speed;
        npc.state = d.merchantNPC.state;
        npc._tradeOpened = d.merchantNPC._tradeOpened;
        setMerchantNPC(npc);
    } else {
        setMerchantNPC(null);
    }
    
    if (incidentManager && d.incidentState) incidentManager.deserialize(d.incidentState);
    
    gameState.upgrades = Object.assign({
        reinforced_masonry: false,
        steel_bows: false,
        heavy_armor: false,
        crop_rotation: false,
        ballistic_engineering: false,
        iron_discipline: false,
        trade_guilds: false,
        field_medicine: false,
    }, d.upgrades ?? {});
    gameState.activeResearch = d.activeResearch ?? null;
    gameState.raidersDefeated = d.raidersDefeated ?? 0;
    gameState.endless = d.endless ?? false;
    gameState.victoryAchieved = d.victoryAchieved ?? false;
    gameState.diplomacyFlags = Object.assign({}, d.diplomacyFlags ?? {});
    setRaiderCamps((d.raiderCamps || []).map(c => ({ x: c.x, y: c.y, hp: c.hp, maxHp: c.maxHp ?? c.hp })));
    setTier2Upgrades(d.tier2Upgrades ? Object.assign({}, d.tier2Upgrades) : {});
    
    // Restore raw sub-second timers
    setSpawnTimer(d.spawnTimer ?? 0);
    setTaxTimer(d.taxTimer ?? 0);
    setEmigrationTimer(d.emigrationTimer ?? 0);
    setAutoSaveTimer(d.autoSaveTimer ?? 0);
    setJobScanTimer(d.jobScanTimer ?? 0);
    
    const cx = (grid.width / 2) * TILE_SIZE, cy = (grid.height / 2) * TILE_SIZE;
    for (let i = 0; i < gameState.population; i++) citizens.push(new Citizen(cx, cy));
    (d.soldiers || []).forEach(({ x, y, hp, maxHp, isCaptain }) => {
        const s = new Soldier(x, y);
        if (hp !== undefined) s.hp = hp;
        if (maxHp !== undefined) s.maxHp = maxHp;
        if (isCaptain) s.isCaptain = true;
        soldiers.push(s);
    });
    (d.archers  || []).forEach(({ x, y, hp, maxHp }) => {
        const a = new Archer(x, y);
        if (hp !== undefined) a.hp = hp;
        if (maxHp !== undefined) a.maxHp = maxHp;
        archers.push(a);
    });
    (d.knights  || []).forEach(({ x, y, hp, maxHp }) => {
        const k = new Knight(x, y);
        if (hp !== undefined) k.hp = hp;
        if (maxHp !== undefined) k.maxHp = maxHp;
        knights.push(k);
    });
    // RECONSTRUCT RAIDERS
    (d.raiders  || []).forEach(rData => {
        const r = new Raider(rData.x, rData.y, rData.type);
        if (rData.hp !== undefined) r.hp = rData.hp;
        if (rData.maxHp !== undefined) r.maxHp = rData.maxHp;
        if (rData.state !== undefined) r.state = rData.state;
        if (rData.objective !== undefined) r.objective = rData.objective;
        if (rData.destTX !== undefined) { r.destTX = rData.destTX; r.destTY = rData.destTY; }
        raiders.push(r);
    });
    setLastSeason(d.lastSeason ?? gameState.season);
    setGameIsPaused(false);
    setUserPaused(false);
    setTimeScale(1);
    setCurrentTerritoryRadius(calcTerritoryRadius());
    rebuildStructureLists();
    _buildGrassCache();
    _buildStaticCache();
    // Restore active-raid state AFTER raiders/citizens/structure lists exist, so
    // defenders re-engage and citizens re-hide when a mid-raid save is loaded.
    setRaidActive(d.raidActive ?? raiders.some(r => r.state === 'walking'));
    setRaidActiveTimer(d.raidActiveTimer ?? 0);
    setRaidBuildingsDestroyed(d.raidBuildingsDestroyed ?? 0);
    setRaidCitizensKilled(d.raidCitizensKilled ?? 0);
    if (window._setRaidersDefeatedAtWaveStart) window._setRaidersDefeatedAtWaveStart(gameState.raidersDefeated || 0);
    if (raidActive && window.sendCitizensToHide) window.sendCitizensToHide();
    refreshUI();
    if (window.updateTimePauseUI) window.updateTimePauseUI();
    updateRaidHUD();
    markUIDirty(); // Ensure a full UI refresh after load
    console.log(`[Pixel Dominion] Game loaded (v${SAVE_VERSION}).`);
    return true;
}
window.loadGame = loadGame;

export function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(MANUAL_SAVE_KEY);
    location.reload();
}
window.resetGame = resetGame;
