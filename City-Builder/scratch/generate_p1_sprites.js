// ============================================================
// Pixel Dominion — Priority 1 Sprites Generator
// Generates:
//   building_granary.png
//   building_tavern.png
//   obstacle_stone.png
//   obstacle_iron.png
// ============================================================
'use strict';
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const SPRITES_DIR = path.resolve(__dirname, '../assets/sprites');
if (!fs.existsSync(SPRITES_DIR)) fs.mkdirSync(SPRITES_DIR, { recursive: true });

// ── PNG Infrastructure ───────────────────────────────────────────────────────
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb  = Buffer.from(type, 'ascii');
  const cb  = Buffer.concat([tb, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cb), 0);
  return Buffer.concat([len, cb, crc]);
}
function saveGrid(grid, filePath) {
  const h = grid.length, w = grid[0].length;
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4); row[0] = 0;
    for (let x = 0; x < w; x++) {
      const c = grid[y][x] || [0,0,0,0];
      row[1+x*4]=c[0]; row[2+x*4]=c[1]; row[3+x*4]=c[2]; row[4+x*4]=(c[3]===undefined?255:c[3]);
    }
    rows.push(row);
  }
  const comp = zlib.deflateSync(Buffer.concat(rows), {level:9});
  const png  = Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',comp), chunk('IEND',Buffer.alloc(0))]);
  fs.writeFileSync(filePath, png);
  console.log('✓  ' + path.basename(filePath));
}

// ── Canvas class ─────────────────────────────────────────────────────────────
class CV {
  constructor(w,h) { this.w=w; this.h=h; this.px=Array.from({length:h},()=>Array(w).fill([0,0,0,0])); }
  s(x,y,c)            { if(x>=0&&x<this.w&&y>=0&&y<this.h) this.px[y][x]=c; return this; }
  rect(x1,y1,x2,y2,c) { for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) this.s(x,y,c); return this; }
  hl(y,x1,x2,c)       { for(let x=x1;x<=x2;x++) this.s(x,y,c); return this; }
  vl(x,y1,y2,c)       { for(let y=y1;y<=y2;y++) this.s(x,y,c); return this; }
  outline() {
    const snap = this.px.map(r => r.slice());
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (snap[y][x][3] > 0) {
        for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx=x+dx, ny=y+dy;
          if (nx>=0&&nx<this.w&&ny>=0&&ny<this.h&&snap[ny][nx][3]===0) this.px[ny][nx]=K;
        }
      }
    }
    return this;
  }
  save(name) { saveGrid(this.px, path.join(SPRITES_DIR, name)); return this; }
}

const K = [26,16,8,255]; // Ink/Outline

// Palette anchors
const T   = [0,0,0,0];
const P   = [240,230,200,255]; // Parchment
const PD  = [210,195,165,255]; // Parchment dark
const PP  = [180,165,130,255]; // Parchment very dark
const G   = [200,168,75,255];   // Aged Gold
const GD  = [148,118,34,255];   // Gold dark
const GL  = [232,204,112,255];  // Gold light
const W   = [107,36,56,255];    // Burgundy
const WL  = [162,74,94,255];    // Burgundy light
const WD  = [68,18,32,255];     // Burgundy dark
const WDL = [202,110,130,255];  // Burgundy very light (pink-ish highlight)
const FG  = [74,107,42,255];    // Forest green
const SG  = [138,123,106,255];  // Stone gray
const SL  = [168,154,137,255];  // Stone light
const SL2 = [195,183,168,255];  // Stone very light
const SD  = [106,94,80,255];    // Stone dark
const SDX = [76,66,54,255];     // Stone very dark
const C   = [139,101,50,255];    // Clay / Wood mid
const CL  = [200,168,120,255];   // Clay light / Wood light
const CD  = [100,68,28,255];     // Clay dark / Wood dark
const CDX = [64,38,12,255];     // Clay very dark
const BK  = [42,28,14,255];      // Dark Wood / Timber
const IR  = [106,122,138,255];   // Iron blue-gray
const IRL = [165,181,197,255];   // Iron light blue-gray
const IRX = [226,240,253,255];   // Metallic highlight (sheen)
const E   = [212,99,26,255];      // Ember orange
const EL  = [246,176,60,255];    // Candlelight yellow

// ── 1. building_granary.png ──────────────────────────────────────────────────
{
  const cv = new CV(16,16);

  // Timber barrel silo roof (rows 1-7, cols 3-12)
  cv.hl(1, 6, 9, CD);
  cv.hl(2, 5, 10, C);
  cv.hl(3, 4, 11, C);
  cv.rect(3, 4, 12, 7, C);
  
  // Roof highlights & wood grain lines
  cv.hl(1, 6, 7, CL);
  cv.hl(2, 5, 7, CL);
  cv.hl(3, 4, 7, CL);
  cv.hl(4, 4, 11, CD);
  cv.hl(5, 3, 7, CL);
  cv.hl(6, 3, 12, CD);
  cv.hl(7, 3, 12, CDX);
  
  // Stone silo walls (rows 8-15, cols 3-12)
  cv.rect(3, 8, 12, 15, SG);
  cv.vl(3, 8, 15, SL);
  cv.vl(4, 8, 15, SL2);
  cv.vl(11, 8, 15, SD);
  cv.vl(12, 8, 15, SDX);
  
  // Mortar / brick detail lines
  cv.hl(10, 3, 12, SD);
  cv.hl(13, 3, 12, SD);
  cv.s(5, 9, SL2);
  cv.s(10, 12, SDX);
  
  // Arched door/shadowed opening (cols 6-9, rows 11-15) - dark storage tunnel
  cv.rect(6, 11, 9, 15, BK);
  cv.s(6, 11, K); cv.s(9, 11, K);
  cv.s(7, 11, BK); cv.s(8, 11, BK);
  cv.vl(7, 12, 15, CDX);
  cv.vl(8, 12, 15, CDX);
  
  // Left: Grain Sack (cols 1-3, rows 12-15)
  cv.rect(1, 13, 3, 15, P);
  cv.s(2, 12, P);
  cv.s(1, 13, PD); cv.s(1, 14, PD); cv.s(1, 15, PD);
  cv.s(2, 12, CD); // sack tie
  // Aged gold grain spilling from sack mouth
  cv.s(2, 11, GL); cv.s(3, 12, G);
  
  // Right: Barrel (cols 12-14, rows 12-15)
  cv.rect(12, 12, 14, 15, C);
  cv.vl(12, 12, 15, CL);
  cv.vl(14, 12, 15, CD);
  cv.hl(13, 12, 14, IR); // iron bands
  cv.hl(15, 12, 14, IR);
  // Gold grain piled on top of the open barrel
  cv.s(13, 11, GL); cv.s(12, 12, G); cv.s(14, 12, GD);

  cv.outline();
  cv.save('building_granary.png');
}

// ── 2. building_tavern.png ───────────────────────────────────────────────────
{
  const cv = new CV(16,16);

  // Pitched Burgundy Shingle Roof (rows 1-7, cols 1-14)
  // Center is cols 7-8
  cv.hl(1, 7, 8, WL);
  cv.hl(2, 6, 9, W);
  cv.hl(3, 5, 10, W);
  cv.hl(4, 4, 11, W);
  cv.hl(5, 3, 12, W);
  cv.hl(6, 2, 13, W);
  cv.hl(7, 1, 14, WD);

  // Roof highlights & shingle patterns (vertical splits)
  cv.s(7, 1, WDL);
  cv.s(6, 2, WL); cv.s(8, 2, WD);
  cv.s(5, 3, WL); cv.s(9, 3, WD);
  cv.s(4, 4, WL); cv.s(10, 4, WD);
  cv.s(3, 5, WL); cv.s(11, 5, WD);
  cv.s(2, 6, WL); cv.s(12, 6, WD);
  cv.s(1, 7, WL); cv.s(13, 7, WD);

  // Grey Stone Chimney (rows 2-4, cols 11-12)
  cv.rect(11, 2, 12, 4, SG);
  cv.s(11, 2, SL); cv.s(12, 2, SD);
  cv.s(12, 3, SD); cv.s(12, 4, SDX);
  // Smoke puff
  cv.s(10, 1, P); cv.s(11, 1, PD);

  // Timber frame wall structure (rows 8-15, cols 2-13)
  cv.rect(2, 8, 13, 15, P);
  
  // Stone foundation base at row 15
  cv.hl(15, 2, 13, SG);
  cv.s(2, 15, SD); cv.s(13, 15, SDX);
  
  // Dark Timber Frames
  cv.vl(2, 8, 15, BK);   // Left corner post
  cv.vl(13, 8, 15, BK);  // Right corner post
  cv.vl(5, 8, 12, BK);   // Internal beam
  cv.vl(8, 8, 12, BK);   // Internal beam
  cv.hl(8, 2, 13, BK);   // Top horizontal plate
  cv.hl(12, 2, 13, BK);  // Mid horizontal floor girder

  // Diagonal support timber braces
  cv.s(3, 9, BK); cv.s(4, 10, BK);
  cv.s(12, 9, BK); cv.s(11, 10, BK);

  // Cozy glowing window (cols 3-4, rows 10-11)
  cv.rect(3, 10, 4, 11, K);
  cv.rect(3, 10, 4, 11, EL); // candlelight yellow window
  cv.s(3, 11, E);            // warm orange flame glow at window bottom

  // Tavern door (cols 9-11, rows 10-15)
  cv.rect(9, 10, 11, 15, CD);
  cv.rect(10, 11, 10, 15, CDX);
  cv.s(9, 10, K); cv.s(11, 10, K);
  cv.s(11, 13, G); // shiny gold brass door ring/handle

  // Small lantern next to door (col 8, row 10)
  cv.s(8, 10, E); cv.s(7, 10, EL);

  // Hanging sign (cols 0-2, rows 7-10) hanging on the left
  cv.hl(7, 0, 2, BK); // hanging iron/wood pole
  cv.s(0, 7, IR); cv.s(1, 7, IR);
  cv.rect(0, 8, 1, 9, CD); // sign board
  cv.s(0, 8, CL); cv.s(1, 9, CDX);
  cv.s(0, 9, G); // Gold mug insignia on sign

  cv.outline();
  cv.save('building_tavern.png');
}

// ── 3. obstacle_stone.png ────────────────────────────────────────────────────
{
  const cv = new CV(16,16);

  // Boulder Cluster (3 distinct granite boulders sitting in grass)
  
  // Boulder 1 (Large main boulder, left-center: cols 0-9, rows 3-13)
  cv.rect(0, 4, 9, 13, SD);     // Base shadow
  cv.rect(1, 3, 8, 12, SG);     // Midtone
  cv.rect(2, 3, 7, 10, SL);     // Light
  cv.s(2, 3, SL2); cv.s(3, 3, SL2); cv.s(2, 4, SL2); // Highlights
  cv.s(8, 12, SDX); cv.s(8, 11, SDX); // bottom-right shadow cracks

  // Boulder 2 (Medium boulder, top-right: cols 8-14, rows 1-8)
  cv.rect(8, 1, 14, 8, SD);
  cv.rect(9, 1, 13, 7, SG);
  cv.s(9, 1, SL); cv.s(10, 1, SL); // highlights
  cv.s(13, 7, SDX); cv.s(13, 6, SDX);

  // Boulder 3 (Small boulder, bottom-right: cols 10-15, rows 9-14)
  cv.rect(10, 9, 15, 14, SDX);
  cv.rect(11, 9, 14, 13, SD);
  cv.s(11, 9, SG); // highlight

  // Ground rock debris (adds realism)
  cv.s(0, 14, SG); cv.s(1, 15, SD);
  cv.s(7, 14, SD); cv.s(15, 9, SDX);

  cv.outline();
  cv.save('obstacle_stone.png');
}

// ── 4. obstacle_iron.png ─────────────────────────────────────────────────────
{
  const cv = new CV(16,16);

  // Dark brown iron-ore rich rock base (jagged & sharp silhouette)
  // Define hematite/brown-rock colors
  const HB  = [82,66,50,255];   // Dark brown base
  const HL  = [122,100,78,255]; // Brown rock highlight
  const HD  = [58,46,34,255];   // Deep shadow
  const HDX = [38,28,20,255];   // Deepest brown-black

  // Boulder 1 (Large left-center: cols 0-9, rows 3-13) - jagged cuts
  cv.rect(0, 4, 9, 13, HD);
  cv.rect(1, 3, 8, 12, HB);
  cv.rect(2, 3, 7, 10, HL);
  
  // Sharp rock cracks/highlights
  cv.s(1, 3, HL); cv.s(2, 3, HL);
  cv.s(8, 12, HDX); cv.s(8, 11, HDX);

  // Boulder 2 (Medium top-right: cols 8-14, rows 1-8)
  cv.rect(8, 1, 14, 8, HD);
  cv.rect(9, 1, 13, 7, HB);
  cv.s(9, 1, HL); cv.s(13, 7, HDX);

  // Boulder 3 (Small bottom-right: cols 10-15, rows 9-14)
  cv.rect(10, 9, 15, 14, HDX);
  cv.rect(11, 9, 14, 13, HD);
  cv.s(11, 9, HB);

  // Sharp debris
  cv.s(0, 14, HB); cv.s(1, 15, HD);
  cv.s(15, 9, HDX);

  // ── Prominent Blue-Gray Iron Ore Streaks/Flecks ──
  // Large Boulder veins
  cv.s(3, 5, IR); cv.s(4, 6, IR); cv.s(3, 7, IR);
  cv.s(4, 5, IRL); cv.s(3, 6, IRL);
  cv.s(4, 8, IR); cv.s(5, 9, IR);
  cv.s(5, 8, IRL);
  
  // Medium Boulder veins
  cv.s(10, 3, IR); cv.s(11, 4, IR);
  cv.s(10, 4, IRL);
  
  // Small Boulder veins
  cv.s(12, 10, IR); cv.s(13, 11, IR);
  cv.s(12, 11, IRL);

  // ── Bright metallic sheen highlights (shining reflections) ──
  cv.s(4, 5, IRX);
  cv.s(3, 6, IRX);
  cv.s(5, 8, IRX);
  cv.s(10, 4, IRX);
  cv.s(12, 11, IRX);

  cv.outline();
  cv.save('obstacle_iron.png');
}

console.log('✅ All Priority 1 sprites (granary, tavern, stone, iron) generated successfully.');
