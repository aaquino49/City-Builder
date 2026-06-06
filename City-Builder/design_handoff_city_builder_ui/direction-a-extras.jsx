/* DirectionA-Extras.jsx — additional surfaces for Direction A (polished)
   - Day & Season indicator (replaces top-corner stat dump)
   - Main menu / title screen
   - Save & load city
   - Building inspector (click placed building)
   - Trade modal (wandering merchant)
   Uses palette / typography from direction-a.jsx (window.A). */

// ===== Day / Season indicator (top-left corner — replaces FPS dump) =====
function DaySeasonA({ day = 7, season = 'Autumn', timeOfDay = 'Afternoon' }) {
  // Pixel sun motif — small, intentional
  const seasonGlyph = {
    Spring: { color: '#4a6b2a', symbol: '✿' },
    Summer: { color: '#d4a838', symbol: '☀' },
    Autumn: { color: '#a8521c', symbol: '✦' },
    Winter: { color: '#7a9ab0', symbol: '❄' },
  }[season] || { color: A.gold, symbol: '✦' };

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      display: 'flex',
      alignItems: 'stretch',
    }}>
      <ParchmentPanel padding={0} style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          padding: '8px 14px',
          borderRight: `1px solid ${A.parchmentEdge}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 56,
        }}>
          <div style={{
            fontFamily: '"IM Fell English SC", serif',
            fontSize: 9,
            letterSpacing: 2,
            color: A.inkFaint,
            lineHeight: 1,
          }}>DAY</div>
          <div style={{
            fontFamily: '"IM Fell English SC", serif',
            fontSize: 26,
            lineHeight: 1.1,
            color: A.wineDark,
            marginTop: 2,
          }}>{day}</div>
        </div>
        <div style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            fontFamily: 'serif',
            fontSize: 22,
            color: seasonGlyph.color,
            lineHeight: 1,
          }}>{seasonGlyph.symbol}</div>
          <div>
            <div style={{
              fontFamily: '"IM Fell English SC", serif',
              fontSize: 9,
              letterSpacing: 2,
              color: A.inkFaint,
              lineHeight: 1,
            }}>SEASON</div>
            <div style={{
              fontFamily: '"IM Fell English SC", serif',
              fontSize: 14,
              letterSpacing: 1,
              color: A.ink,
              marginTop: 2,
            }}>{season}</div>
          </div>
        </div>
      </ParchmentPanel>
    </div>
  );
}

// ===== Main Menu / Title Screen =====
function MainMenuA({ width = 1400, height = 800 }) {
  return (
    <div style={{
      position: 'relative',
      width,
      height,
      overflow: 'hidden',
      background: '#1d1814',
    }}>
      {/* Dim, vignetted game world behind */}
      <PixelWorld width={width} height={height} seed={11} density={0.22} palette="meadow" dimEdges />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(40,25,10,0.4), rgba(0,0,0,0.75))',
      }} />

      {/* Title block */}
      <div style={{
        position: 'absolute',
        top: '14%',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 14,
          letterSpacing: 8,
          color: A.gold,
          marginBottom: 8,
          opacity: 0.85,
        }}>OF KEEP &amp; KINGDOM</div>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 80,
          letterSpacing: 8,
          color: A.parchment,
          textShadow: `0 4px 0 ${A.wineDark}, 0 6px 24px rgba(0,0,0,0.7)`,
          lineHeight: 1,
        }}>HEARTHWOOD</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          justifyContent: 'center',
          marginTop: 16,
        }}>
          <Filigree />
          <div style={{
            fontFamily: '"EB Garamond", serif',
            fontStyle: 'italic',
            fontSize: 17,
            color: A.parchmentDark,
            letterSpacing: 1,
          }}>A cozy realm-builder</div>
          <Filigree mirror />
        </div>
      </div>

      {/* Menu scroll */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 360,
      }}>
        <ParchmentPanel padding={0}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <MenuItem label="New Realm" icon="✦" primary />
            <MenuItem label="Continue" subtitle="Hearthwood · Day 7" icon="⌂" />
            <MenuItem label="Load Realm" icon="✎" />
            <MenuItem label="Settings" icon="⚙" />
            <MenuItem label="Credits" icon="❦" />
          </div>
        </ParchmentPanel>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: 14,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: '"EB Garamond", serif',
        fontSize: 12,
        color: 'rgba(232, 211, 168, 0.5)',
        letterSpacing: 2,
      }}>v 0.7.2 · ◆ ◆ ◆</div>
    </div>
  );
}

function Filigree({ mirror = false }) {
  return (
    <svg width="64" height="10" viewBox="0 0 64 10" style={{ opacity: 0.7, transform: mirror ? 'scaleX(-1)' : undefined }}>
      <path d="M 2 5 L 26 5 M 26 5 Q 30 2 34 5 Q 38 8 42 5 L 62 5" stroke={A.gold} strokeWidth="1" fill="none" />
      <circle cx="34" cy="5" r="1.5" fill={A.wine} />
      <circle cx="2" cy="5" r="1.5" fill={A.gold} />
      <circle cx="62" cy="5" r="1.5" fill={A.gold} />
    </svg>
  );
}

function MenuItem({ label, subtitle, icon, primary = false }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 22px',
      borderBottom: `1px solid ${A.parchmentEdge}`,
      background: primary ? 'rgba(140, 44, 28, 0.08)' : 'transparent',
      cursor: 'pointer',
    }}>
      <span style={{
        color: primary ? A.wine : A.goldDark,
        fontSize: 20,
        fontFamily: 'serif',
        width: 24,
        textAlign: 'center',
      }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 18,
          letterSpacing: 3,
          color: primary ? A.wineDark : A.ink,
        }}>{label.toUpperCase()}</div>
        {subtitle && (
          <div style={{
            fontFamily: '"EB Garamond", serif',
            fontSize: 12,
            color: A.inkFaint,
            fontStyle: 'italic',
            marginTop: 1,
          }}>{subtitle}</div>
        )}
      </div>
      {primary && (
        <span style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 16,
          color: A.wine,
        }}>›</span>
      )}
    </div>
  );
}

// ===== Save / Load City =====
function SaveLoadA({ mode = 'load' }) {
  const slots = [
    { id: 1, name: 'Hearthwood', day: 7, season: 'Autumn', citizens: 12, gold: 200, time: '2m ago', active: true },
    { id: 2, name: 'Brookmere', day: 14, season: 'Winter', citizens: 24, gold: 480, time: 'yesterday' },
    { id: 3, name: 'Ashvale', day: 3, season: 'Spring', citizens: 6, gold: 90, time: '3d ago' },
    { id: 4, empty: true },
    { id: 5, empty: true },
  ];

  return (
    <ParchmentPanel padding={0} style={{ width: 520 }}>
      <div style={{
        padding: '14px 22px',
        borderBottom: `1px solid ${A.parchmentEdge}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 20,
          letterSpacing: 4,
          color: A.wineDark,
        }}>{mode === 'load' ? 'LOAD REALM' : 'SAVE REALM'}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <ModeTab active={mode === 'load'}>Load</ModeTab>
          <ModeTab active={mode === 'save'}>Save</ModeTab>
        </div>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slots.map(s => <SaveSlot key={s.id} slot={s} />)}
      </div>
      <div style={{
        padding: '12px 18px',
        borderTop: `1px solid ${A.parchmentEdge}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(140, 102, 24, 0.05)',
      }}>
        <span style={{
          fontFamily: '"EB Garamond", serif',
          fontStyle: 'italic',
          fontSize: 13,
          color: A.inkFaint,
        }}>Autosave every 60s</span>
        <ScrollButton label={mode === 'load' ? 'Load Selected' : 'Save Here'} icon="✎" />
      </div>
    </ParchmentPanel>
  );
}

function ModeTab({ active, children }) {
  return (
    <div style={{
      padding: '4px 12px',
      fontFamily: '"IM Fell English SC", serif',
      fontSize: 11,
      letterSpacing: 2,
      color: active ? A.wineDark : A.inkFaint,
      background: active ? A.parchment : 'transparent',
      borderBottom: active ? `2px solid ${A.wine}` : '2px solid transparent',
      cursor: 'pointer',
    }}>{String(children).toUpperCase()}</div>
  );
}

function SaveSlot({ slot }) {
  if (slot.empty) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        border: `1px dashed ${A.parchmentEdge}`,
        background: 'rgba(140, 102, 24, 0.04)',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: `1px dashed ${A.parchmentEdge}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: A.inkFaint,
          fontSize: 22,
        }}>+</div>
        <div style={{
          fontFamily: '"EB Garamond", serif',
          fontStyle: 'italic',
          fontSize: 14,
          color: A.inkFaint,
        }}>Empty Slot · Begin a new realm</div>
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      background: slot.active ? 'rgba(140, 44, 28, 0.10)' : 'rgba(140, 102, 24, 0.06)',
      border: slot.active ? `1px solid ${A.wine}` : `1px solid ${A.parchmentEdge}`,
      cursor: 'pointer',
    }}>
      {/* mini map / thumbnail */}
      <SlotThumb seed={slot.id} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 16,
          letterSpacing: 1.5,
          color: A.ink,
        }}>{slot.name.toUpperCase()}</div>
        <div style={{
          fontFamily: '"EB Garamond", serif',
          fontSize: 12,
          color: A.inkFaint,
          fontStyle: 'italic',
          marginTop: 2,
        }}>Day {slot.day} · {slot.season} · saved {slot.time}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12, color: A.inkSoft }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Icon name="citizens" size={11} />{slot.citizens}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Icon name="gold" size={11} />{slot.gold}
          </span>
        </div>
      </div>
      {slot.active && (
        <WaxSeal size={26} color={A.wine}>✓</WaxSeal>
      )}
    </div>
  );
}

function SlotThumb({ seed = 1 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d');
    let s = seed * 73;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    // tiny world — meadow palette
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        ctx.fillStyle = r() < 0.5 ? '#5e8a3e' : '#658f44';
        ctx.fillRect(x * 4, y * 4, 4, 4);
      }
    }
    // sprinkle buildings
    const blds = ['#8c2c1c', '#d8b67a', '#7a7a7a'];
    for (let i = 0; i < 4 + Math.floor(r() * 3); i++) {
      ctx.fillStyle = blds[Math.floor(r() * blds.length)];
      ctx.fillRect(Math.floor(r() * 11) * 4, Math.floor(r() * 11) * 4, 4, 4);
    }
  }, [seed]);
  return (
    <canvas ref={ref} style={{
      width: 48,
      height: 48,
      imageRendering: 'pixelated',
      border: `1px solid ${A.parchmentEdge}`,
      flexShrink: 0,
    }} />
  );
}

// ===== Building Inspector (popup over a placed building) =====
function BuildingInspectorA({ building = 'farm' }) {
  // Sample data per type
  const data = {
    farm: { name: 'Farm', sub: 'Tilled by Mira & Joran', desc: 'A modest plot of barley and turnips.', hp: 76, hpMax: 80, workers: 2, maxWorkers: 3, yields: '+10 Food / min', upgradeText: 'Upgrade · Mill (200g, 30w)' },
    barracks: { name: 'Barracks', sub: 'Hall of arms', desc: 'Trains soldiers from idle citizens.', hp: 142, hpMax: 150, workers: 0, maxWorkers: 0, yields: '+1 Soldier / 40s', upgradeText: 'Upgrade · Garrison (400g, 100w)' },
  }[building] || {};
  return (
    <ParchmentPanel padding={0} style={{ width: 320 }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: `1px solid ${A.parchmentEdge}`,
      }}>
        <div style={{
          width: 48,
          height: 48,
          background: 'rgba(90, 63, 37, 0.16)',
          border: `1px solid ${A.parchmentEdge}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <BuildingSprite name={building} size={36} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: '"IM Fell English SC", serif',
            fontSize: 18,
            letterSpacing: 2,
            color: A.wineDark,
            lineHeight: 1.1,
          }}>{data.name.toUpperCase()}</div>
          <div style={{
            fontFamily: '"EB Garamond", serif',
            fontStyle: 'italic',
            fontSize: 12,
            color: A.inkFaint,
            marginTop: 2,
          }}>{data.sub}</div>
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <div style={{
          fontFamily: '"EB Garamond", serif',
          fontStyle: 'italic',
          fontSize: 13,
          color: A.inkSoft,
          lineHeight: 1.4,
          marginBottom: 12,
        }}>{data.desc}</div>

        {/* HP bar */}
        <InspectorRow label="Health">
          <Bar value={data.hp / data.hpMax} color={A.leaf} label={`${data.hp} / ${data.hpMax}`} />
        </InspectorRow>

        {/* Workers */}
        {data.maxWorkers > 0 && (
          <InspectorRow label="Workers">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: data.maxWorkers }).map((_, i) => (
                  <div key={i} style={{
                    width: 16,
                    height: 16,
                    background: i < data.workers ? `radial-gradient(circle at 30% 30%, ${A.leaf}, ${A.leafDark})` : 'rgba(40, 25, 10, 0.1)',
                    border: `1px solid ${i < data.workers ? A.leafDark : A.parchmentEdge}`,
                    borderRadius: 1,
                  }} />
                ))}
              </div>
              <span style={{ fontFamily: '"VT323", monospace', fontSize: 16, color: A.inkSoft }}>
                {data.workers} / {data.maxWorkers}
              </span>
            </div>
          </InspectorRow>
        )}

        {/* Yields */}
        <InspectorRow label="Yields">
          <span style={{
            fontFamily: '"EB Garamond", serif',
            fontSize: 14,
            color: A.leafDark,
            fontStyle: 'italic',
          }}>{data.yields}</span>
        </InspectorRow>

        <div style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: `1px solid ${A.parchmentEdge}`,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          <ActionPip label="Assign Worker" icon="✚" />
          <ActionPip label="Upgrade" icon="↑" highlight />
          <ActionPip label="Demolish" icon="✕" danger />
        </div>
        <div style={{
          marginTop: 8,
          fontFamily: '"EB Garamond", serif',
          fontStyle: 'italic',
          fontSize: 11,
          color: A.inkFaint,
          textAlign: 'center',
        }}>{data.upgradeText}</div>
      </div>
    </ParchmentPanel>
  );
}

function InspectorRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <div style={{
        width: 64,
        fontFamily: '"IM Fell English SC", serif',
        fontSize: 10,
        letterSpacing: 1.5,
        color: A.inkFaint,
      }}>{label.toUpperCase()}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Bar({ value, color = A.leaf, label }) {
  return (
    <div style={{ position: 'relative', height: 12, background: 'rgba(40, 25, 10, 0.15)', border: `1px solid ${A.parchmentEdge}` }}>
      <div style={{
        position: 'absolute',
        inset: 1,
        width: `calc(${Math.max(0, Math.min(1, value)) * 100}% - 2px)`,
        background: `linear-gradient(180deg, ${color}, ${A.leafDark})`,
      }} />
      {label && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"VT323", monospace',
          fontSize: 11,
          color: A.parchment,
          textShadow: '0 1px 1px rgba(0,0,0,0.5)',
          letterSpacing: 0.5,
        }}>{label}</div>
      )}
    </div>
  );
}

function ActionPip({ label, icon, danger = false, highlight = false }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      background: highlight
        ? `linear-gradient(180deg, ${A.gold}, ${A.goldDark})`
        : `linear-gradient(180deg, ${A.parchment}, ${A.parchmentDark})`,
      border: `1px solid ${danger ? A.wine : (highlight ? A.goldDark : A.parchmentEdge)}`,
      color: danger ? A.wine : (highlight ? '#2a1d10' : A.ink),
      fontFamily: '"IM Fell English SC", serif',
      fontSize: 11,
      letterSpacing: 1.5,
      cursor: 'pointer',
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      {label.toUpperCase()}
    </div>
  );
}

// ===== Trade Modal (Wandering Merchant) =====
function TradeModalA() {
  const deals = [
    { give: { wood: 50 }, get: { stone: 30 }, label: 'Builder\'s Bargain' },
    { give: { gold: 80 }, get: { iron: 15 }, label: 'Smith\'s Stock', recommended: true },
    { give: { stone: 40 }, get: { gold: 100 }, label: 'Quarryman\'s Coin' },
    { give: { food: 30, gold: 20 }, get: { iron: 10 }, label: 'Pantry Swap' },
  ];

  return (
    <ParchmentPanel padding={0} style={{ width: 560 }}>
      {/* Header */}
      <div style={{
        padding: '16px 22px 12px',
        borderBottom: `1px solid ${A.parchmentEdge}`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <WaxSeal size={44} color={A.wine}>※</WaxSeal>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: '"IM Fell English SC", serif',
            fontSize: 22,
            letterSpacing: 3,
            color: A.wineDark,
            lineHeight: 1.1,
          }}>THE WANDERING MERCHANT</div>
          <div style={{
            fontFamily: '"EB Garamond", serif',
            fontStyle: 'italic',
            fontSize: 13,
            color: A.inkFaint,
            marginTop: 2,
          }}>"Lay your coin and I'll lay my wares, friend."</div>
        </div>
        <div style={{
          fontFamily: '"VT323", monospace',
          fontSize: 14,
          color: A.wine,
          textAlign: 'right',
        }}>
          DEPARTS<br />
          <span style={{ fontSize: 22, lineHeight: 1, color: A.wineDark }}>02:43</span>
        </div>
      </div>

      {/* Deals */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deals.map((d, i) => <TradeRow key={i} deal={d} />)}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 22px',
        borderTop: `1px solid ${A.parchmentEdge}`,
        background: 'rgba(140, 102, 24, 0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: '"EB Garamond", serif',
          fontStyle: 'italic',
          fontSize: 12,
          color: A.inkFaint,
        }}>Choose at most three before he departs.</span>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 12,
          letterSpacing: 2,
          color: A.inkSoft,
          cursor: 'pointer',
        }}>FAREWELL ›</div>
      </div>
    </ParchmentPanel>
  );
}

function TradeRow({ deal }) {
  const renderCost = (c) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {Object.entries(c).map(([k, v]) => (
        <div key={k} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '3px 8px',
          background: 'rgba(40, 25, 10, 0.06)',
          border: `1px solid ${A.parchmentEdge}`,
          fontFamily: '"VT323", monospace',
          fontSize: 16,
          color: A.ink,
        }}>
          <Icon name={k === 'gold' ? 'gold' : k} size={13} />
          {v}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: 12,
      background: deal.recommended ? 'rgba(140, 44, 28, 0.06)' : 'rgba(140, 102, 24, 0.04)',
      border: `1px solid ${deal.recommended ? A.wine : A.parchmentEdge}`,
      gap: 14,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: '"IM Fell English SC", serif',
          fontSize: 14,
          letterSpacing: 1.5,
          color: A.wineDark,
          marginBottom: 6,
        }}>{deal.label.toUpperCase()}{deal.recommended && <span style={{ marginLeft: 6, fontSize: 10, color: A.goldDark }}>★ FAVORED</span>}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: A.inkFaint, marginBottom: 3, fontFamily: '"IM Fell English SC", serif' }}>YOU GIVE</div>
            {renderCost(deal.give)}
          </div>
          <div style={{ color: A.goldDark, fontSize: 20, fontFamily: 'serif' }}>›</div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: A.inkFaint, marginBottom: 3, fontFamily: '"IM Fell English SC", serif' }}>YOU GAIN</div>
            {renderCost(deal.get)}
          </div>
        </div>
      </div>
      <div style={{
        padding: '8px 16px',
        background: deal.recommended
          ? `linear-gradient(180deg, ${A.wine}, ${A.wineDark})`
          : `linear-gradient(180deg, ${A.parchment}, ${A.parchmentDark})`,
        color: deal.recommended ? '#f5e2c0' : A.ink,
        border: `1px solid ${deal.recommended ? A.wineDark : A.parchmentEdge}`,
        fontFamily: '"IM Fell English SC", serif',
        fontSize: 12,
        letterSpacing: 2,
        cursor: 'pointer',
      }}>ACCEPT</div>
    </div>
  );
}

Object.assign(window, {
  DaySeasonA, MainMenuA, Filigree, MenuItem,
  SaveLoadA, ModeTab, SaveSlot, SlotThumb,
  BuildingInspectorA, InspectorRow, Bar, ActionPip,
  TradeModalA, TradeRow,
});
