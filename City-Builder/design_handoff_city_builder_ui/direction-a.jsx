/* DirectionA.jsx — "Illuminated Parchment"
   Cozy medieval village: warm parchment panels, hand-painted illuminations,
   leaf-green & wine-red accents. Bottom HUD bar with grouped pods. */

const A = {
  parchment: '#f0e0b2',
  parchmentDark: '#e0c890',
  parchmentEdge: '#c8a868',
  ink: '#2a1d10',
  inkSoft: '#5a4530',
  inkFaint: '#8a7050',
  gold: '#c89a3b',
  goldDark: '#8c6618',
  wine: '#8c2c1c',
  wineDark: '#5a1808',
  leaf: '#4a6b2a',
  leafDark: '#2a4a18',
  shadow: 'rgba(40, 25, 10, 0.22)',
};

// Reusable parchment panel with illuminated corner motifs
function ParchmentPanel({ children, style = {}, padding = 16, corners = true, title = null }) {
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(180deg, ${A.parchment} 0%, ${A.parchmentDark} 100%)`,
      border: `2px solid ${A.parchmentEdge}`,
      borderRadius: 2,
      padding,
      color: A.ink,
      fontFamily: '"EB Garamond", "Cormorant Garamond", Georgia, serif',
      boxShadow: `0 6px 18px ${A.shadow}, inset 0 0 0 1px rgba(255, 240, 200, 0.5)`,
      ...style,
    }}>
      {corners && <ParchmentCorners />}
      {title && <div style={{
        fontFamily: '"IM Fell English SC", "EB Garamond", serif',
        fontSize: 14,
        letterSpacing: 2,
        color: A.wineDark,
        borderBottom: `1px solid ${A.parchmentEdge}`,
        paddingBottom: 6,
        marginBottom: 10,
        textTransform: 'uppercase',
      }}>{title}</div>}
      {children}
    </div>
  );
}

function ParchmentCorners() {
  const C = ({ style }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: 'absolute', ...style }} shapeRendering="crispEdges">
      <rect x="0" y="0" width="14" height="2" fill={A.goldDark} />
      <rect x="0" y="0" width="2" height="14" fill={A.goldDark} />
      <rect x="2" y="2" width="10" height="1" fill={A.gold} />
      <rect x="2" y="2" width="1" height="10" fill={A.gold} />
      <rect x="3" y="3" width="4" height="1" fill={A.leaf} />
      <rect x="3" y="3" width="1" height="4" fill={A.leaf} />
      <rect x="6" y="6" width="2" height="2" fill={A.wine} />
    </svg>
  );
  return (
    <>
      <C style={{ top: 3, left: 3 }} />
      <C style={{ top: 3, right: 3, transform: 'scaleX(-1)' }} />
      <C style={{ bottom: 3, left: 3, transform: 'scaleY(-1)' }} />
      <C style={{ bottom: 3, right: 3, transform: 'scale(-1, -1)' }} />
    </>
  );
}

// A "wax seal" badge for important state (raid warning, etc)
function WaxSeal({ children, color = A.wine, size = 36 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, ${color === A.wine ? '#b04030' : color}, ${color === A.wine ? A.wineDark : color} 70%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f5e2c0',
      fontFamily: '"IM Fell English SC", serif',
      fontSize: size * 0.4,
      fontWeight: 'bold',
      letterSpacing: 1,
      boxShadow: `0 2px 6px rgba(0,0,0,0.4), inset -2px -2px 4px rgba(0,0,0,0.3), inset 2px 2px 3px rgba(255,255,255,0.18)`,
      border: `1px solid ${A.wineDark}`,
    }}>{children}</div>
  );
}

// Resource chip used in HUD pods
function ResChip({ icon, label, value, trend, status = 'normal', mono = false }) {
  // status: 'normal' | 'low' | 'critical' | 'healthy' | 'treasure'
  const valueColor =
    status === 'critical' ? A.wine :
    status === 'low'      ? '#a85a18' :
    status === 'healthy'  ? A.leafDark :
    status === 'treasure' ? A.goldDark :
    A.ink;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 2px',
      minWidth: 0,
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon name={icon} size={20} />
        {status === 'critical' && (
          <div style={{
            position: 'absolute',
            top: -2,
            right: -4,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: A.wine,
            boxShadow: `0 0 0 1px ${A.parchment}, 0 0 6px ${A.wine}`,
          }} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: A.inkFaint,
          fontFamily: '"IM Fell English SC", serif',
          lineHeight: 1,
        }}>{label}</div>
        <div style={{
          fontSize: 18,
          fontWeight: 600,
          color: valueColor,
          fontFamily: mono ? '"VT323", "Courier New", monospace' : '"EB Garamond", serif',
          lineHeight: 1.1,
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
        }}>
          {value}
          {trend && <span style={{
            fontSize: 11,
            color: trend.startsWith('-') ? A.wine : A.leafDark,
            fontFamily: '"EB Garamond", serif',
          }}>{trend}</span>}
        </div>
      </div>
    </div>
  );
}

// HUD pod — group of related stats with quiet divider
function Pod({ title, children, style = {} }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      gap: 14,
      paddingRight: 18,
      borderRight: `1px solid ${A.parchmentEdge}`,
      ...style,
    }}>
      <div style={{
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        fontFamily: '"IM Fell English SC", serif',
        fontSize: 9,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: A.goldDark,
        alignSelf: 'center',
      }}>{title}</div>
      <div style={{ display: 'flex', gap: 14 }}>{children}</div>
    </div>
  );
}

// ===== Bottom HUD Bar =====
function HUDBarA({ raidSeconds = 293 }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'stretch',
      gap: 0,
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
    </div>
  );
}

// ===== Raid Banner (top center, hanging scroll) =====
function RaidBannerA({ seconds = 293, warning = false }) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* hanging cords */}
      <div style={{ display: 'flex', gap: 180, marginBottom: -2 }}>
        <div style={{ width: 2, height: 12, background: A.wineDark }} />
        <div style={{ width: 2, height: 12, background: A.wineDark }} />
      </div>
      <div style={{
        position: 'relative',
        background: warning
          ? `linear-gradient(180deg, #c44b3a 0%, ${A.wineDark} 100%)`
          : `linear-gradient(180deg, ${A.parchment} 0%, ${A.parchmentDark} 100%)`,
        border: `2px solid ${warning ? A.wineDark : A.parchmentEdge}`,
        color: warning ? '#f5e2c0' : A.ink,
        padding: '10px 28px 14px',
        fontFamily: '"IM Fell English SC", serif',
        textAlign: 'center',
        clipPath: 'polygon(0 0, 100% 0, 100% 85%, 92% 100%, 50% 92%, 8% 100%, 0 85%)',
        minWidth: 260,
        boxShadow: `0 6px 16px ${A.shadow}`,
      }}>
        <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.7 }}>
          {warning ? '⚔ RAID APPROACHES ⚔' : 'NEXT RAID'}
        </div>
        <div style={{ fontSize: 28, fontFamily: '"VT323", monospace', letterSpacing: 2, lineHeight: 1, marginTop: 2 }}>
          {m}:{s}
        </div>
        <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6, marginTop: 2 }}>
          DAY 7 · AUTUMN
        </div>
      </div>
    </div>
  );
}

// ===== Build Menu (right side, grouped & tabbed) =====
function BuildMenuA({ selected = 'mine' }) {
  const [tab, setTab] = React.useState('all');
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'civic', label: 'Civic' },
    { id: 'industry', label: 'Industry' },
    { id: 'military', label: 'Military' },
  ];
  const items = [
    { key: 'house', name: 'House', cat: 'civic', cost: { gold: 50 }, yields: '+4 Housing' },
    { key: 'farm', name: 'Farm', cat: 'civic', cost: { gold: 80 }, yields: '+10 Food' },
    { key: 'road', name: 'Road', cat: 'civic', cost: { gold: 5 }, yields: '2× Speed' },
    { key: 'lumberyard', name: 'Lumber Yard', cat: 'industry', cost: { gold: 60 }, yields: 'Wood / min' },
    { key: 'quarry', name: 'Quarry', cat: 'industry', cost: { gold: 100, wood: 20 }, yields: 'Stone / min' },
    { key: 'mine', name: 'Mine', cat: 'industry', cost: { gold: 150, wood: 50 }, yields: 'Iron / min' },
    { key: 'wall', name: 'Wall', cat: 'military', cost: { gold: 5 }, yields: '+2 Defense' },
    { key: 'gate', name: 'Gate', cat: 'military', cost: { gold: 15, wood: 10 }, yields: '+3 Defense' },
    { key: 'tower', name: 'Tower', cat: 'military', cost: { gold: 150 }, yields: '+10 Defense' },
    { key: 'barracks', name: 'Barracks', cat: 'military', cost: { gold: 200 }, yields: 'Train Soldiers' },
    { key: 'archery', name: 'Archery Range', cat: 'military', cost: { gold: 80, wood: 30, iron: 10 }, yields: 'Train Archers', locked: true },
    { key: 'ballista', name: 'Ballista Twr', cat: 'military', cost: { gold: 150, wood: 40, iron: 20 }, yields: '+15 Defense', locked: true },
  ];
  const visible = tab === 'all' ? items : items.filter(i => i.cat === tab);

  return (
    <ParchmentPanel style={{ position: 'absolute', top: 24, right: 24, width: 280, padding: 0 }}>
      {/* header */}
      <div style={{
        padding: '10px 16px 6px',
        borderBottom: `1px solid ${A.parchmentEdge}`,
      }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 18,
          letterSpacing: 4,
          color: A.wineDark,
          textAlign: 'center',
        }}>BUILD</div>
      </div>
      {/* tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${A.parchmentEdge}`, background: 'rgba(140, 102, 24, 0.07)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1,
            background: tab === t.id ? A.parchment : 'transparent',
            border: 'none',
            borderBottom: tab === t.id ? `2px solid ${A.wine}` : '2px solid transparent',
            padding: '7px 4px',
            fontFamily: '"IM Fell English SC", serif',
            fontSize: 11,
            letterSpacing: 1.5,
            color: tab === t.id ? A.wineDark : A.inkFaint,
            cursor: 'pointer',
          }}>{t.label.toUpperCase()}</button>
        ))}
      </div>
      {/* items */}
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 540, overflow: 'auto' }}>
        {visible.map(it => (
          <BuildItemA key={it.key} item={it} selected={selected === it.key} />
        ))}
      </div>
    </ParchmentPanel>
  );
}

function BuildItemA({ item, selected }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 8px',
      background: selected ? 'rgba(140, 44, 28, 0.12)' : 'transparent',
      border: selected ? `1px solid ${A.wine}` : '1px solid transparent',
      borderRadius: 2,
      opacity: item.locked ? 0.42 : 1,
      cursor: item.locked ? 'not-allowed' : 'pointer',
      position: 'relative',
    }}>
      <div style={{
        width: 36,
        height: 36,
        background: 'rgba(90, 63, 37, 0.16)',
        border: `1px solid ${A.parchmentEdge}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <BuildingSprite name={item.key} size={28} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 13,
          letterSpacing: 0.5,
          color: A.ink,
          lineHeight: 1.1,
        }}>{item.name}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center', fontSize: 11, color: A.inkSoft }}>
          {item.cost.gold && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icon name="gold" size={10} />{item.cost.gold}</span>}
          {item.cost.wood && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icon name="wood" size={10} />{item.cost.wood}</span>}
          {item.cost.iron && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icon name="iron" size={10} />{item.cost.iron}</span>}
        </div>
      </div>
      <div style={{
        fontSize: 10,
        letterSpacing: 0.5,
        color: A.leafDark,
        fontFamily: '"EB Garamond", serif',
        fontStyle: 'italic',
        textAlign: 'right',
        maxWidth: 80,
      }}>{item.locked ? '— locked —' : item.yields}</div>
    </div>
  );
}

// ===== Top-left dev overlay (FPS etc) — quiet, faded =====
function DevOverlayA() {
  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: 12,
      fontFamily: '"VT323", monospace',
      fontSize: 12,
      letterSpacing: 1,
      color: 'rgba(245, 230, 194, 0.55)',
      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
    }}>
      120 FPS · 1.00× · 256, 677
    </div>
  );
}

// ===== Settings (corner icon → drawer) =====
function SettingsButtonA() {
  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      display: 'flex',
      gap: 6,
    }}>
      <CornerIcon symbol="⚙" />
      <CornerIcon symbol="♪" />
      <CornerIcon symbol="?" />
    </div>
  );
}

function CornerIcon({ symbol }) {
  return (
    <div style={{
      width: 32,
      height: 32,
      background: `linear-gradient(180deg, ${A.parchment}, ${A.parchmentDark})`,
      border: `2px solid ${A.parchmentEdge}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"IM Fell English SC", serif',
      color: A.wineDark,
      fontSize: 18,
      boxShadow: `0 3px 8px ${A.shadow}`,
      cursor: 'pointer',
    }}>{symbol}</div>
  );
}

// ===== Tile selection / placement tooltip =====
function TooltipA({ title = 'Mine', desc = 'Produces 1 Iron per minute. Place on stone-rich tile.', cost = { gold: 150, wood: 50 }, yields = '+1 Iron / min' }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <ParchmentPanel style={{ padding: 12, minWidth: 220 }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 16,
          letterSpacing: 2,
          color: A.wineDark,
          marginBottom: 6,
        }}>{title.toUpperCase()}</div>
        <div style={{ fontSize: 13, color: A.inkSoft, lineHeight: 1.35, fontStyle: 'italic', marginBottom: 10 }}>
          {desc}
        </div>
        <div style={{ borderTop: `1px solid ${A.parchmentEdge}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
            {cost.gold && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="gold" size={13} />{cost.gold}</span>}
            {cost.wood && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="wood" size={13} />{cost.wood}</span>}
            {cost.iron && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="iron" size={13} />{cost.iron}</span>}
          </div>
          <div style={{ fontSize: 11, color: A.leafDark, fontStyle: 'italic' }}>{yields}</div>
        </div>
      </ParchmentPanel>
    </div>
  );
}

// ===== Event banner =====
function EventBannerA({ title = 'A Wandering Merchant Arrives', desc = 'Trade 50 Wood for 30 Stone — until next dawn.' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', boxShadow: `0 6px 18px ${A.shadow}` }}>
      <div style={{
        width: 8,
        background: `linear-gradient(180deg, ${A.wine}, ${A.wineDark})`,
      }} />
      <ParchmentPanel corners={false} style={{ borderRadius: 0, padding: '12px 18px', minWidth: 360, borderLeft: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WaxSeal size={32}>✺</WaxSeal>
          <div>
            <div style={{
              fontFamily: '"IM Fell English SC", serif',
              fontSize: 14,
              letterSpacing: 1.5,
              color: A.wineDark,
              lineHeight: 1.1,
            }}>{title.toUpperCase()}</div>
            <div style={{ fontSize: 13, color: A.inkSoft, fontStyle: 'italic', marginTop: 2 }}>{desc}</div>
          </div>
        </div>
      </ParchmentPanel>
    </div>
  );
}

// ===== Settings drawer =====
function SettingsDrawerA() {
  return (
    <ParchmentPanel style={{ width: 280 }} title="Settings">
      <SettingsRow label="Master">
        <Slider value={0.8} color={A.wine} />
      </SettingsRow>
      <SettingsRow label="Music">
        <Slider value={0.6} color={A.wine} />
      </SettingsRow>
      <SettingsRow label="Sound">
        <Slider value={0.9} color={A.wine} />
      </SettingsRow>
      <div style={{ borderTop: `1px solid ${A.parchmentEdge}`, marginTop: 10, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ScrollButton label="Save City" icon="✎" />
        <ScrollButton label="Load City" icon="⌂" />
        <ScrollButton label="Reset Game" icon="✕" danger />
      </div>
    </ParchmentPanel>
  );
}

function SettingsRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <div style={{
        width: 60,
        fontFamily: '"IM Fell English SC", serif',
        fontSize: 11,
        letterSpacing: 1.5,
        color: A.inkSoft,
      }}>{label.toUpperCase()}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Slider({ value = 0.5, color = A.wine }) {
  return (
    <div style={{ position: 'relative', height: 10, background: 'rgba(40, 25, 10, 0.18)', borderRadius: 1, border: `1px solid ${A.parchmentEdge}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${value * 100}%`, background: color, borderRadius: 0 }} />
      <div style={{
        position: 'absolute',
        left: `calc(${value * 100}% - 8px)`,
        top: -3,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${A.gold}, ${A.goldDark} 75%)`,
        border: `1px solid ${A.wineDark}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

function ScrollButton({ label, icon, danger = false }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 10px',
      background: `linear-gradient(180deg, ${A.parchment}, ${A.parchmentDark})`,
      border: `1px solid ${A.parchmentEdge}`,
      color: danger ? A.wine : A.ink,
      fontFamily: '"IM Fell English SC", serif',
      fontSize: 12,
      letterSpacing: 2,
      cursor: 'pointer',
    }}>
      <span style={{ color: danger ? A.wine : A.goldDark, fontSize: 14 }}>{icon}</span>
      {label.toUpperCase()}
    </div>
  );
}

// ===== Stats overlay (TAB) =====
function StatsOverlayA() {
  return (
    <ParchmentPanel style={{ width: 460 }} title="Realm Ledger · Day 7">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <LedgerRow label="Citizens" value="12 / 20" />
        <LedgerRow label="Builders" value="3" />
        <LedgerRow label="Soldiers" value="3" />
        <LedgerRow label="Archers" value="0" />
        <LedgerRow label="Knights" value="0" />
        <LedgerRow label="Happiness" value="100%" accent={A.leafDark} />
      </div>
      <div style={{ borderTop: `1px solid ${A.parchmentEdge}`, paddingTop: 10, marginTop: 4 }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 11,
          letterSpacing: 2,
          color: A.goldDark,
          marginBottom: 6,
        }}>INCOME ·  PER MINUTE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <LedgerRow label="Gold" value="+80" accent={A.leafDark} />
          <LedgerRow label="Food" value="+10" accent={A.leafDark} />
          <LedgerRow label="Wood" value="+12" accent={A.leafDark} />
          <LedgerRow label="Stone" value="+6" accent={A.leafDark} />
        </div>
      </div>
    </ParchmentPanel>
  );
}

function LedgerRow({ label, value, accent }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      fontFamily: '"EB Garamond", serif',
      fontSize: 14,
      borderBottom: `1px dotted ${A.parchmentEdge}`,
      paddingBottom: 2,
    }}>
      <span style={{ color: A.inkSoft, fontStyle: 'italic' }}>{label}</span>
      <span style={{ color: accent || A.ink, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ===== Raid Result Modal =====
function RaidModalA({ victory = true }) {
  return (
    <div style={{ width: 480, position: 'relative' }}>
      <ParchmentPanel style={{ padding: 0 }}>
        <div style={{
          padding: '28px 32px 18px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <WaxSeal size={56} color={victory ? A.leaf : A.wine}>
              {victory ? '✚' : '✗'}
            </WaxSeal>
          </div>
          <div style={{
            fontFamily: '"IM Fell English SC", serif',
            fontSize: 32,
            letterSpacing: 4,
            color: victory ? A.leafDark : A.wineDark,
            marginBottom: 4,
          }}>
            {victory ? 'VICTORY' : 'DEFEAT'}
          </div>
          <div style={{
            fontFamily: '"EB Garamond", serif',
            fontSize: 15,
            color: A.inkSoft,
            fontStyle: 'italic',
            marginBottom: 18,
          }}>
            {victory
              ? 'Your walls held strong against the raiders.'
              : 'The gate has fallen. Rebuild what you can.'}
          </div>
          <div style={{
            background: 'rgba(140, 102, 24, 0.08)',
            border: `1px solid ${A.parchmentEdge}`,
            padding: '12px 16px',
            textAlign: 'left',
          }}>
            <ModalLine label="Raiders defeated" value="14 / 14" />
            <ModalLine label="Buildings lost" value="0" accent={A.leafDark} />
            <ModalLine label="Citizens lost" value="0" accent={A.leafDark} />
            <ModalLine label="Spoils" value="+120 Gold" accent={A.gold} />
          </div>
        </div>
        <div style={{
          borderTop: `1px solid ${A.parchmentEdge}`,
          padding: '12px 16px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-block',
            padding: '8px 28px',
            background: `linear-gradient(180deg, ${A.wine}, ${A.wineDark})`,
            color: '#f5e2c0',
            fontFamily: '"IM Fell English SC", serif',
            fontSize: 14,
            letterSpacing: 3,
            cursor: 'pointer',
            border: `1px solid ${A.wineDark}`,
          }}>CONTINUE</div>
        </div>
      </ParchmentPanel>
    </div>
  );
}

function ModalLine({ label, value, accent }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: '"EB Garamond", serif',
      fontSize: 14,
      padding: '3px 0',
    }}>
      <span style={{ color: A.inkSoft }}>{label}</span>
      <span style={{ color: accent || A.ink, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

Object.assign(window, {
  A, ParchmentPanel, ParchmentCorners, WaxSeal, ResChip, Pod,
  HUDBarA, RaidBannerA, BuildMenuA, BuildItemA, DevOverlayA,
  SettingsButtonA, TooltipA, EventBannerA, SettingsDrawerA,
  StatsOverlayA, RaidModalA,
});
