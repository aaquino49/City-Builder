/* DirectionB.jsx — "Carved Oak & Banners"
   Dark oak panels with iron studs, hanging cloth banners. Compact stacked
   HUD on the left, vertical sprite-tile build menu on the right. More
   game-feeling, higher contrast. */

const B = {
  oak: '#3a2418',
  oakLight: '#5a3a20',
  oakDark: '#1a0e08',
  iron: '#1a1610',
  ironLight: '#3a3530',
  parchment: '#e8d3a8',
  parchmentDark: '#c8b078',
  ink: '#2a1d10',
  inkSoft: '#5a4530',
  banner: '#7a1d1d',
  bannerLight: '#a02828',
  bannerDark: '#4a0808',
  gold: '#d4a838',
  goldDark: '#8c6618',
  cream: '#f4e6c2',
  leaf: '#5a8830',
  leafDark: '#3a5a18',
  shadow: 'rgba(0, 0, 0, 0.5)',
};

// Wood panel with iron studs at corners
function OakPanel({ children, style = {}, padding = 14, studs = true, headerLabel = null }) {
  return (
    <div style={{
      position: 'relative',
      background: `
        repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 4px),
        linear-gradient(180deg, ${B.oakLight} 0%, ${B.oak} 60%, ${B.oakDark} 100%)
      `,
      border: `2px solid ${B.oakDark}`,
      color: B.cream,
      fontFamily: '"EB Garamond", "Cormorant Garamond", Georgia, serif',
      boxShadow: `0 4px 14px ${B.shadow}, inset 0 1px 0 rgba(255, 220, 160, 0.12), inset 0 -1px 0 rgba(0,0,0,0.5)`,
      padding,
      ...style,
    }}>
      {studs && <IronStuds />}
      {headerLabel && <OakHeader label={headerLabel} />}
      {children}
    </div>
  );
}

function IronStuds() {
  const Stud = ({ style }) => (
    <div style={{
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, #6a6a6a, ${B.iron} 75%)`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.6), inset -1px -1px 1px rgba(0,0,0,0.5)',
      border: `1px solid ${B.oakDark}`,
      ...style,
    }} />
  );
  return (
    <>
      <Stud style={{ top: 4, left: 4 }} />
      <Stud style={{ top: 4, right: 4 }} />
      <Stud style={{ bottom: 4, left: 4 }} />
      <Stud style={{ bottom: 4, right: 4 }} />
    </>
  );
}

function OakHeader({ label }) {
  return (
    <div style={{
      margin: '-14px -14px 10px',
      padding: '6px 24px',
      background: `linear-gradient(180deg, ${B.banner} 0%, ${B.bannerDark} 100%)`,
      borderBottom: `2px solid ${B.oakDark}`,
      textAlign: 'center',
      fontFamily: '"Cinzel", "EB Garamond", serif',
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: 4,
      color: B.cream,
      textShadow: `0 1px 0 ${B.bannerDark}`,
    }}>{label.toUpperCase()}</div>
  );
}

// Hanging banner — used for raid timer and section titles
function HangingBanner({ children, color = 'red', width = 200, height = 'auto', style = {} }) {
  const cols = {
    red:  [B.bannerLight, B.banner, B.bannerDark],
    blue: ['#3a5588', '#1d3f6b', '#10254a'],
    green:['#5a8830', B.leafDark, '#1f3a08'],
  };
  const [l, m, d] = cols[color];
  return (
    <div style={{
      position: 'relative',
      width,
      fontFamily: '"Cinzel", serif',
      color: B.cream,
      textAlign: 'center',
      ...style,
    }}>
      {/* hanging cord */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: -10,
        transform: 'translateX(-50%)',
        width: 1,
        height: 10,
        background: B.oakDark,
      }} />
      {/* horizontal bar */}
      <div style={{
        position: 'absolute',
        left: -8,
        top: -4,
        right: -8,
        height: 4,
        background: `linear-gradient(180deg, ${B.gold}, ${B.goldDark})`,
        borderRadius: 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }} />
      {/* banner cloth */}
      <div style={{
        background: `linear-gradient(180deg, ${l} 0%, ${m} 60%, ${d} 100%)`,
        border: `1px solid ${d}`,
        borderTop: 'none',
        padding: '10px 16px 18px',
        clipPath: 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)',
        boxShadow: `0 6px 14px ${B.shadow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}>
        {children}
      </div>
    </div>
  );
}

// Resource line in HUD — flat, dense
function ResLine({ icon, label, value, sub = null, danger = false, accent = null }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '3px 0',
    }}>
      <Icon name={icon} size={18} />
      <div style={{
        flex: 1,
        fontFamily: '"Cinzel", serif',
        fontSize: 10,
        letterSpacing: 1.5,
        color: B.parchmentDark,
        textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontFamily: '"VT323", "Courier New", monospace',
        fontSize: 18,
        color: danger ? B.bannerLight : (accent || B.cream),
        lineHeight: 1,
        letterSpacing: 1,
      }}>{value}{sub && <span style={{ fontSize: 11, color: B.leaf, marginLeft: 4 }}>{sub}</span>}</div>
    </div>
  );
}

// ===== HUD — three stacked banners on left =====
function HUDPanelsB() {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      width: 240,
    }}>
      <OakPanel headerLabel="Treasury" padding={12} style={{ paddingTop: 14 }}>
        <ResLine icon="gold" label="Gold" value="200" sub="+4/3s" />
        <ResLine icon="happiness" label="Joy" value="100%" accent={B.leaf} />
      </OakPanel>

      <OakPanel headerLabel="Hearth" padding={12} style={{ paddingTop: 14 }}>
        <ResLine icon="citizens" label="Folk" value="12/20" />
        <ResLine icon="food" label="Food" value="48/60" sub="+10" />
        <ResLine icon="housing" label="Beds" value="16" />
      </OakPanel>

      <OakPanel headerLabel="Stockpile" padding={12} style={{ paddingTop: 14 }}>
        <ResLine icon="wood" label="Wood" value="100" />
        <ResLine icon="stone" label="Stone" value="50" />
        <ResLine icon="iron" label="Iron" value="0" danger />
      </OakPanel>

      <OakPanel headerLabel="Garrison" padding={12} style={{ paddingTop: 14 }}>
        <ResLine icon="defense" label="Defense" value="22" accent={B.gold} />
        <ResLine icon="sword" label="Soldiers" value="3" />
        <ResLine icon="bow" label="Archers" value="0" />
        <ResLine icon="knight" label="Knights" value="0" />
      </OakPanel>
    </div>
  );
}

// ===== Raid hanging banner (top center) =====
function RaidBannerB({ seconds = 293, warning = false }) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return (
    <div style={{
      position: 'absolute',
      top: 14,
      left: '50%',
      transform: 'translateX(-50%)',
    }}>
      <HangingBanner color={warning ? 'red' : 'red'} width={260}>
        <div style={{ fontSize: 9, letterSpacing: 3, opacity: 0.85, marginBottom: 2 }}>
          {warning ? '◆ RAID INCOMING ◆' : 'NEXT RAID'}
        </div>
        <div style={{
          fontFamily: '"VT323", monospace',
          fontSize: 32,
          letterSpacing: 2,
          lineHeight: 1,
          color: warning ? '#ffe2a8' : B.cream,
          textShadow: '0 2px 0 rgba(0,0,0,0.5)',
        }}>{m}:{s}</div>
        <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.7, marginTop: 4 }}>
          DAY 7 · AUTUMN
        </div>
      </HangingBanner>
    </div>
  );
}

// ===== Build Menu — vertical oak shelf with category rail =====
function BuildMenuB({ selected = 'mine' }) {
  const [cat, setCat] = React.useState('all');
  const cats = [
    { id: 'all', icon: '✦', label: 'All' },
    { id: 'civic', icon: 'housing', label: 'Civic' },
    { id: 'industry', icon: 'wood', label: 'Industry' },
    { id: 'military', icon: 'sword', label: 'Defense' },
  ];
  const items = [
    { key: 'house', name: 'House', cat: 'civic', cost: { gold: 50 }, yields: '+4 Beds' },
    { key: 'farm', name: 'Farm', cat: 'civic', cost: { gold: 80 }, yields: '+10 Food' },
    { key: 'road', name: 'Road', cat: 'civic', cost: { gold: 5 }, yields: '2× Spd' },
    { key: 'lumberyard', name: 'Lumber Yard', cat: 'industry', cost: { gold: 60 } },
    { key: 'quarry', name: 'Quarry', cat: 'industry', cost: { gold: 100, wood: 20 } },
    { key: 'mine', name: 'Mine', cat: 'industry', cost: { gold: 150, wood: 50 } },
    { key: 'wall', name: 'Wall', cat: 'military', cost: { gold: 5 }, yields: '+2 Def' },
    { key: 'gate', name: 'Gate', cat: 'military', cost: { gold: 15, wood: 10 } },
    { key: 'tower', name: 'Tower', cat: 'military', cost: { gold: 150 }, yields: '+10 Def' },
    { key: 'barracks', name: 'Barracks', cat: 'military', cost: { gold: 200 } },
    { key: 'archery', name: 'Archery', cat: 'military', cost: { gold: 80, wood: 30, iron: 10 }, locked: true },
    { key: 'ballista', name: 'Ballista', cat: 'military', cost: { gold: 150, wood: 40, iron: 20 }, locked: true },
  ];
  const visible = cat === 'all' ? items : items.filter(i => i.cat === cat);

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
    }}>
      {/* category rail */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {cats.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{
            width: 44,
            height: 44,
            background: cat === c.id
              ? `linear-gradient(180deg, ${B.bannerLight}, ${B.bannerDark})`
              : `linear-gradient(180deg, ${B.oakLight}, ${B.oak})`,
            border: `2px solid ${B.oakDark}`,
            color: B.cream,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: cat === c.id ? `inset 0 0 0 1px ${B.gold}` : `inset 0 1px 0 rgba(255,220,160,0.1)`,
          }}>
            {c.id === 'all'
              ? <span style={{ color: B.gold, fontSize: 20, fontFamily: 'serif' }}>{c.icon}</span>
              : <Icon name={c.icon} size={22} />}
          </button>
        ))}
      </div>

      {/* main shelf */}
      <OakPanel padding={0} style={{ width: 240 }} studs={false}>
        <div style={{
          padding: '8px 16px',
          background: `linear-gradient(180deg, ${B.banner}, ${B.bannerDark})`,
          borderBottom: `2px solid ${B.oakDark}`,
          textAlign: 'center',
          fontFamily: '"Cinzel", serif',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: 5,
          color: B.cream,
          textShadow: `0 1px 0 ${B.bannerDark}`,
        }}>BUILD</div>
        <div style={{
          padding: 8,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          maxHeight: 540,
          overflow: 'auto',
        }}>
          {visible.map(it => (
            <BuildTileB key={it.key} item={it} selected={selected === it.key} />
          ))}
        </div>
      </OakPanel>
    </div>
  );
}

function BuildTileB({ item, selected }) {
  return (
    <div style={{
      background: selected
        ? `linear-gradient(180deg, rgba(212, 168, 56, 0.18), rgba(140, 102, 24, 0.18))`
        : `linear-gradient(180deg, rgba(232, 211, 168, 0.06), rgba(0,0,0,0.15))`,
      border: selected ? `2px solid ${B.gold}` : `1px solid ${B.oakDark}`,
      padding: 6,
      cursor: item.locked ? 'not-allowed' : 'pointer',
      position: 'relative',
      opacity: item.locked ? 0.45 : 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    }}>
      <div style={{
        width: 48,
        height: 48,
        background: 'rgba(0,0,0,0.35)',
        border: `1px solid ${B.oakDark}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <BuildingSprite name={item.key} size={36} />
      </div>
      <div style={{
        fontFamily: '"Cinzel", serif',
        fontSize: 10,
        letterSpacing: 1,
        color: B.cream,
        textAlign: 'center',
        textTransform: 'uppercase',
      }}>{item.name}</div>
      <div style={{ display: 'flex', gap: 4, fontSize: 11, fontFamily: '"VT323", monospace', color: B.parchmentDark }}>
        {item.cost.gold && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}><Icon name="gold" size={10} />{item.cost.gold}</span>}
        {item.cost.wood && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}><Icon name="wood" size={10} />{item.cost.wood}</span>}
        {item.cost.iron && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}><Icon name="iron" size={10} />{item.cost.iron}</span>}
      </div>
      {item.locked && (
        <div style={{
          position: 'absolute',
          top: 4,
          right: 4,
          fontSize: 12,
          color: B.bannerLight,
        }}>🔒</div>
      )}
    </div>
  );
}

// ===== Dev overlay (very subtle, bottom corner) =====
function DevOverlayB() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 6,
      left: 8,
      fontFamily: '"VT323", monospace',
      fontSize: 11,
      letterSpacing: 1,
      color: 'rgba(232, 211, 168, 0.4)',
      textShadow: '0 1px 2px rgba(0,0,0,0.7)',
    }}>
      120fps · 1.00× · 256,677
    </div>
  );
}

// ===== Settings menu — banner at top right =====
function SettingsBarB() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      display: 'flex',
      gap: 6,
    }}>
      <OakBtn icon="✎" label="SAVE" />
      <OakBtn icon="⌂" label="LOAD" />
      <OakBtn icon="♪" />
      <OakBtn icon="⚙" />
    </div>
  );
}

function OakBtn({ icon, label, danger = false }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: label ? '6px 12px' : 6,
      width: label ? 'auto' : 34,
      height: 34,
      background: `linear-gradient(180deg, ${B.oakLight}, ${B.oak})`,
      border: `2px solid ${B.oakDark}`,
      color: danger ? B.bannerLight : B.cream,
      fontFamily: '"Cinzel", serif',
      fontSize: 11,
      letterSpacing: 2,
      cursor: 'pointer',
      boxShadow: `inset 0 1px 0 rgba(255,220,160,0.12)`,
    }}>
      <span style={{ color: B.gold, fontSize: 14 }}>{icon}</span>
      {label}
    </div>
  );
}

// ===== Tooltip (placement) =====
function TooltipB({ title = 'Mine', desc = 'Yields Iron when worked by a miner.', cost = { gold: 150, wood: 50 }, yields = '+1 Iron / min' }) {
  return (
    <OakPanel padding={0} style={{ minWidth: 240 }} studs={false}>
      <div style={{
        background: `linear-gradient(180deg, ${B.banner}, ${B.bannerDark})`,
        padding: '6px 14px',
        borderBottom: `2px solid ${B.oakDark}`,
        fontFamily: '"Cinzel", serif',
        fontSize: 13,
        letterSpacing: 3,
        textAlign: 'center',
      }}>{title.toUpperCase()}</div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 13, color: B.parchmentDark, fontStyle: 'italic', lineHeight: 1.4, marginBottom: 10 }}>
          {desc}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${B.ironLight}`, paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 10, fontFamily: '"VT323", monospace', fontSize: 14, color: B.cream }}>
            {cost.gold && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="gold" size={13} />{cost.gold}</span>}
            {cost.wood && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="wood" size={13} />{cost.wood}</span>}
            {cost.iron && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="iron" size={13} />{cost.iron}</span>}
          </div>
          <div style={{ fontSize: 11, color: B.leaf, fontStyle: 'italic' }}>{yields}</div>
        </div>
      </div>
    </OakPanel>
  );
}

// ===== Event banner =====
function EventBannerB({ title = 'A Wandering Merchant Arrives', desc = 'Trade 50 Wood for 30 Stone — until next dawn.' }) {
  return (
    <OakPanel padding={0} style={{ minWidth: 400, display: 'flex', alignItems: 'stretch' }} studs={false}>
      <div style={{
        background: `linear-gradient(180deg, ${B.gold}, ${B.goldDark})`,
        width: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRight: `2px solid ${B.oakDark}`,
        fontSize: 28,
        color: B.oakDark,
      }}>✺</div>
      <div style={{ padding: '10px 16px', flex: 1 }}>
        <div style={{
          fontFamily: '"Cinzel", serif',
          fontSize: 13,
          letterSpacing: 2,
          color: B.gold,
          textTransform: 'uppercase',
          lineHeight: 1.2,
        }}>{title}</div>
        <div style={{
          fontSize: 13,
          color: B.parchmentDark,
          fontStyle: 'italic',
          marginTop: 3,
        }}>{desc}</div>
      </div>
      <div style={{
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        borderLeft: `1px solid ${B.ironLight}`,
        fontFamily: '"Cinzel", serif',
        fontSize: 11,
        letterSpacing: 2,
        color: B.cream,
        cursor: 'pointer',
      }}>TRADE →</div>
    </OakPanel>
  );
}

// ===== Settings drawer =====
function SettingsDrawerB() {
  return (
    <OakPanel headerLabel="Settings" padding={14} style={{ paddingTop: 16, width: 280 }}>
      <SettingsRowB label="Master" value={0.8} />
      <SettingsRowB label="Music" value={0.6} />
      <SettingsRowB label="Sound" value={0.9} />
      <div style={{ borderTop: `1px solid ${B.ironLight}`, marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <RowBtn icon="✎" label="Save City" />
        <RowBtn icon="⌂" label="Load City" />
        <RowBtn icon="✕" label="Reset Game" danger />
      </div>
    </OakPanel>
  );
}

function SettingsRowB({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{
        width: 56,
        fontFamily: '"Cinzel", serif',
        fontSize: 10,
        letterSpacing: 1.5,
        color: B.parchmentDark,
        textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ flex: 1, position: 'relative', height: 10, background: B.oakDark, border: `1px solid ${B.iron}` }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${value * 100}%`,
          background: `linear-gradient(180deg, ${B.gold}, ${B.goldDark})`,
        }} />
        <div style={{
          position: 'absolute',
          left: `calc(${value * 100}% - 6px)`,
          top: -3,
          width: 12,
          height: 16,
          background: B.cream,
          border: `1px solid ${B.oakDark}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }} />
      </div>
    </div>
  );
}

function RowBtn({ icon, label, danger = false }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 12px',
      background: danger
        ? `linear-gradient(180deg, ${B.banner}, ${B.bannerDark})`
        : `linear-gradient(180deg, ${B.oakLight}, ${B.oak})`,
      border: `2px solid ${B.oakDark}`,
      color: B.cream,
      fontFamily: '"Cinzel", serif',
      fontSize: 11,
      letterSpacing: 2.5,
      cursor: 'pointer',
      textTransform: 'uppercase',
    }}>
      <span style={{ color: danger ? B.cream : B.gold, fontSize: 14 }}>{icon}</span>
      {label}
    </div>
  );
}

// ===== Stats overlay (TAB) =====
function StatsOverlayB() {
  return (
    <OakPanel headerLabel="Realm Ledger" padding={16} style={{ paddingTop: 18, width: 460 }}>
      <div style={{
        textAlign: 'center',
        fontFamily: '"Cinzel", serif',
        fontSize: 10,
        letterSpacing: 3,
        color: B.gold,
        marginBottom: 10,
      }}>DAY 7 · AUTUMN</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 18px', marginBottom: 12 }}>
        <LedgerB label="Citizens" value="12 / 20" />
        <LedgerB label="Builders" value="3" />
        <LedgerB label="Soldiers" value="3" />
        <LedgerB label="Archers" value="0" />
        <LedgerB label="Knights" value="0" />
        <LedgerB label="Happiness" value="100%" accent={B.leaf} />
      </div>
      <div style={{ borderTop: `1px solid ${B.ironLight}`, paddingTop: 10 }}>
        <div style={{
          fontFamily: '"Cinzel", serif',
          fontSize: 10,
          letterSpacing: 2,
          color: B.gold,
          marginBottom: 6,
        }}>INCOME · PER MINUTE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 18px' }}>
          <LedgerB label="Gold" value="+80" accent={B.leaf} />
          <LedgerB label="Food" value="+10" accent={B.leaf} />
          <LedgerB label="Wood" value="+12" accent={B.leaf} />
          <LedgerB label="Stone" value="+6" accent={B.leaf} />
        </div>
      </div>
    </OakPanel>
  );
}

function LedgerB({ label, value, accent }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: `1px dotted ${B.ironLight}`,
      paddingBottom: 3,
      paddingTop: 2,
    }}>
      <span style={{
        fontFamily: '"Cinzel", serif',
        fontSize: 10,
        letterSpacing: 1.5,
        color: B.parchmentDark,
        textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        fontFamily: '"VT323", monospace',
        fontSize: 16,
        color: accent || B.cream,
      }}>{value}</span>
    </div>
  );
}

// ===== Raid Result Modal =====
function RaidModalB({ victory = true }) {
  return (
    <div style={{ width: 480, position: 'relative' }}>
      <OakPanel padding={0} studs={false}>
        <div style={{
          background: victory
            ? `linear-gradient(180deg, ${B.leaf}, ${B.leafDark})`
            : `linear-gradient(180deg, ${B.banner}, ${B.bannerDark})`,
          padding: '20px 24px',
          textAlign: 'center',
          borderBottom: `2px solid ${B.oakDark}`,
        }}>
          <div style={{
            fontFamily: '"Cinzel", serif',
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: 6,
            color: B.cream,
            textShadow: `0 2px 0 rgba(0,0,0,0.5)`,
            lineHeight: 1,
          }}>
            {victory ? 'VICTORY' : 'DEFEAT'}
          </div>
          <div style={{
            fontFamily: '"EB Garamond", serif',
            fontSize: 13,
            color: B.cream,
            fontStyle: 'italic',
            marginTop: 6,
            opacity: 0.85,
          }}>
            {victory
              ? 'Your walls held strong against the raiders.'
              : 'The gate has fallen. Rebuild what you can.'}
          </div>
        </div>
        <div style={{ padding: '18px 24px' }}>
          <ModalLineB label="Raiders defeated" value="14 / 14" />
          <ModalLineB label="Buildings lost" value="0" accent={B.leaf} />
          <ModalLineB label="Citizens lost" value="0" accent={B.leaf} />
          <ModalLineB label="Spoils" value="+120 Gold" accent={B.gold} />
        </div>
        <div style={{
          borderTop: `2px solid ${B.oakDark}`,
          background: `linear-gradient(180deg, ${B.oakDark}, #000)`,
          padding: 12,
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-block',
            padding: '8px 32px',
            background: `linear-gradient(180deg, ${B.gold}, ${B.goldDark})`,
            color: B.oakDark,
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 4,
            cursor: 'pointer',
            border: `1px solid ${B.oakDark}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>CONTINUE</div>
        </div>
      </OakPanel>
    </div>
  );
}

function ModalLineB({ label, value, accent }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '5px 0',
      borderBottom: `1px dotted ${B.ironLight}`,
    }}>
      <span style={{
        fontFamily: '"Cinzel", serif',
        fontSize: 11,
        letterSpacing: 1.5,
        color: B.parchmentDark,
        textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        fontFamily: '"VT323", monospace',
        fontSize: 17,
        color: accent || B.cream,
      }}>{value}</span>
    </div>
  );
}

Object.assign(window, {
  B, OakPanel, IronStuds, OakHeader, HangingBanner, ResLine,
  HUDPanelsB, RaidBannerB, BuildMenuB, BuildTileB, DevOverlayB,
  SettingsBarB, TooltipB, EventBannerB, SettingsDrawerB,
  StatsOverlayB, RaidModalB,
});
