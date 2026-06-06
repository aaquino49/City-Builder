// ============================================================
// Pixel Dominion — Targeted Sprite Fixes (v2)
// Addresses reviewer feedback on 5 sprites:
//   FAIL:    enemy_raider.png, obstacle_iron.png
//   CONCERN: building_ballistatower.png, building_quarry.png, citizen_knight.png
// ============================================================
'use strict';
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const SPRITES_DIR = path.resolve(__dirname, '../assets/sprites');

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

// ── Shared palette ───────────────────────────────────────────────────────────
const T   = [0,0,0,0];
const K   = [26,16,8,255];
const SG  = [138,123,106,255];
const SL  = [168,154,137,255];
const SL2 = [195,183,168,255];
const SD  = [106,94,80,255];
const SDX = [76,66,54,255];
const C   = [139,101,50,255];
const CL  = [200,168,120,255];
const CD  = [100,68,28,255];
const W   = [107,36,56,255];
const WL  = [150,60,80,255];
const WD  = [70,18,36,255];
const FG  = [74,107,42,255];
const FL  = [106,143,58,255];
const G   = [200,168,75,255];
const GL  = [232,204,112,255];
const GD  = [148,118,34,255];
const IR  = [106,122,138,255];
const ID  = [74,90,106,255];
const IDX = [50,60,74,255];
const E   = [212,99,26,255];
const EL  = [246,176,60,255];
const B   = [216,207,184,255];
const BK  = [42,28,14,255];
const SL_ = [178,164,148,255];

// ============================================================
// FIX 1 — enemy_raider.png (FAIL → regenerate)
// Root cause: entire sprite was near-black with no internal detail.
// Fix: mid-brown helmet, bright red-orange eyes (2×2px), prominent
//      fur texture highlights, and a clear iron-grey axe blade.
// ============================================================
{
  const cv = new CV(16,16);

  // ── Color definitions (all noticeably lighter than original) ──
  const HELMB = [58, 40, 18, 255];    // helmet base   — dark brown, NOT black
  const HELMH = [96, 72, 36, 255];    // helmet highlight
  const HELMHI= [130,104, 60, 255];   // helmet top highlight
  const HORN  = [44, 30, 12, 255];    // horn fill (distinct from K outline)
  const FUR_D = [60, 40, 16, 255];    // fur dark base
  const FUR_M = [92, 66, 28, 255];    // fur mid
  const FUR_L = [148,110, 54, 255];   // fur light — these rows must be prominent
  const FUR_H = [192,150, 84, 255];   // fur highlight (brightest texture stripe)
  const AXE_W = [108, 78, 38, 255];   // axe wooden handle
  const AXE_B = [168, 182, 200, 255]; // axe iron blade — clearly blue-grey
  const AXE_G = [224, 236, 248, 255]; // axe metallic glint (bright)
  const EYE   = [224,  60, 14, 255];  // glowing red-orange eye
  const EYEG  = [252, 148, 44, 255];  // eye inner glow

  // ── HORNS (rows 0–2, protruding left col 2 and right col 13) ──
  // Left horn: K outline, HORN fill — angled upward
  cv.s(2,0,K);  cv.s(3,0,K);
  cv.s(2,1,HORN); cv.s(3,1,K);
  cv.s(2,2,HORN); cv.s(3,2,K);
  // Right horn
  cv.s(12,0,K); cv.s(13,0,K);
  cv.s(12,1,K); cv.s(13,1,HORN);
  cv.s(12,2,K); cv.s(13,2,HORN);

  // ── HELMET body (rows 2–6, cols 3–12) ──
  cv.rect(3,2,12,6,HELMB);
  // Top highlight row (light source: top-left)
  cv.hl(2,3,12,HELMH);
  cv.s(3,2,HELMHI); cv.s(4,2,HELMHI); cv.s(5,2,HELMH);
  // Visor band — dark horizontal stripe rows 4–5
  cv.hl(4,4,11,[38,24,10,255]);
  cv.hl(5,4,11,[32,20,8,255]);
  // EYES — 2×2 pixel blocks, unmistakably bright red-orange
  cv.s(5,4,EYEG); cv.s(6,4,EYE);   // left eye
  cv.s(5,5,EYE);  cv.s(6,5,EYEG);
  cv.s(9,4,EYE);  cv.s(10,4,EYEG); // right eye
  cv.s(9,5,EYEG); cv.s(10,5,EYE);
  // Cheek guards
  cv.s(3,5,HELMH); cv.s(12,5,HELMH);
  // Helm lower edge
  cv.hl(6,3,12,HELMB);

  // ── JAW / NECK (row 7, narrow) ──
  cv.rect(6,7,9,7,FUR_D);

  // ── FUR BODY (rows 8–12, cols 3–12) ──
  cv.rect(3,8,12,12,FUR_D);
  // Prominent alternating fur texture stripes — this is what was missing
  cv.hl(8, 4,11,FUR_M);
  cv.hl(9, 4,11,FUR_L);   // ← bright stripe
  cv.hl(10,4,11,FUR_H);   // ← brightest stripe (top-left light)
  cv.hl(11,4,11,FUR_L);
  cv.hl(12,4,11,FUR_M);
  // Individual fur texture pixels (offset pattern)
  cv.s(4, 9,FUR_H); cv.s(6, 9,FUR_L); cv.s(8, 9,FUR_H); cv.s(10,9,FUR_L);
  cv.s(5,10,FUR_L); cv.s(7,10,FUR_H); cv.s(9,10,FUR_L); cv.s(11,10,FUR_H);
  cv.s(4,11,FUR_L); cv.s(6,11,FUR_H); cv.s(8,11,FUR_M); cv.s(10,11,FUR_L);
  // Jagged shoulder bumps (silhouette detail)
  cv.s(3,7,FUR_D); cv.s(2,8,FUR_D); cv.s(2,9,FUR_M); cv.s(3,8,FUR_M);
  cv.s(12,7,FUR_D); cv.s(13,8,FUR_D); cv.s(13,9,FUR_M); cv.s(12,8,FUR_M);

  // ── AXE (cols 13–15, rows 6–13) — clear L-shaped weapon ──
  // Blade (iron grey — clearly distinct from the dark fur body)
  cv.rect(13,6,15,10,AXE_B);
  // Metallic glint on upper-left of blade (light source)
  cv.s(13,6,AXE_G); cv.s(14,6,AXE_G); cv.s(13,7,AXE_G);
  // Blade edge outlines
  cv.vl(13,6,10,K);   // left edge of blade
  cv.hl(6,13,15,K);   // top edge
  cv.hl(10,13,15,K);  // bottom edge
  // Wooden handle below blade
  cv.vl(14,10,13,AXE_W);
  cv.s(14,13,K); // handle tip

  // ── LEGS (rows 13–15, two separate leg columns) ──
  cv.rect(4,13,6,15,FUR_D);
  cv.rect(9,13,11,15,FUR_D);
  cv.vl(4,13,15,FUR_M); cv.vl(9,13,15,FUR_M); // left edge highlight

  // ── Auto-outline ──
  cv.outline();
  cv.save('enemy_raider.png');
}

// ============================================================
// FIX 2 — obstacle_iron.png (FAIL → regenerate)
// Root cause: too similar to obstacle_stone.png — no visible iron.
// Fix: darken stone base, add prominent blue-grey ore veins
//      (IR colour), bright metallic sheen highlights on ore faces.
// ============================================================
{
  const cv = new CV(16,16);

  // Stone is darker than obstacle_stone to differentiate immediately
  const ROCK_D = [68,  52, 36, 255]; // dark stone base (warmer/darker than stone)
  const ROCK_M = [96,  78, 56, 255]; // stone mid
  const ROCK_L = [118, 98, 72, 255]; // stone light face

  const ORE_D  = [74,  90, 106,255]; // iron ore dark   (ID)
  const ORE_M  = [106,122, 138,255]; // iron ore mid    (IR)
  const ORE_L  = [154,172, 190,255]; // iron ore light
  const ORE_G  = [214,228, 242,255]; // metallic glint (bright! clearly metallic)

  // ── Boulder 1 — large, left/centre ──
  cv.rect(0,4,9,13,ROCK_D);
  cv.rect(1,3,8,12,ROCK_M);
  cv.rect(2,3,7,10,ROCK_L);
  // Top-left highlight
  cv.s(2,3,SL); cv.s(3,3,SL); cv.s(2,4,SL);
  // Bottom-right shadow
  cv.s(8,12,SDX); cv.s(8,11,SDX); cv.s(7,12,SDX);

  // Iron ore vein #1 — diagonal streak across boulder 1
  // (should be unmistakable as blue-grey against warm brown rock)
  cv.s(3,5,ORE_M); cv.s(4,6,ORE_M); cv.s(5,7,ORE_D); cv.s(6,8,ORE_M);
  cv.s(4,8,ORE_D); cv.s(3,9,ORE_M); cv.s(5,5,ORE_D);
  // Iron ore vein #2 — shorter secondary streak
  cv.s(6,5,ORE_D); cv.s(7,6,ORE_M); cv.s(6,9,ORE_D);
  // Metallic glints on ore (overwrite a few vein pixels with bright highlight)
  cv.s(3,5,ORE_G);  // ← brightest glint, top of vein, hit by light
  cv.s(5,7,ORE_L);  // mid glint
  cv.s(7,6,ORE_G);  // second glint

  // ── Boulder 2 — smaller, top-right ──
  cv.rect(8,1,14,8,ROCK_D);
  cv.rect(9,1,13,7,ROCK_M);
  cv.s(9,1,ROCK_L); cv.s(10,1,ROCK_L);
  cv.s(13,7,SDX); cv.s(13,6,SDX);
  // Iron ore veins in boulder 2
  cv.s(10,2,ORE_M); cv.s(11,3,ORE_D); cv.s(12,2,ORE_M);
  cv.s(10,4,ORE_D); cv.s(11,5,ORE_M); cv.s(12,4,ORE_D);
  cv.s(9,3,ORE_D);
  // Glints
  cv.s(10,2,ORE_G); cv.s(11,5,ORE_L); cv.s(12,2,ORE_G);

  // ── Boulder 3 — small, bottom-right ──
  cv.rect(10,9,15,14,SDX);
  cv.rect(11,9,14,13,ROCK_D);
  cv.s(11,9,ROCK_M);
  // Iron vein
  cv.s(12,10,ORE_M); cv.s(13,11,ORE_D); cv.s(12,11,ORE_M);
  cv.s(12,10,ORE_G); // glint

  // Scattered ore debris (small flecks near boulders — reinforces "iron" read)
  cv.s(0,14,ROCK_M);
  cv.s(1,15,ORE_M);   // ← ore fleck in debris
  cv.s(7,14,ORE_D);   // ← another ore fleck
  cv.s(15,9,SDX);

  cv.outline();
  cv.save('obstacle_iron.png');
}

// ============================================================
// FIX 3 — building_ballistatower.png (CONCERN → strengthen)
// Root cause: ballista at top was unreadable — looked like guard tower.
// Fix: add prominent HORIZONTAL crossbow arms (2px thick) extending
//      to/past the full tile width — creates unmistakable cross shape.
// ============================================================
{
  const cv = new CV(16,32);

  // ── Wider base (rows 22–31) ──
  cv.rect(0,22,15,31,SG);
  cv.rect(1,23,14,30,SD);
  cv.hl(22,0,15,SL); cv.hl(23,1,14,SL);
  cv.hl(31,0,15,SDX);

  // ── Tower body (rows 8–21) — slightly wider than guard tower ──
  cv.rect(1,8,14,21,SG);
  cv.rect(2,9,13,20,SD);
  for (let y=9; y<21; y+=4) cv.hl(y,2,13,SL);
  cv.vl(2,9,20,SL); cv.vl(3,9,20,SG);

  // ── Battlements (rows 4–7) ──
  cv.rect(1,4,5,7,SL2); cv.rect(6,4,9,5,SDX); cv.rect(10,4,14,7,SL2);
  cv.hl(4,1,14,SL2);

  // ── Ballista platform top (rows 0–3) ──
  cv.rect(1,0,14,3,SDX);
  cv.hl(0,1,14,SD); cv.hl(1,1,14,SG);

  // ── BALLISTA — redesigned for maximum readability ──
  // Central tiller (wooden body of the weapon)
  cv.rect(4,2,11,3,C);
  cv.hl(2,4,11,CL);   // top highlight on tiller

  // ★ KEY FIX: HORIZONTAL CROSSBOW ARMS extending well past tower edges ★
  // Arms are 2 rows thick and run full width (cols 0–15) — unmistakable cross
  cv.rect(0,1,15,2,C);   // full-width arm (overrides everything — paints last)
  cv.hl(1,0,15,CL);       // top highlight on arms
  cv.hl(2,0,15,CD);       // bottom shadow on arms
  // Arm tip details (dark end-caps with iron fittings)
  cv.s(0,1,K); cv.s(0,2,K); // left tip outline
  cv.s(15,1,K); cv.s(15,2,K); // right tip outline
  cv.s(1,1,IDX); cv.s(1,2,IDX); // left iron fitting
  cv.s(14,1,IDX); cv.s(14,2,IDX); // right iron fitting
  // Arm highlight at tips (metallic sheen)
  cv.s(0,1,[210,224,238,255]); cv.s(15,1,[210,224,238,255]);

  // Loaded bolt (iron, horizontal, along tiller centre-line)
  cv.hl(2,5,10,ID);   // bolt shaft
  cv.s(4,2,IDX);       // bolt tip/point
  cv.s(10,2,IDX);      // bolt fletching end

  // Iron fittings at arm/tiller junction
  cv.s(4,1,IDX); cv.s(4,2,IDX);
  cv.s(11,1,IDX); cv.s(11,2,IDX);

  // ── Outline ──
  cv.hl(0,0,15,K); cv.hl(31,0,15,K); cv.vl(0,0,31,K); cv.vl(15,0,31,K);
  cv.save('building_ballistatower.png');
}

// ============================================================
// FIX 4 — building_quarry.png (CONCERN → strengthen)
// Root cause: rings weren't reading at 16×16 — looked flat.
// Fix: dramatically higher contrast between rings, near-black centre,
//      plus a prominent crane arm and cut stone blocks at outer edge.
// ============================================================
{
  const cv = new CV(16,16);

  // ── Concentric rings — high contrast is the ONLY goal here ──
  // Ring 1 (outermost surface): very light stone
  cv.rect(0,0,15,15,B);       // [216,207,184] — nearly bone-white
  // Ring 2
  cv.rect(2,2,13,13,SL);      // [168,154,137]
  // Ring 3
  cv.rect(4,4,11,11,SG);      // [138,123,106]
  // Ring 4
  cv.rect(6,6,9,9,SD);        // [106,94,80]
  // Ring 5 (innermost before pit)
  cv.rect(7,7,8,8,SDX);       // [76,66,54]
  // Centre pit — near-black void (this is the deepest point)
  // Intentionally making it 2×2 to be readable
  cv.s(7,7,[18,12,6,255]); cv.s(8,7,[18,12,6,255]);
  cv.s(7,8,[18,12,6,255]); cv.s(8,8,[18,12,6,255]);

  // ── Top-left highlights on each ring (light source) ──
  cv.s(0,0,SL2); cv.s(1,0,SL2); cv.s(0,1,SL2);
  cv.s(2,2,SL2); cv.s(3,2,B);   cv.s(2,3,SL2);
  cv.s(4,4,SL);  cv.s(5,4,SL);  cv.s(4,5,SL);

  // ── Bottom-right shadow on each ring ──
  cv.s(14,14,SDX); cv.s(15,14,SDX); cv.s(14,15,SDX);
  cv.s(12,12,SD);  cv.s(13,12,SD);  cv.s(12,13,SD);

  // ── Cut stone blocks at outer top edge ──
  cv.rect(3,0,5,1,SL2); cv.s(5,0,SG);   // block 1
  cv.rect(7,0,9,1,SL2); cv.s(9,0,SG);   // block 2
  cv.rect(11,0,13,1,SL2);               // block 3
  cv.s(6,0,SD); cv.s(10,0,SD);          // mortar between blocks

  // ── Crane arm (top-right, prominent L-shape) ──
  // Vertical mast
  cv.vl(14,0,5,C);
  cv.s(14,0,CL); cv.s(15,0,CL); // mast top highlight
  // Horizontal arm extending left from mast
  cv.hl(3,9,14,C);
  cv.hl(4,9,14,CL); // arm top highlight
  cv.s(9,3,CD); cv.s(10,3,CD); // pivot point accent
  // Rope/chain hanging from arm
  cv.s(10,4,SD); cv.s(10,5,SDX); // hanging rope

  // ── Outline ──
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
  cv.save('building_quarry.png');
}

// ============================================================
// FIX 5 — citizen_knight.png (CONCERN → add gold differentiation)
// Root cause: silhouette too close to soldier; gold trim not readable.
// Fix: bright gold (#c8a84b / GL) on shoulder pauldrons, helmet
//      plume, and armour breast band — 3 clear gold anchor points.
// ============================================================
{
  const cv = new CV(16,16);

  // ── Great helm (rows 0–5, cols 3–12) ──
  cv.rect(3,0,12,6,SL2);
  cv.rect(4,1,11,5,SL);
  cv.hl(0,3,12,B);         // helm top highlight
  cv.s(3,0,SL2); cv.s(12,0,SL2);

  // ★ KEY FIX: Gold plume (rows 0–1, wide, prominent) ★
  cv.rect(5,0,10,1,G);     // wide gold plume base
  cv.s(5,0,GL); cv.s(6,0,GL); cv.s(7,0,GL); cv.s(8,0,GL); // bright gold
  cv.s(4,1,GD); cv.s(11,1,GD); // plume root edges

  // Visor (darker band rows 3–4)
  cv.rect(4,3,11,4,ID);
  cv.hl(3,4,11,IDX);

  // ★ KEY FIX: Gold helm brow band ★
  cv.hl(2,3,12,G);          // gold crown band on helm
  cv.s(3,2,GL); cv.s(12,2,GL);

  // ── Armour body (bulkier — cols 1–14) ──
  cv.rect(1,6,14,12,SL);
  cv.rect(2,7,13,11,SG);
  cv.vl(1,6,11,B);          // left edge highlight
  cv.vl(2,7,11,SL);
  cv.vl(14,6,11,SD);        // right shadow

  // ★ KEY FIX: Gold shoulder pauldrons (2–3px blocks on armor shoulders) ★
  // Left pauldron
  cv.rect(1,6,2,9,G);
  cv.s(1,6,GL); cv.s(1,7,GL); cv.s(2,6,GL); // bright gold highlight
  // Right pauldron
  cv.rect(13,6,14,9,G);
  cv.s(14,6,GL); cv.s(14,7,GL); cv.s(13,6,GL);
  // Pauldron lower shadow
  cv.s(1,9,GD); cv.s(2,9,GD); cv.s(13,9,GD); cv.s(14,9,GD);

  // ★ KEY FIX: Gold breast band (horizontal trim across armour) ★
  cv.hl(8,2,13,G);           // chest gold trim band
  cv.s(2,8,GL); cv.s(13,8,GL); // trim edge highlights

  // Shield emblem (wine-red, left area)
  cv.rect(5,7,8,11,W); cv.s(6,8,G); cv.s(7,8,G); cv.s(6,9,G); // emblem

  // Two-handed sword (right side)
  cv.vl(15,3,13,B);
  cv.vl(15,2,13,SL2);
  cv.hl(8,13,15,G);          // crossguard in gold
  cv.s(14,8,GL); cv.s(15,8,GL);
  cv.s(15,9,C); cv.s(15,10,C); // grip

  // ── Legs (plate, wide) ──
  cv.rect(4,12,7,15,SL); cv.rect(8,12,11,15,SL);
  cv.vl(4,12,15,B); cv.vl(11,12,15,SD);
  cv.hl(15,4,7,G); cv.hl(15,8,11,G); // gold boot tips

  cv.outline();
  cv.save('citizen_knight.png');
}

console.log('\n✅  5 sprites regenerated successfully.');
console.log('   enemy_raider    — dark fur with texture highlights + bright red eyes + iron axe');
console.log('   obstacle_iron   — blue-grey ore veins + metallic glints');
console.log('   ballistatower   — full-width horizontal crossbow arms');
console.log('   quarry          — high-contrast concentric rings + crane arm');
console.log('   citizen_knight  — gold pauldrons + plume + breast band');
