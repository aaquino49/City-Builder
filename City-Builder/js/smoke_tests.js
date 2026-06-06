// Pixel Dominion — Smoke Test Suite
export function runSmokeTests() {
    console.log('[Pixel Dominion] Starting smoke test suite...');
    let passed = 0, failed = 0;

    const assert = (name, cond) => {
        if (cond) {
            console.log(`%c✓ TEST PASSED: ${name}`, 'color: #88cc44');
            passed++;
        } else {
            console.error(`✗ TEST FAILED: ${name}`);
            failed++;
        }
    };

    const snapshotArray = arr => arr.slice();
    const restoreArray = (arr, saved) => {
        arr.length = 0;
        arr.push(...saved);
    };
    const saved = {
        gameState: {
            population: window.gameState.population,
            food: window.gameState.food,
            season: window.gameState.season,
            housing: window.gameState.housing,
        },
        activeGranaries: snapshotArray(window.activeGranaries),
        activeTaverns: snapshotArray(window.activeTaverns),
        soldiers: snapshotArray(window.soldiers),
        archers: snapshotArray(window.archers),
        knights: snapshotArray(window.knights),
        tier2Upgrades: Object.assign({}, window._tier2Upgrades),
        droughtActive: window.droughtActive,
        griefPenalty: window._griefPenalty,
        structures: [
            window.grid?.structures?.[5]?.[4],
            window.grid?.structures?.[5]?.[5],
            window.grid?.structures?.[5]?.[6],
        ],
    };

    try {
        // Test 1: Food Capacity Calculation
        window.activeGranaries.length = 0;
        assert('Base Food Cap should be 200', window.getFoodCap() === 200);

        window.activeGranaries.push({ tx: 10, ty: 10 });
        assert('Food Cap with 1 Granary should be 400', window.getFoodCap() === 400);

        window.setTier2Upgrades({ '10,10': true });
        assert('Food Cap with 1 Upgraded Granary should be 550', window.getFoodCap() === 550);
        window.setTier2Upgrades({});
        window.activeGranaries.length = 0;

        // Test 2: Happiness Composite Formula
        window.gameState.population = 10;
        window.gameState.food = 25; // Food Surplus (>20) -> +25
        window.activeTaverns.length = 0;
        window.droughtActive = false;
        window.setGriefPenalty(0);
        window.gameState.season = 'Spring';
        window.gameState.housing = 10;
        window.soldiers.length = 0;
        window.archers.length = 0;
        window.knights.length = 0;

        // Base 45 + Food Surplus 25 = 70 happiness
        let h = window.calcHappiness();
        assert(`Happiness with food surplus should be 70 (got ${h})`, h === 70);

        // Winter penalty -> -5
        window.gameState.season = 'Winter';
        h = window.calcHappiness();
        assert(`Happiness in winter should be 65 (got ${h})`, h === 65);
        window.gameState.season = 'Spring';

        // Add 1 Tavern -> +10
        window.activeTaverns.push({ tx: 5, ty: 5 });
        h = window.calcHappiness();
        assert(`Happiness with 1 Tavern should be 80 (got ${h})`, h === 80);
        window.activeTaverns.length = 0;

        // Test 3: Adjacency count
        // Set up mock grid structures
        window.grid.structures[5][5] = { def: { key: 'farm' } };
        window.grid.structures[5][6] = { def: { key: 'farm' } };
        window.grid.structures[5][4] = { def: { key: 'farm' } };
        const farmAdj = window.getAdjacencyBonus(5, 5, 'farm');
        assert(`Farm adjacent to 2 other farms should yield +1.0 food (got ${farmAdj})`, farmAdj === 1.0);

        console.log(`%c[Pixel Dominion] Smoke tests complete. Passed: ${passed}, Failed: ${failed}`, failed > 0 ? 'color: #ff4444; font-weight: bold' : 'color: #88cc44; font-weight: bold');
    } catch (err) {
        console.error('[Pixel Dominion] Exception running smoke tests:', err);
    } finally {
        window.gameState.population = saved.gameState.population;
        window.gameState.food = saved.gameState.food;
        window.gameState.season = saved.gameState.season;
        window.gameState.housing = saved.gameState.housing;
        restoreArray(window.activeGranaries, saved.activeGranaries);
        restoreArray(window.activeTaverns, saved.activeTaverns);
        restoreArray(window.soldiers, saved.soldiers);
        restoreArray(window.archers, saved.archers);
        restoreArray(window.knights, saved.knights);
        window.setTier2Upgrades(saved.tier2Upgrades);
        window.droughtActive = saved.droughtActive;
        window.setGriefPenalty(saved.griefPenalty);
        if (window.grid?.structures?.[5]) {
            window.grid.structures[5][4] = saved.structures[0];
            window.grid.structures[5][5] = saved.structures[1];
            window.grid.structures[5][6] = saved.structures[2];
        }
    }
}
