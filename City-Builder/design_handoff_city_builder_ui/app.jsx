/* App.jsx — Direction A focused canvas (v2)
   Polished Direction A with status-colored HUD, day/season indicator,
   and new screens: Main Menu, Save/Load, Building Inspector, Trade. */

const FULL_W = 1400;
const FULL_H = 800;

// =====================================================================
// GROUND COMPARISON (recommendation)
// =====================================================================
function GroundCompareBoard() {
  const variants = [
    {
      key: 'classic',
      title: 'Current · Checker',
      desc: 'Hard alternating grass + dirt. Reads as a debug grid; fights the cozy UI.',
      tone: '#a8584a',
    },
    {
      key: 'meadow',
      title: 'Meadow · RECOMMENDED',
      desc: 'Single grass tone with subtle organic variation. Dirt only where you carve paths or place buildings. Calm, painterly, lets the UI breathe.',
      tone: '#d4a838',
      recommended: true,
    },
    {
      key: 'softGrid',
      title: 'Soft grid',
      desc: 'Same-hue alternating lightness. Keeps a faint tile rhythm without the brown clash. A middle ground if you want the grid to remain readable when nothing is built.',
      tone: '#c8b078',
    },
    {
      key: 'autumn',
      title: 'Autumn',
      desc: 'Warmer sage and ochre. Pairs beautifully with the parchment HUD. Could swap seasonally for Spring / Summer / Winter palettes as Day progresses.',
      tone: '#a8521c',
    },
    {
      key: 'parchmentGround',
      title: 'Parchment ground',
      desc: 'Leans even further into the UI palette. Almost looks painted onto the same scroll. Bold — works if you really want UI + world unified.',
      tone: '#8a7050',
    },
  ];

  return (
    <div style={{
      width: 1300, height: 1380,
      background: '#1d1814',
      backgroundImage: 'radial-gradient(ellipse at center, #2a2520 0%, #0e0a06 100%)',
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      <div>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 28,
          letterSpacing: 4,
          color: '#f0e0b2',
          marginBottom: 6,
        }}>Ground palette · 5 options</div>
        <div style={{
          fontFamily: '"EB Garamond", serif',
          fontStyle: 'italic',
          fontSize: 15,
          color: '#c8b078',
          maxWidth: 880,
        }}>
          The harsh green-and-brown checker reads as a debug grid. The fix isn't a new color &mdash; it's
          dropping the alternating dirt entirely. Most tiles should be grass with subtle organic variation;
          dirt should appear only where it means something (paths between buildings, clearings, cleared ground
          where a structure sits). Compared below: same seed, same trees, same HUD &mdash; just the ground changes.
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 18,
      }}>
        {variants.map(v => (
          <GroundCard key={v.key} variant={v} />
        ))}
      </div>
    </div>
  );
}

function GroundCard({ variant }) {
  const W = 600, H = 360;
  return (
    <div style={{
      position: 'relative',
      border: variant.recommended
        ? `2px solid ${variant.tone}`
        : '1px solid rgba(232, 211, 168, 0.18)',
      background: '#0e0a06',
      boxShadow: variant.recommended ? `0 0 0 4px rgba(212, 168, 56, 0.12)` : 'none',
    }}>
      <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden' }}>
        <PixelWorld
          width={W}
          height={H}
          seed={42}
          density={0.14}
          palette={variant.key}
          paths={variant.key === 'classic' ? [] : [[3, 6, 9, 'h'], [8, 2, 6, 'v']]}
          patches={variant.key === 'classic' ? [] : [[6, 5, 1], [11, 7, 1]]}
        />
        {/* Mini HUD chip to show contrast with UI */}
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          <ParchmentPanel padding={8} corners={false} style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
            <Icon name="gold" size={14} />
            <span style={{ fontFamily: '"VT323", monospace', fontSize: 14, color: '#2a1d10' }}>200</span>
            <Icon name="wood" size={14} />
            <span style={{ fontFamily: '"VT323", monospace', fontSize: 14, color: '#2a1d10' }}>100</span>
          </ParchmentPanel>
        </div>
        {variant.recommended && (
          <div style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '3px 10px',
            background: 'linear-gradient(180deg, #c89a3b, #8c6618)',
            color: '#2a1d10',
            fontFamily: '"IM Fell English SC", serif',
            fontSize: 11,
            letterSpacing: 2,
            border: '1px solid #5a3f08',
          }}>★ RECOMMENDED</div>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px', background: '#1a1510' }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 14,
          letterSpacing: 2,
          color: variant.tone,
          marginBottom: 4,
        }}>{variant.title.toUpperCase()}</div>
        <div style={{
          fontFamily: '"EB Garamond", serif',
          fontStyle: 'italic',
          fontSize: 13,
          color: '#c8b078',
          lineHeight: 1.4,
        }}>{variant.desc}</div>
      </div>
    </div>
  );
}

// =====================================================================
// FULL GAME VIEW (polished)
// =====================================================================
function FullGameA() {
  return (
    <div style={{ position: 'relative', width: FULL_W, height: FULL_H, overflow: 'hidden', background: '#1a1a1a' }}>
      <PixelWorld width={FULL_W} height={FULL_H} seed={42} density={0.14}
        palette="meadow"
        paths={[[8, 12, 14, 'h'], [14, 6, 10, 'v']]}
        patches={[[12, 9, 1], [22, 14, 1], [6, 6, 1]]}
        showCursor={{ x: 16, y: 9, w: 1, h: 1, radius: 3 }} dimEdges />
      <DaySeasonA day={7} season="Autumn" />
      <RaidBannerA seconds={293} />
      <SettingsButtonA />
      <BuildMenuA selected="mine" />
      <HUDBarA />
    </div>
  );
}

// Variant: same view with the Building Inspector open
function FullGameAInspecting() {
  return (
    <div style={{ position: 'relative', width: FULL_W, height: FULL_H, overflow: 'hidden', background: '#1a1a1a' }}>
      <PixelWorld width={FULL_W} height={FULL_H} seed={42} density={0.14}
        palette="meadow"
        paths={[[8, 12, 14, 'h'], [14, 6, 10, 'v']]}
        patches={[[12, 9, 1], [22, 14, 1], [6, 6, 1]]}
        showCursor={{ x: 16, y: 8, w: 1, h: 1 }} dimEdges />
      <DaySeasonA day={7} season="Autumn" />
      <RaidBannerA seconds={293} />
      <SettingsButtonA />
      <BuildMenuA selected={null} />
      <HUDBarA />
      {/* Inspector floats near the selected tile */}
      <div style={{ position: 'absolute', left: 720, top: 380 }}>
        <BuildingInspectorA building="farm" />
      </div>
    </div>
  );
}

// Variant: raid warning state
function FullGameARaidWarning() {
  return (
    <div style={{ position: 'relative', width: FULL_W, height: FULL_H, overflow: 'hidden', background: '#1a1a1a' }}>
      <PixelWorld width={FULL_W} height={FULL_H} seed={88} density={0.14}
        palette="meadow"
        paths={[[10, 14, 12, 'h']]}
        patches={[[14, 10, 1], [20, 8, 1]]}
        dimEdges />
      {/* Reddened vignette to amplify urgency */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(140, 28, 18, 0) 40%, rgba(140, 28, 18, 0.35) 100%)',
        pointerEvents: 'none',
      }} />
      <DaySeasonA day={7} season="Autumn" />
      <RaidBannerA seconds={23} warning />
      <SettingsButtonA />
      <BuildMenuA selected={null} />
      <HUDBarA />
      {/* Event banner pinned below the raid banner */}
      <div style={{ position: 'absolute', top: 116, left: '50%', transform: 'translateX(-50%)' }}>
        <EventBannerA title="Raiders Are Sighted on the Northern Ridge" desc="Close your gates. Muster what soldiers you have." />
      </div>
    </div>
  );
}

// =====================================================================
// DETAIL: HUD CLOSE-UP (with status-colored chips called out)
// =====================================================================
function HUDDetailA() {
  return (
    <div style={{
      width: 1200, height: 380,
      background: '#2a2a28',
      backgroundImage: `radial-gradient(ellipse at center, #3a3530 0%, #1a1815 100%)`,
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <ParchmentPanel style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 22, paddingRight: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
        <Pod title="TREASURY">
          <ResChip icon="gold" label="Gold" value="200" trend="+4 /3s" status="treasure" />
        </Pod>
        <Pod title="STOCKPILE">
          <ResChip icon="wood" label="Wood" value="100" />
          <ResChip icon="stone" label="Stone" value="50" />
          <ResChip icon="iron" label="Iron" value="0" status="critical" />
        </Pod>
        <Pod title="HEARTH">
          <ResChip icon="citizens" label="Folk" value="12 / 20" />
          <ResChip icon="food" label="Food" value="48 / 60" trend="+10" status="healthy" />
          <ResChip icon="happiness" label="Joy" value="100%" status="healthy" />
        </Pod>
        <Pod title="GARRISON" style={{ borderRight: 'none', paddingRight: 0 }}>
          <ResChip icon="defense" label="Defense" value="22" />
          <ResChip icon="sword" label="Soldiers" value="3" />
          <ResChip icon="bow" label="Archers" value="0" />
        </Pod>
      </ParchmentPanel>
      <Note>Status-colored values: <span style={{ color: '#c89a3b' }}>gold = treasure</span>,
        <span style={{ color: '#2a4a18' }}> green = healthy</span>,
        <span style={{ color: '#8c2c1c' }}> red = critical</span> (plus a small red pip on the icon).</Note>
    </div>
  );
}

// =====================================================================
// DETAIL: BUILD MENU CLOSE-UP (states)
// =====================================================================
function BuildDetailA() {
  return (
    <div style={{
      width: 760, height: 760,
      background: '#2a2a28',
      backgroundImage: `radial-gradient(ellipse at center, #3a3530 0%, #1a1815 100%)`,
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 18,
    }}>
      <div style={{ position: 'relative' }}>
        <ParchmentPanel style={{ width: 320, padding: 0 }}>
          <div style={{ padding: '10px 16px 6px', borderBottom: `1px solid ${A.parchmentEdge}` }}>
            <div style={{
              fontFamily: '"IM Fell English SC", serif',
              fontSize: 20,
              letterSpacing: 5,
              color: A.wineDark,
              textAlign: 'center',
            }}>BUILD</div>
          </div>
          <div style={{ display: 'flex', borderBottom: `1px solid ${A.parchmentEdge}`, background: 'rgba(140, 102, 24, 0.07)' }}>
            {['All','Civic','Industry','Military'].map((t,i) => (
              <div key={t} style={{
                flex: 1,
                borderBottom: i === 2 ? `2px solid ${A.wine}` : '2px solid transparent',
                background: i === 2 ? A.parchment : 'transparent',
                padding: '8px 4px',
                fontFamily: '"IM Fell English SC", serif',
                fontSize: 11,
                letterSpacing: 1.5,
                color: i === 2 ? A.wineDark : A.inkFaint,
                textAlign: 'center',
              }}>{t.toUpperCase()}</div>
            ))}
          </div>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <BuildItemA item={{ key: 'lumberyard', name: 'Lumber Yard', cat: 'industry', cost: { gold: 60 }, yields: 'Wood / min' }} />
            <BuildItemA item={{ key: 'quarry', name: 'Quarry', cat: 'industry', cost: { gold: 100, wood: 20 }, yields: 'Stone / min' }} />
            <BuildItemA item={{ key: 'mine', name: 'Mine', cat: 'industry', cost: { gold: 150, wood: 50 }, yields: 'Iron / min' }} selected />
            <BuildItemA item={{ key: 'farm', name: 'Farm', cat: 'civic', cost: { gold: 80 }, yields: '+10 Food' }} />
            <BuildItemA item={{ key: 'archery', name: 'Archery Range', cat: 'military', cost: { gold: 80, wood: 30, iron: 10 }, yields: 'Train Archers', locked: true }} />
            <BuildItemA item={{ key: 'ballista', name: 'Ballista Twr', cat: 'military', cost: { gold: 150, wood: 40, iron: 20 }, yields: '+15 Defense', locked: true }} />
          </div>
        </ParchmentPanel>
        {/* State callouts */}
        <Callout style={{ top: 175, left: -160 }} text="Selected" arrow="right" />
        <Callout style={{ top: 305, left: -160 }} text="Locked · req. Smith" arrow="right" />
      </div>
      <Note>Tabbed by category. Each item shows pixel sprite, name, cost-with-icons, yield. Locked items dim to 40% with subtitle reason.</Note>
    </div>
  );
}

function Callout({ text, style = {}, arrow = 'right' }) {
  return (
    <div style={{
      position: 'absolute',
      ...style,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: '"VT323", monospace',
      fontSize: 13,
      color: '#d4a838',
      letterSpacing: 1,
    }}>
      <span>// {text}</span>
      <span style={{ color: '#8c6618', fontSize: 16 }}>{arrow === 'right' ? '→' : '←'}</span>
    </div>
  );
}

// =====================================================================
// COLLATERAL: tooltips, event banner, settings, stats, raid modals
// =====================================================================
function CollateralA() {
  return (
    <div style={{
      width: 1100, height: 880,
      background: '#2a2a28',
      backgroundImage: `radial-gradient(ellipse at center, #3a3530 0%, #1a1815 100%)`,
      padding: 32,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'auto auto',
      gap: 32,
      alignItems: 'start',
    }}>
      <Cell label="Tile tooltip · hover">
        <TooltipA />
      </Cell>
      <Cell label="Event banner · top-center">
        <EventBannerA />
      </Cell>
      <Cell label="Settings drawer">
        <SettingsDrawerA />
      </Cell>
      <Cell label="Stats overlay (TAB)">
        <StatsOverlayA />
      </Cell>
      <Cell label="Raid result — victory vs. defeat" span>
        <div style={{ display: 'flex', gap: 24 }}>
          <RaidModalA victory />
          <RaidModalA victory={false} />
        </div>
      </Cell>
    </div>
  );
}

function Cell({ label, children, span = false, color = '#8a7050' }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : 'auto' }}>
      <div style={{
        fontFamily: '"VT323", monospace',
        fontSize: 13,
        letterSpacing: 1.5,
        color,
        marginBottom: 10,
        textTransform: 'uppercase',
      }}>// {label}</div>
      <div>{children}</div>
    </div>
  );
}

function Note({ children, color = '#a08868' }) {
  return (
    <div style={{
      fontFamily: '"VT323", monospace',
      fontSize: 14,
      letterSpacing: 0.5,
      color,
      textAlign: 'center',
      maxWidth: 820,
      lineHeight: 1.5,
    }}>{children}</div>
  );
}

// =====================================================================
// NEW: BUILDING INSPECTOR (close-up)
// =====================================================================
function BuildingInspectorDetail() {
  return (
    <div style={{
      width: 1100, height: 560,
      background: '#2a2a28',
      backgroundImage: `radial-gradient(ellipse at center, #3a3530 0%, #1a1815 100%)`,
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      alignItems: 'center',
    }}>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        <Cell label="Worked farm (2 / 3 workers)">
          <BuildingInspectorA building="farm" />
        </Cell>
        <Cell label="Barracks (military)">
          <BuildingInspectorA building="barracks" />
        </Cell>
      </div>
      <Note>Click any placed building → inspector floats near it. HP bar, worker pips, yield, and three actions (Assign · Upgrade · Demolish). Upgrade path is suggested as italic hint text.</Note>
    </div>
  );
}

// =====================================================================
// NEW: TRADE MODAL (close-up)
// =====================================================================
function TradeDetail() {
  return (
    <div style={{
      width: 700, height: 720,
      background: '#2a2a28',
      backgroundImage: `radial-gradient(ellipse at center, #3a3530 0%, #1a1815 100%)`,
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 18,
    }}>
      <TradeModalA />
      <Note>Wandering merchant arrives every few days. Each row is a give-for-gain swap with icon-coded costs. "Favored" deal is highlighted by the merchant.</Note>
    </div>
  );
}

// =====================================================================
// NEW: SAVE / LOAD (close-up)
// =====================================================================
function SaveLoadDetail() {
  return (
    <div style={{
      width: 1100, height: 720,
      background: '#2a2a28',
      backgroundImage: `radial-gradient(ellipse at center, #3a3530 0%, #1a1815 100%)`,
      padding: 40,
      display: 'flex',
      gap: 32,
      alignItems: 'flex-start',
      justifyContent: 'center',
    }}>
      <div>
        <div style={{
          fontFamily: '"VT323", monospace',
          fontSize: 13,
          letterSpacing: 1.5,
          color: '#a08868',
          marginBottom: 10,
        }}>// LOAD MODE</div>
        <SaveLoadA mode="load" />
      </div>
      <div>
        <div style={{
          fontFamily: '"VT323", monospace',
          fontSize: 13,
          letterSpacing: 1.5,
          color: '#a08868',
          marginBottom: 10,
        }}>// SAVE MODE</div>
        <SaveLoadA mode="save" />
      </div>
    </div>
  );
}

// =====================================================================
// INTRO
// =====================================================================
function IntroBoard() {
  return (
    <div style={{
      width: 1100, height: 380,
      background: '#1d1814',
      backgroundImage: `radial-gradient(ellipse at center, #2a2520 0%, #0e0a06 100%)`,
      padding: 40,
      color: '#e8d3a8',
      fontFamily: '"EB Garamond", Georgia, serif',
    }}>
      <div style={{
        fontFamily: '"IM Fell English SC", serif',
        fontSize: 14,
        letterSpacing: 5,
        color: '#d4a838',
        marginBottom: 4,
      }}>DIRECTION A · POLISHED</div>
      <div style={{
        fontFamily: '"IM Fell English SC", serif',
        fontSize: 42,
        letterSpacing: 4,
        color: '#f0e0b2',
        marginBottom: 14,
      }}>Illuminated Parchment</div>
      <div style={{ fontSize: 16, color: '#c8b078', fontStyle: 'italic', marginBottom: 24, maxWidth: 880 }}>
        Continuing the cozy, hand-painted direction. Added status-colored stats, a Day &amp; Season indicator,
        polished build-menu states, and four new surfaces: Main Menu, Save/Load, Building Inspector, and Trade.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        <PrincipleCol title="Polish" items={[
          'Resource chips now color-coded by status — critical iron flashes red',
          'Day / season replaces the FPS dump in the top corner',
          'Build menu has clearer selected vs. locked states',
          'Tooltip aligns cost icons with what\'s in the HUD',
        ]} />
        <PrincipleCol title="New screens" items={[
          'Main menu / title (Hearthwood)',
          'Save & load with mini-map thumbnails',
          'Building inspector (click → details + actions)',
          'Wandering merchant trade modal',
        ]} />
        <PrincipleCol title="System" items={[
          'Parchment + ink everywhere · gold / leaf / wine accents',
          'IM Fell English SC for titles, EB Garamond for body, VT323 for numerals',
          'Wax-seal pattern for important state (raid, victory, merchant)',
          'Pixel motif corners on every panel',
        ]} />
      </div>
    </div>
  );
}

function PrincipleCol({ title, items }) {
  return (
    <div>
      <div style={{
        fontFamily: '"Cinzel", serif',
        fontSize: 13,
        letterSpacing: 3,
        color: '#d4a838',
        marginBottom: 10,
        textTransform: 'uppercase',
      }}>{title}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <span style={{ color: '#d4a838', flexShrink: 0, marginTop: 2 }}>◆</span>
            <span style={{ color: '#d8c8a0' }}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =====================================================================
// MAIN
// =====================================================================
function App() {
  return (
    <DesignCanvas>
      <DCSection id="ground" title="Ground · Recommendation" subtitle="Five options compared — the current checker fights the UI">
        <DCArtboard id="ground-compare" label="Compare 5 ground palettes" width={1300} height={1380}>
          <GroundCompareBoard />
        </DCArtboard>
      </DCSection>

      <DCSection id="intro" title="Direction A · Polished" subtitle="Continuing the cozy parchment direction">
        <DCArtboard id="intro-1" label="Overview" width={1100} height={380}>
          <IntroBoard />
        </DCArtboard>
      </DCSection>

      <DCSection id="game" title="Game Surfaces" subtitle="The view you'll spend the most time looking at">
        <DCArtboard id="g-full" label="Full view · placing a mine" width={FULL_W} height={FULL_H}>
          <FullGameA />
        </DCArtboard>
        <DCArtboard id="g-inspect" label="Full view · inspecting a farm" width={FULL_W} height={FULL_H}>
          <FullGameAInspecting />
        </DCArtboard>
        <DCArtboard id="g-raid" label="Full view · raid imminent" width={FULL_W} height={FULL_H}>
          <FullGameARaidWarning />
        </DCArtboard>
        <DCArtboard id="g-hud" label="HUD bar · status colors" width={1200} height={380}>
          <HUDDetailA />
        </DCArtboard>
        <DCArtboard id="g-build" label="Build menu · states" width={760} height={760}>
          <BuildDetailA />
        </DCArtboard>
      </DCSection>

      <DCSection id="modals" title="Modals & Overlays" subtitle="Tooltips, banners, settings, stats, raid outcomes">
        <DCArtboard id="m-collateral" label="Tooltips, settings, stats, raid modals" width={1100} height={880}>
          <CollateralA />
        </DCArtboard>
        <DCArtboard id="m-inspector" label="Building inspector · two examples" width={1100} height={560}>
          <BuildingInspectorDetail />
        </DCArtboard>
        <DCArtboard id="m-trade" label="Trade · Wandering Merchant" width={700} height={720}>
          <TradeDetail />
        </DCArtboard>
      </DCSection>

      <DCSection id="meta" title="Meta Screens" subtitle="Outside the game world: menu and saves">
        <DCArtboard id="meta-menu" label="Main menu · title screen" width={FULL_W} height={FULL_H}>
          <MainMenuA width={FULL_W} height={FULL_H} />
        </DCArtboard>
        <DCArtboard id="meta-saveload" label="Save & Load realm" width={1100} height={720}>
          <SaveLoadDetail />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
