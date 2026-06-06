// ============================================================
// Pixel Dominion — Complete Sprite Generator
// Generates all 31 assets and updates ART_ASSETS.md
// ============================================================
'use strict';
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Paths ────────────────────────────────────────────────────────────────────
const SPRITES_DIR = path.resolve(__dirname, '../assets/sprites');
const ART_ASSETS  = path.resolve(__dirname, '../ART_ASSETS.md');
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
  console.log('✓ ' + path.basename(filePath));
}
function saveFn(w, h, fn, name) {
  const grid = [];
  for (let y = 0; y < h; y++) { grid[y]=[]; for (let x = 0; x < w; x++) grid[y][x]=fn(x,y); }
  saveGrid(grid, path.join(SPRITES_DIR, name));
}

// ── Canvas class ─────────────────────────────────────────────────────────────
class CV {
  constructor(w,h) { this.w=w; this.h=h; this.px=Array.from({length:h},()=>Array(w).fill([0,0,0,0])); }
  s(x,y,c)         { if(x>=0&&x<this.w&&y>=0&&y<this.h) this.px[y][x]=c; return this; }
  g(x,y)           { return (x>=0&&x<this.w&&y>=0&&y<this.h)?this.px[y][x]:[0,0,0,0]; }
  rect(x1,y1,x2,y2,c) { for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) this.s(x,y,c); return this; }
  hl(y,x1,x2,c)    { for(let x=x1;x<=x2;x++) this.s(x,y,c); return this; }
  vl(x,y1,y2,c)    { for(let y=y1;y<=y2;y++) this.s(x,y,c); return this; }
  outline() {
    const snap=this.px.map(r=>r.slice());
    for(let y=0;y<this.h;y++) for(let x=0;x<this.w;x++) {
      if(snap[y][x][3]>0) {
        for(const[dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx=x+dx,ny=y+dy;
          if(nx>=0&&nx<this.w&&ny>=0&&ny<this.h&&snap[ny][nx][3]===0) this.px[ny][nx]=K;
        }
      }
    }
    return this;
  }
  save(name) { saveGrid(this.px, path.join(SPRITES_DIR, name)); return this; }
}

// ── Palette ──────────────────────────────────────────────────────────────────
const T   = [0,0,0,0];
const K   = [26,16,8,255];     // Ink / outline
const P   = [240,230,200,255]; // Parchment
const PD  = [210,195,165,255]; // Parchment dark
const PP  = [180,165,130,255]; // Parchment very dark
const SK  = [200,152,106,255]; // Skin
const SKD = [162,114,70,255];  // Skin dark
const H   = [101,67,33,255];   // Hair
const HL  = [148,108,68,255];  // Hair light
const SG  = [138,123,106,255]; // Stone gray
const SL  = [168,154,137,255]; // Stone light
const SL2 = [195,183,168,255]; // Stone very light
const SD  = [106,94,80,255];   // Stone dark
const SDX = [76,66,54,255];    // Stone very dark
const C   = [139,101,50,255];  // Clay
const CL  = [200,168,120,255]; // Clay light
const CD  = [100,68,28,255];   // Clay dark
const CDX = [64,38,12,255];    // Clay very dark
const W   = [107,36,56,255];   // Wine
const WL  = [150,60,80,255];   // Wine light
const WD  = [70,18,36,255];    // Wine dark
const FG  = [74,107,42,255];   // Forest green
const FL  = [106,143,58,255];  // Forest light
const FD  = [48,74,22,255];    // Forest dark
const G   = [200,168,75,255];  // Gold
const GL  = [232,204,112,255]; // Gold light
const GD  = [148,118,34,255];  // Gold dark
const IR  = [106,122,138,255]; // Iron blue-gray
const ID  = [74,90,106,255];   // Iron dark
const IDX = [50,60,74,255];    // Iron very dark
const E   = [212,99,26,255];   // Ember orange
const EL  = [246,176,60,255];  // Ember light / yellow
const ED  = [148,46,8,255];    // Ember dark
const B   = [216,207,184,255]; // Bone / sky
const BK  = [42,28,14,255];    // Dark wood
const RD  = [180,40,40,255];   // Red (enemy)
const TE  = [52,130,112,255];  // Teal (archer accent)
const TEL = [82,168,148,255];  // Teal light
const TED = [30,88,70,255];    // Teal dark
const MO  = [38,30,22,255];    // Mortar (road gaps)
const PU  = [108,90,140,255];  // Purple (academy)
const PUL = [140,122,176,255]; // Purple light
const PUD = [78,60,110,255];   // Purple dark
const SL_ = [178,164,148,255]; // extra stone light

// ── Pixel font (6×8) for UI Logo ─────────────────────────────────────────────
// Each entry: 8 rows of 6-bit bitmasks (bit5=leftmost col)
const FONT = {
  'P': [0b111110,0b100010,0b100010,0b111110,0b100000,0b100000,0b100000,0b000000],
  'I': [0b011100,0b001000,0b001000,0b001000,0b001000,0b001000,0b011100,0b000000],
  'X': [0b100010,0b010100,0b001000,0b001000,0b010100,0b100010,0b000000,0b000000],
  'E': [0b111110,0b100000,0b100000,0b111100,0b100000,0b100000,0b111110,0b000000],
  'L': [0b100000,0b100000,0b100000,0b100000,0b100000,0b100000,0b111110,0b000000],
  'D': [0b111100,0b100010,0b100001,0b100001,0b100010,0b100100,0b111100,0b000000],
  'O': [0b011100,0b100010,0b100001,0b100001,0b100001,0b100010,0b011100,0b000000],
  'M': [0b100001,0b110011,0b101101,0b100001,0b100001,0b100001,0b100001,0b000000],
  'N': [0b100001,0b110001,0b101001,0b100101,0b100011,0b100001,0b100001,0b000000],
  ' ': [0,0,0,0,0,0,0,0],
};
function drawChar(cv, ch, sx, sy, color, scale) {
  const rows = FONT[ch] || FONT[' '];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 6; c++) {
      if (rows[r] & (0b100000 >> c)) {
        cv.rect(sx+c*scale, sy+r*scale, sx+c*scale+scale-1, sy+r*scale+scale-1, color);
      }
    }
  }
}
function drawString(cv, str, sx, sy, color, scale) {
  let x = sx;
  for (const ch of str) { drawChar(cv, ch, x, sy, color, scale); x += (6+1)*scale; }
}

// ============================================================
// PASS 1 — TERRAIN TILES
// ============================================================

// 1. tile_grass.png — 16×16, organic 4-tone green, seamless
saveFn(16,16,(x,y)=>{
  const G1=[48,72,24,255], G2=[68,100,36,255], G3=[92,130,52,255], G4=[116,158,68,255];
  // Cluster-based: 3×3 block offset then sub-pixel hash
  const cx=Math.floor(x/3), cy=Math.floor(y/3);
  const cluster=(cx*13+cy*17+cx*cy*5)%4;
  const sub=(x*5+y*7+x+y)%10;
  if(cluster===0) return sub<3?G1:sub<7?G2:G3;
  if(cluster===1) return sub<4?G2:sub<8?G3:G4;
  if(cluster===2) return sub<2?G1:sub<6?G2:sub<9?G3:G2;
  return sub<5?G2:sub<8?G3:G2;
},'tile_grass.png');

// 2. tile_dirt.png — clay-brown with pebble flecks, seamless
saveFn(16,16,(x,y)=>{
  const D1=[90,58,20,255], D2=[130,92,44,255], D3=[170,128,78,255], D4=[202,162,104,255];
  const h=((x*11+y*9+x*y*7+x*3)>>>0)%10;
  return h===0?D1:h<3?D2:h<7?D3:D4;
},'tile_dirt.png');

// 3. tile_road.png — cobblestone, seamless 16×16 grid
saveFn(16,16,(x,y)=>{
  // mortar at x%8==0 or y%8==0  (gives 2×2 stone grid in 16px)
  // then split each 8×8 stone quadrant into 4 (stone 4×4 each)
  // giving 4 stones across (3.5px per stone + mortar at 4,8,12... no...)
  // Use: mortar lines at x=0,5,10,15 area via (x+1)%5==0, similarly y
  const mx=(x+1)%5===0, my=(y+1)%5===0;
  if(mx||my) return MO;
  const sx=Math.floor((x+1)/5), sy=Math.floor((y+1)/5);
  const stagger=(sy%2)*2;
  const lx=(x+1+stagger)%5, bx=Math.floor((x+1+stagger)/5);
  const v=(bx*5+sy*7)%3;
  const inner=(lx*3+Math.floor((y+1)%5)*5)%4;
  const shades=[[138,123,106,255],[148,134,116,255],[128,113,96,255],[158,144,126,255]];
  if(inner===0) return shades[(v+1)%3];
  return shades[v];
},'tile_road.png');

// ============================================================
// PASS 2 — CIVIC BUILDINGS (16×16)
// ============================================================

// 4. building_house.png
{
  const cv=new CV(16,16);
  // Roof (wine-red) — top 9 rows
  cv.rect(0,0,15,8,W);
  // Roof ridge highlight (lighter, top-center)
  cv.hl(0,2,13,WL); cv.hl(1,3,12,WL); cv.hl(2,4,11,WL);
  // Roof darkens toward bottom edge
  cv.hl(6,1,14,WD); cv.hl(7,1,14,WD); cv.hl(8,1,14,WD);
  // Chimney (stone, top-left)
  cv.rect(1,0,2,2,SG); cv.s(1,0,SL); cv.s(2,0,SL);
  // Outline roof
  cv.hl(0,0,15,K); cv.vl(0,0,8,K); cv.vl(15,0,8,K);
  // Wall transition
  cv.hl(9,0,15,K);
  // Wall (parchment)
  cv.rect(0,10,15,15,P);
  cv.vl(0,10,15,K); cv.vl(15,10,15,K); cv.hl(15,0,15,K);
  // Wall shadow under roof
  cv.hl(10,1,14,PD);
  // Door (center-bottom)
  cv.rect(5,11,9,15,K);
  cv.rect(6,12,8,15,CD);
  cv.s(7,12,CDX); // door dark center
  cv.save('building_house.png');
}

// 5. building_farm.png
{
  const cv=new CV(16,16);
  // Outer fence posts
  cv.rect(0,0,15,15,FD);
  cv.rect(1,1,14,14,C);
  // Alternating crop rows inside
  for(let row=0;row<4;row++){
    const y1=2+row*3, y2=y1+1;
    cv.rect(2,y1,13,y2, row%2===0?FG:FL);
    // Soil row between crops
    if(y2+1<14) cv.hl(y2+1,2,13,CD);
  }
  // Fence detail: posts at corners & mid
  cv.s(0,0,C); cv.s(15,0,C); cv.s(0,15,C); cv.s(15,15,C);
  cv.s(0,7,CL); cv.s(15,7,CL);
  // Scarecrow (tiny cross in center)
  cv.s(7,4,K); cv.s(8,4,K);
  cv.s(7,5,C); cv.s(8,5,C);
  cv.s(6,5,CD); cv.s(9,5,CD);
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
  cv.save('building_farm.png');
}

// 6. building_lumberyard.png
{
  const cv=new CV(16,16);
  // Dark wood floor/base
  cv.rect(0,0,15,15,BK);
  // Sawdust floor (central area)
  cv.rect(1,1,11,13,CL);
  cv.rect(2,2,10,12,P); // bright sawdust center
  // Dark planks on floor (lines)
  for(let y=3;y<12;y+=3) cv.hl(y,2,10,PD);
  // Log pile (bottom-right corner)
  cv.rect(11,8,15,15,C);
  cv.hl(8,11,15,CD); cv.hl(11,11,15,CD); // log separators
  cv.s(13,9,CL); cv.s(13,12,CL); // log highlights
  // Roof/shed structure (top strip)
  cv.rect(0,0,15,3,BK);
  cv.hl(1,1,14,SD); cv.hl(2,1,14,SG); // plank detail
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
  // Saw blade detail (small circle center)
  cv.s(6,7,K); cv.s(7,6,K); cv.s(8,7,K); cv.s(7,8,K);
  cv.s(7,7,SL);
  cv.save('building_lumberyard.png');
}

// 7. building_quarry.png
{
  const cv=new CV(16,16);
  // Outer edge: light stone
  cv.rect(0,0,15,15,SL);
  // Ring 2
  cv.rect(2,2,13,13,SG);
  // Ring 3
  cv.rect(4,4,11,11,SD);
  // Ring 4 (inner pit)
  cv.rect(6,6,9,9,SDX);
  // Central void
  cv.rect(7,7,8,8,K);
  // Highlight top-left on each ring (light source)
  cv.s(2,2,SL2); cv.s(3,2,SL2); cv.s(2,3,SL2);
  cv.s(4,4,SL); cv.s(5,4,SL); cv.s(4,5,SL);
  // Cut stone blocks at top edge
  cv.rect(3,0,5,1,SL2); cv.rect(7,0,9,1,SL2); cv.rect(11,0,13,1,SL2);
  cv.s(6,0,SD); cv.s(10,0,SD);
  // Crane arm (top-right)
  cv.s(14,0,C); cv.s(14,1,C); cv.s(13,1,CD); cv.s(12,2,CD);
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
  cv.save('building_quarry.png');
}

// 8. building_mine.png
{
  const cv=new CV(16,16);
  // Dark earth
  cv.rect(0,0,15,15,[56,40,22,255]);
  // Inner earth (slightly lighter)
  cv.rect(1,1,14,14,[72,54,28,255]);
  // Mine entrance (arch shape — lower portion)
  cv.rect(3,5,12,15,SDX);  // entrance surround
  cv.rect(4,7,11,15,K);    // black interior
  // Wooden support beams
  cv.vl(4,5,14,C); cv.vl(11,5,14,C); // vertical posts
  cv.hl(5,3,12,C);  // horizontal beam
  cv.s(3,5,CD); cv.s(12,5,CD);
  // Arch curve (top of entrance)
  cv.s(5,6,C); cv.s(10,6,C);
  cv.s(6,5,SDX); cv.s(9,5,SDX);
  // Iron ore flecks (blue-gray) near entrance edges
  cv.s(3,9,IR); cv.s(3,11,ID); cv.s(12,8,IR); cv.s(12,12,IR);
  cv.s(2,7,IR); cv.s(13,10,ID);
  // Faint glow inside mine
  cv.s(7,10,[80,60,30,200]); cv.s(8,10,[80,60,30,200]);
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
  cv.save('building_mine.png');
}

// 9. building_academy.png
{
  const cv=new CV(16,16);
  // Base wall (purple-toned stone)
  cv.rect(0,0,15,15,PU);
  cv.rect(1,1,14,14,PUL);
  // Pointed slate roof (top portion)
  cv.rect(0,0,15,6,PUD);
  // Roof ridge (pointed)
  cv.s(7,0,K); cv.s(8,0,K);
  cv.hl(1,6,9,PUD); cv.hl(2,5,10,PUD);
  cv.hl(1,5,10,PU);
  // Roof highlight (lighter top-left slope)
  cv.s(3,3,PUL); cv.s(4,2,PUL); cv.s(5,1,PUL);
  // Arched window (center) with gold glow
  cv.rect(5,4,10,8,K);   // window frame
  cv.rect(6,5,9,8,[30,24,50,255]);  // window dark interior
  cv.s(7,5,GL); cv.s(8,5,GL); // glow pixels
  cv.s(7,6,[220,200,140,180]); cv.s(8,6,[220,200,140,180]);
  // Arch top of window
  cv.s(6,4,PUD); cv.s(9,4,PUD);
  // Door (bottom center)
  cv.rect(5,11,10,15,K);
  cv.rect(6,12,9,15,[28,22,44,255]);
  // Scroll/book motif on door
  cv.s(7,12,G); cv.s(8,12,G);
  // Stone block detail on walls
  cv.hl(9,2,13,PUD); cv.hl(11,2,13,PUD);
  cv.vl(2,8,10,PUD); cv.vl(13,8,10,PUD);
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
  cv.save('building_academy.png');
}

// 10. building_monument.png — 32×32
{
  const cv=new CV(32,32);
  // Ground / plinth base
  cv.rect(0,0,31,31,B);
  // Plinth (wide stone base)
  cv.rect(2,22,29,31,SG);
  cv.rect(3,23,28,30,SL);
  cv.hl(22,2,29,SL2); // plinth highlight (top face)
  cv.hl(23,3,28,SL2);
  // Plinth sides shadow
  cv.vl(2,22,31,SD); cv.vl(29,22,31,SD);
  cv.hl(31,2,29,SDX);
  // Obelisk shaft
  cv.rect(11,4,20,22,B);
  cv.rect(12,5,19,21,SL2);
  // Obelisk highlight (left face, top-left light source)
  cv.rect(12,5,14,21,P);
  // Obelisk shadow (right side)
  cv.vl(19,5,21,SG); cv.vl(20,5,21,SG);
  // Obelisk tip (pointed cap)
  cv.rect(13,1,18,4,G);
  cv.s(15,0,G); cv.s(16,0,G);
  cv.s(14,1,GL); cv.s(15,1,GL);
  cv.s(16,1,GD); cv.s(17,1,GD);
  // Gold hieroglyph markings
  cv.s(15,8,G); cv.s(16,8,G); cv.hl(9,14,17,G);
  cv.s(15,12,G); cv.s(16,12,G);
  cv.s(15,16,G); cv.s(16,16,G); cv.hl(17,14,17,G);
  cv.hl(11,14,17,GD);
  // Shadows radiate from base (dark corner patches)
  cv.rect(0,28,3,31,SDX); cv.rect(28,28,31,31,SDX);
  cv.s(0,27,SD); cv.s(31,27,SD);
  // Outer border
  cv.hl(0,0,31,K); cv.hl(31,0,31,K); cv.vl(0,0,31,K); cv.vl(31,0,31,K);
  cv.save('building_monument.png');
}

// ============================================================
// PASS 3 — MILITARY BUILDINGS
// ============================================================

// 11. building_wall.png — 16×16
{
  const cv=new CV(16,16);
  // Stone body
  cv.rect(0,0,15,15,SG);
  // Stone block texture
  for(let y=0;y<16;y+=4) for(let x=0;x<16;x+=5) { cv.s(x,y,SD); cv.s(x+2,y+2,SL); }
  // Crenellations at top (merlons at cols 0-3, 8-11; gaps at 4-7, 12-15)
  cv.rect(0,0,3,4,SL); cv.rect(4,0,7,2,SDX);  // merlon / gap
  cv.rect(8,0,11,4,SL); cv.rect(12,0,15,2,SDX);
  // Top highlight
  cv.hl(0,0,3,SL2); cv.hl(0,8,11,SL2);
  // Shadow at south edge
  cv.hl(14,0,15,SD); cv.hl(15,0,15,SDX);
  // Outline
  cv.hl(0,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K); cv.hl(15,0,15,K);
  cv.save('building_wall.png');
}

// Helper: draw gate stone arch onto a CV (shared between open/closed)
function drawGateArch(cv) {
  // Left wall (cols 0-4)
  cv.rect(0,0,4,15,SG);
  // Right wall (cols 11-15)
  cv.rect(11,0,15,15,SG);
  // Stone block texture on walls
  [0,4,8,12].forEach(y=>{
    cv.s(1,y,SL); cv.s(3,y,SD); cv.s(12,y,SL); cv.s(14,y,SD);
  });
  // Arch crown (top, spanning passage)
  cv.rect(4,0,11,3,SG);
  cv.s(4,0,SL); cv.s(11,0,SL); // arch highlight
  cv.s(5,1,SL); cv.s(10,1,SL);
  cv.hl(0,0,15,SL); // top row highlight
  // Arch keystone
  cv.s(7,2,SL2); cv.s(8,2,SL2);
  // Passage floor (dark brown)
  cv.rect(5,4,10,15,[30,20,10,255]);
  // Chain/winch detail on right side
  cv.s(12,3,SD); cv.s(12,4,SG); cv.s(13,4,K);
  // Outline entire canvas
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
}

// 12. building_gate_open.png
{
  const cv=new CV(16,16);
  drawGateArch(cv);
  // Raised portcullis — horizontal bar at top of passage + hanging bars
  cv.hl(4,5,10,IR); cv.hl(3,5,10,ID); // portcullis bar (raised)
  cv.s(5,5,IDX); cv.s(7,5,IDX); cv.s(9,5,IDX);
  // Small hanging bar stubs
  cv.vl(5,5,6,ID); cv.vl(7,5,6,ID); cv.vl(9,5,6,ID);
  cv.save('building_gate_open.png');
}

// 13. building_gate_closed.png
{
  const cv=new CV(16,16);
  drawGateArch(cv);
  // Portcullis bars fill passage (every 2 cols)
  for(let x=5;x<=10;x+=2) cv.vl(x,4,14,IR);
  for(let x=6;x<=10;x+=2) cv.vl(x,4,14,ID); // shadow bars
  // Horizontal cross-bars
  cv.hl(7,5,10,IDX); cv.hl(11,5,10,IDX);
  // Shadow cast by bars on floor
  cv.hl(14,5,10,[20,12,6,180]);
  cv.save('building_gate_closed.png');
}

// 14. building_tower.png — 16×32
{
  const cv=new CV(16,32);
  // Base (wider, rows 24-31)
  cv.rect(0,24,15,31,SG);
  cv.rect(1,25,14,31,SD);
  cv.hl(24,0,15,SL); cv.hl(25,1,14,SL);
  // Tower body (rows 6-23)
  cv.rect(2,6,13,23,SG);
  cv.rect(3,7,12,22,SD);
  // Stone block detail
  for(let y=7;y<23;y+=4) { cv.hl(y,3,12,SL); cv.hl(y+1,3,12,SD); }
  // Light left face
  cv.vl(3,7,22,SL); cv.vl(4,7,22,SG);
  // Arrow slit (midway)
  cv.rect(6,14,9,17,K);
  cv.s(7,15,ID); cv.s(8,15,ID);
  // Battlements top (rows 0-5)
  cv.rect(2,0,5,5,SL2);  // merlon left
  cv.rect(6,0,9,2,SDX);  // gap
  cv.rect(10,0,13,5,SL2); // merlon right
  cv.hl(0,2,13,SL2);
  // Wine-red banner (right side)
  cv.rect(13,8,15,16,W);
  cv.hl(8,13,15,WL); cv.hl(9,13,15,WL);
  cv.vl(15,8,16,WD);
  // Gold flagpole tip
  cv.s(15,7,G); cv.s(15,8,GD);
  // Outline
  cv.hl(0,0,15,K); cv.hl(31,0,15,K); cv.vl(0,0,31,K); cv.vl(15,0,31,K);
  cv.save('building_tower.png');
}

// 15. building_barracks.png — 16×16
{
  const cv=new CV(16,16);
  // Slate roof (dark grey, top portion)
  cv.rect(0,0,15,8,SDX);
  cv.rect(1,1,14,7,[62,54,44,255]);
  // Roof highlight and ridge
  cv.hl(0,1,14,SD); cv.hl(1,2,13,SG);
  // Shadow roof bottom
  cv.hl(7,1,14,K); cv.hl(8,0,15,K);
  // Wall
  cv.rect(0,9,15,15,SG);
  cv.rect(1,9,14,14,SD);
  cv.hl(9,1,14,SL); // wall highlight
  // Weapon rack on left wall
  cv.vl(2,9,14,C); // spear/pike
  cv.s(2,9,CL); cv.s(2,10,CL);
  cv.s(1,10,K); cv.s(3,10,K); // crosspiece
  // Wine-red banner above door
  cv.rect(5,9,10,10,W); cv.hl(9,5,10,WL);
  // Reinforced door
  cv.rect(5,11,10,15,BK);
  cv.s(6,11,K); cv.s(9,11,K); // door rivets
  cv.s(7,13,SG); cv.s(8,13,SG); // door handle/bar
  // Outline
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
  cv.save('building_barracks.png');
}

// 16. building_archery_range.png — 16×16
{
  const cv=new CV(16,16);
  // Green turf base
  cv.rect(0,0,15,15,FG);
  // Worn brown patches
  cv.rect(4,6,11,12,C);
  cv.rect(5,7,10,11,CD);
  // Fence around perimeter (posts)
  for(let i=0;i<16;i+=4) {
    cv.s(i,0,C); cv.s(i,15,C); cv.s(0,i,C); cv.s(15,i,C);
  }
  cv.hl(0,0,15,[80,54,28,255]); cv.hl(15,0,15,[80,54,28,255]);
  cv.vl(0,0,15,[80,54,28,255]); cv.vl(15,0,15,[80,54,28,255]);
  // Archery butt / straw target (top-center)
  cv.rect(6,0,9,4,[200,176,60,255]); // straw yellow
  cv.rect(7,1,8,3,W); // red bullseye
  cv.s(7,2,WL); // center
  // Target post
  cv.vl(7,4,6,BK); cv.vl(8,4,6,BK);
  // Barrel (bottom-right)
  cv.rect(12,12,14,15,C);
  cv.hl(12,12,14,CL); cv.hl(15,12,14,CD);
  cv.s(13,13,CD); cv.s(13,14,CD);
  // Grass variation
  cv.s(2,3,FL); cv.s(5,2,FD); cv.s(13,5,FL); cv.s(1,10,FD);
  cv.save('building_archery_range.png');
}

// 17. building_ballistatower.png — 16×32
{
  const cv=new CV(16,32);
  // Wider base (rows 22-31)
  cv.rect(0,22,15,31,SG);
  cv.rect(1,23,14,30,SD);
  cv.hl(22,0,15,SL); cv.hl(23,1,14,SL);
  cv.hl(31,0,15,SDX);
  // Tower body (rows 8-21) — slightly wider than guard tower
  cv.rect(1,8,14,21,SG);
  cv.rect(2,9,13,20,SD);
  // Stone block lines
  for(let y=9;y<21;y+=4) cv.hl(y,2,13,SL);
  // Light left face
  cv.vl(2,9,20,SL); cv.vl(3,9,20,SG);
  // Battlements (rows 4-7)
  cv.rect(1,4,5,7,SL2); cv.rect(6,4,9,5,SDX); cv.rect(10,4,14,7,SL2);
  cv.hl(4,1,14,SL2);
  // Ballista platform top (rows 0-3)
  cv.rect(1,0,14,3,SDX);
  cv.hl(0,1,14,SD); cv.hl(1,1,14,SG);
  // Ballista body (on platform)
  cv.rect(4,1,11,3,C);  // ballista frame (wood)
  cv.hl(1,4,11,CD);
  // Crossbow arms
  cv.vl(3,1,2,C); cv.vl(12,1,2,C); // vertical arms
  cv.s(2,1,K); cv.s(13,1,K);
  // Bolt loaded (horizontal line center)
  cv.hl(2,5,10,ID); cv.s(4,2,IDX); // bolt tip
  // Iron fittings (dark metal accents)
  cv.s(4,1,IDX); cv.s(11,1,IDX); cv.s(4,3,IDX); cv.s(11,3,IDX);
  // Outline
  cv.hl(0,0,15,K); cv.hl(31,0,15,K); cv.vl(0,0,31,K); cv.vl(15,0,31,K);
  cv.save('building_ballistatower.png');
}

// ============================================================
// PASS 4 — DESTRUCTION & OBSTACLES
// ============================================================

// 18. building_rubble.png — 16×16
{
  const cv=new CV(16,16);
  // Ashen base
  cv.rect(0,0,15,15,[90,80,68,255]);
  cv.rect(1,1,14,14,[110,98,82,255]);
  // Scattered stone blocks (irregular)
  cv.rect(0,0,4,3,SG); cv.s(0,0,SL); // block 1 top-left
  cv.rect(10,1,14,5,SD); cv.s(10,1,SL); // block 2 top-right
  cv.rect(2,7,7,11,SG); cv.s(2,7,SL); // block 3 mid-left
  cv.rect(9,9,14,13,SDX); cv.s(9,9,SD); // block 4 lower-right
  cv.rect(5,13,10,15,SG); cv.s(5,13,SL); // block 5 bottom
  // Broken timber beams (diagonal-ish)
  cv.s(6,2,BK); cv.s(7,3,BK); cv.s(8,4,C); cv.s(9,5,C); cv.s(10,6,BK);
  cv.s(3,12,C); cv.s(4,11,BK); cv.s(5,10,BK);
  // Scorch marks / ash
  cv.rect(5,4,8,7,[60,50,40,255]); cv.s(6,5,[48,38,28,255]); cv.s(7,5,[48,38,28,255]);
  // Dust / debris pixels
  cv.s(1,5,SL); cv.s(12,7,SL); cv.s(3,14,SD); cv.s(14,14,SDX);
  cv.s(8,12,K); cv.s(1,9,K); // charred debris
  cv.hl(0,0,15,K); cv.hl(15,0,15,K); cv.vl(0,0,15,K); cv.vl(15,0,15,K);
  cv.save('building_rubble.png');
}

// 25. obstacle_tree.png — 16×16
{
  const cv=new CV(16,16);
  // Dark trunk (center)
  cv.rect(6,10,9,13,BK); cv.s(7,10,C); cv.s(8,10,C);
  // Outer canopy ring (darkest, bottom-right shadow)
  cv.rect(2,4,13,13,FD);
  // Inner canopy (mid-green)
  cv.rect(3,3,12,12,FG);
  // Bright canopy center (top-left highlight)
  cv.rect(4,2,11,9,FL);
  // Highlight zone (top-left, light source)
  cv.rect(5,2,8,6,[130,176,80,255]);
  cv.s(6,2,[148,196,92,255]); cv.s(7,2,[148,196,92,255]);
  // Canopy top rounded shape (remove corners)
  cv.s(3,3,FG); cv.s(3,4,FG); cv.s(12,3,FD); cv.s(12,4,FD);
  cv.s(2,5,FD); cv.s(2,6,FD); cv.s(13,5,FD); cv.s(13,6,FD);
  // Canopy outline
  cv.outline();
  cv.save('obstacle_tree.png');
}

// 26. obstacle_stone.png — 16×16
{
  const cv=new CV(16,16);
  // Boulder cluster: 3 boulders
  // Boulder 1 (large, left-center)
  cv.rect(0,4,9,13,SD);
  cv.rect(1,3,8,12,SG);
  cv.rect(2,3,7,10,SL);
  cv.s(2,3,SL2); cv.s(3,3,SL2); cv.s(2,4,SL2); // top-left highlight
  cv.s(8,12,SDX); cv.s(8,11,SDX); // shadow right/bottom
  // Boulder 2 (smaller, top-right)
  cv.rect(8,1,14,8,SD);
  cv.rect(9,1,13,7,SG);
  cv.s(9,1,SL); cv.s(10,1,SL); // highlight
  cv.s(13,7,SDX); cv.s(13,6,SDX);
  // Boulder 3 (small, bottom-right)
  cv.rect(10,9,15,14,SDX);
  cv.rect(11,9,14,13,SD);
  cv.s(11,9,SG); // small highlight
  // Rock debris
  cv.s(0,14,SG); cv.s(1,15,SD); cv.s(7,14,SD); cv.s(15,9,SDX);
  cv.outline();
  cv.save('obstacle_stone.png');
}

// 27. obstacle_iron.png — 16×16
{
  const cv=new CV(16,16);
  // Similar shape to stone but darker with iron streaks
  // Boulder 1 (left-center) — darker stone
  cv.rect(0,4,9,13,[82,70,56,255]);
  cv.rect(1,3,8,12,SD);
  cv.rect(2,3,7,10,[116,102,86,255]);
  cv.s(2,3,SG); cv.s(3,3,SG); // slight highlight
  cv.s(8,12,SDX); cv.s(8,11,SDX);
  // Iron ore veins / striations (blue-gray)
  cv.s(3,5,IR); cv.s(4,6,IR); cv.s(5,7,ID); cv.s(3,8,IR);
  cv.s(6,5,ID); cv.s(4,9,IR); cv.s(5,4,IDX);
  // Metallic highlight on ore
  cv.s(3,5,[160,180,200,255]); cv.s(5,7,[140,164,188,255]);
  // Boulder 2 (top-right) — darker
  cv.rect(8,1,14,8,[82,70,56,255]);
  cv.rect(9,1,13,7,SD);
  cv.s(9,1,SG); // highlight
  cv.s(13,7,SDX);
  // Iron veins in boulder 2
  cv.s(10,3,IR); cv.s(11,4,ID); cv.s(12,3,IDX); cv.s(10,5,[160,180,200,255]);
  // Boulder 3 (bottom-right)
  cv.rect(10,9,15,14,SDX);
  cv.rect(11,9,14,13,[82,70,56,255]);
  cv.s(12,10,IR); cv.s(13,11,ID);
  // Metallic sheen highlight (brightest pixel on ore)
  cv.s(3,5,[200,216,234,255]); cv.s(10,3,[200,216,234,255]);
  cv.outline();
  cv.save('obstacle_iron.png');
}

// ============================================================
// PASS 5 — CHARACTERS (16×16)
// ============================================================

// 19. citizen_sprite.png
{
  const cv=new CV(16,16);
  // Head
  cv.rect(5,2,10,5,SK);     // face
  cv.hl(2,5,10,H);          // hair (top of head)
  cv.s(5,3,K); cv.s(10,3,K); // eyes (dark dots)
  // Body (parchment robe)
  cv.rect(3,6,12,12,P);
  cv.rect(4,6,11,11,P);     // main robe body
  // Collar
  cv.hl(6,5,10,K);
  // Robe shading
  cv.vl(3,6,11,PD); cv.vl(12,6,11,PD);
  cv.hl(12,4,11,PD);
  // Belt
  cv.hl(9,4,11,C);
  // Arms (sides of body)
  cv.vl(3,7,10,P); cv.vl(12,7,10,P);
  cv.s(3,10,PD); cv.s(12,10,PD);
  // Legs
  cv.rect(5,12,6,15,P); cv.rect(9,12,10,15,P);
  cv.vl(5,12,15,PD); cv.vl(10,12,15,PD);
  cv.outline();
  cv.save('citizen_sprite.png');
}

// 20. citizen_soldier.png
{
  const cv=new CV(16,16);
  // Helmet (round, steel gray)
  cv.rect(4,1,11,5,SG);
  cv.hl(1,4,11,SL);          // helmet highlight top
  cv.hl(2,5,10,SL);
  // Visor slit
  cv.hl(4,5,10,K);
  cv.s(5,4,K); cv.s(10,4,K); // visor dark
  cv.rect(5,4,10,4,IDX);     // visor band
  // Neck guard
  cv.rect(6,5,9,6,SD);
  // Armor body (steel)
  cv.rect(2,6,13,12,SG);
  cv.rect(3,7,12,11,SD);
  cv.vl(2,6,11,SL); cv.vl(3,7,11,SG);  // left highlight
  // Wine-red tabard (center)
  cv.rect(5,7,10,11,W);
  cv.hl(7,5,10,WL);
  cv.vl(5,7,11,WD);
  // Small shield (left arm)
  cv.rect(0,7,2,11,SL2);
  cv.rect(0,8,1,10,B);
  cv.s(0,9,G);               // shield boss
  // Short sword (right side, just hilt visible)
  cv.vl(14,8,12,ID); cv.s(14,8,IR);
  cv.s(13,9,K); cv.s(15,9,K); // crossguard
  // Legs (armored)
  cv.rect(5,12,7,15,SG); cv.rect(8,12,10,15,SG);
  cv.vl(5,12,15,SL); cv.vl(10,12,15,SD);
  cv.outline();
  cv.save('citizen_soldier.png');
}

// 21. citizen_archer.png
{
  const cv=new CV(16,16);
  // Wide-brimmed hat (teal)
  cv.rect(2,0,13,2,TED);
  cv.rect(4,1,11,3,TE);
  cv.hl(0,2,13,TEL);   // brim highlight
  cv.hl(1,4,11,K);     // hat brim outline
  // Head (slim)
  cv.rect(5,3,10,5,SK);
  cv.s(5,4,K); cv.s(10,4,K); // eyes
  // Hair under hat
  cv.hl(3,5,10,H);
  // Leather jerkin (brown)
  cv.rect(4,6,11,12,C);
  cv.rect(5,7,10,11,CL);
  cv.vl(4,6,11,CD);  // left shadow
  cv.vl(11,6,11,CD);
  // Teal accent: scarf/collar
  cv.hl(6,5,10,TE); cv.hl(7,5,10,TED);
  // Quiver + arrows (right side)
  cv.rect(12,5,13,12,C);
  cv.vl(12,4,7,K); cv.s(12,4,G); // arrow tip
  cv.vl(13,4,7,K); cv.s(13,4,G);
  // Bow (left arm, partial - vertical)
  cv.vl(2,5,12,C);
  cv.s(2,5,CL); cv.s(2,12,CL);
  cv.s(3,7,CD); cv.s(3,10,CD); // bow curves
  cv.s(1,9,K);  // bowstring
  // Legs (slim, leather)
  cv.rect(5,12,6,15,CD); cv.rect(9,12,10,15,CD);
  cv.outline();
  cv.save('citizen_archer.png');
}

// 22. citizen_knight.png
{
  const cv=new CV(16,16);
  // Great helm with plume
  cv.rect(3,0,12,6,SL2);
  cv.rect(4,1,11,5,SL);
  cv.hl(0,3,12,B);         // helm highlight
  // Plume (wine-red, top)
  cv.rect(6,0,9,1,W); cv.s(7,0,WL); cv.s(8,0,WL);
  // Visor (darker band)
  cv.rect(4,3,11,4,ID);
  cv.hl(3,4,11,IDX);
  // Gold trim on helm
  cv.s(3,0,G); cv.s(12,0,G); cv.s(3,5,G); cv.s(12,5,G);
  // Armor body (bulkier — 12 wide)
  cv.rect(1,6,14,12,SL);
  cv.rect(2,7,13,11,SG);
  cv.vl(1,6,11,B);           // left highlight
  cv.vl(2,7,11,SL);
  cv.vl(14,6,11,SD);         // right shadow
  // Gold trim on armor
  cv.hl(6,2,13,G); cv.hl(12,2,13,G);
  cv.s(1,6,G); cv.s(14,6,G); cv.s(1,11,G); cv.s(14,11,G);
  // Two-handed sword (right side, tall)
  cv.vl(15,3,13,B);   // blade
  cv.vl(15,2,13,SL2);
  cv.s(14,8,G); cv.s(15,8,G); // crossguard (horizontal)
  cv.hl(8,13,15,G);
  cv.s(15,9,C); // grip
  // Shield emblem center
  cv.rect(5,7,8,11,W); cv.s(6,8,G); cv.s(7,8,G); cv.s(6,9,G);
  // Legs (plate, wide)
  cv.rect(4,12,7,15,SL); cv.rect(8,12,11,15,SL);
  cv.vl(4,12,15,B); cv.vl(11,12,15,SD);
  // Gold boot tips
  cv.hl(15,4,7,G); cv.hl(15,8,11,G);
  cv.outline();
  cv.save('citizen_knight.png');
}

// 23. enemy_raider.png
{
  const cv=new CV(16,16);
  // Horned helmet (dark, with horns sticking out)
  const DARK=[30,20,12,255], FUR=[58,38,18,255];
  cv.rect(4,1,11,5,DARK);
  cv.rect(5,2,10,4,[50,38,24,255]);
  // Horns (jagged, on both sides)
  cv.vl(3,0,3,DARK); cv.s(2,0,DARK); cv.s(2,1,DARK); // left horn
  cv.vl(12,0,3,DARK); cv.s(13,0,DARK); cv.s(13,1,DARK); // right horn
  cv.s(3,0,K); cv.s(12,0,K); // horn tips dark
  // Red glowing eyes
  cv.s(5,3,RD); cv.s(6,3,[220,80,40,255]); // left eye (glowing)
  cv.s(9,3,RD); cv.s(10,3,[220,80,40,255]); // right eye
  // Neck / face paint
  cv.rect(6,5,9,6,FUR);
  cv.s(7,5,RD); cv.s(8,5,RD); // face paint
  // Fur shoulders + body (very dark, jagged)
  cv.rect(1,6,14,12,FUR);
  cv.rect(2,7,13,11,DARK);
  cv.vl(1,6,11,[70,48,24,255]); // fur texture left
  cv.vl(14,6,11,[40,26,10,255]); // shadow right
  // Jagged fur silhouette (irregular top)
  cv.s(1,6,K); cv.s(3,5,FUR); cv.s(3,6,FUR);
  cv.s(12,5,FUR); cv.s(12,6,FUR); cv.s(14,6,K);
  // Axe (right hand)
  cv.vl(14,7,14,C);   // handle
  cv.rect(13,5,15,8,[80,60,30,255]);  // axe head (brown iron)
  cv.s(14,5,SL); cv.s(15,5,SL);     // blade glint
  cv.hl(5,13,15,K);                  // axe blade outline
  // Raider lean-forward posture (body shifted right)
  cv.rect(9,11,13,15,FUR); // front leg
  cv.rect(3,12,7,15,DARK); // back leg
  cv.vl(9,11,15,[70,48,24,255]);
  cv.vl(7,12,15,DARK);
  cv.outline();
  cv.save('enemy_raider.png');
}

// 24. npc_merchant.png
{
  const cv=new CV(16,16);
  // Very wide-brimmed hat (warm tan)
  cv.rect(0,1,15,2,CD);      // brim (wide)
  cv.rect(3,0,12,3,C);       // hat crown
  cv.hl(0,0,15,CL);          // brim highlight
  cv.s(3,0,CL); cv.s(12,0,CL);  // crown highlight
  cv.hl(3,3,12,CD);          // hat shadow base
  // Round face (friendly)
  cv.rect(5,3,10,6,SK);
  cv.s(6,4,K); cv.s(9,4,K);  // dot eyes
  cv.s(7,5,SKD); cv.s(8,5,SKD); // smile hint
  // Wide warm-brown body (rounder than soldier)
  cv.rect(2,7,13,12,C);
  cv.rect(3,8,12,11,CL);
  cv.vl(2,7,11,CD); cv.vl(13,7,11,CD);
  // Large satchel (bulge on left/back)
  cv.rect(0,7,3,13,C);
  cv.rect(0,8,2,12,CD);
  cv.s(1,8,CL); // bag highlight
  cv.s(0,10,K); // bag latch
  // Coin pouch (right side, small)
  cv.rect(13,9,15,13,G);
  cv.rect(13,10,14,12,GL);
  cv.s(14,11,K); // pouch knot
  // Friendly stance (slightly wider feet)
  cv.rect(4,12,7,15,C); cv.rect(8,12,11,15,C);
  cv.vl(4,12,15,CL); cv.vl(11,12,15,CD);
  // Belt with buckle
  cv.hl(10,3,12,CD); cv.s(7,10,G); cv.s(8,10,G); // buckle
  cv.outline();
  cv.save('npc_merchant.png');
}

// ============================================================
// PASS 6 — EFFECTS & UI
// ============================================================

// 28. effect_fire.png — 16×16
{
  const cv=new CV(16,16);
  // Build flame from bottom up
  // Base (yellow, widest)
  cv.rect(4,14,11,15,EL);
  cv.s(3,14,[240,200,80,200]); cv.s(12,14,[240,200,80,200]);
  // Lower flame (orange)
  cv.rect(4,11,11,13,E);
  cv.rect(5,9,10,10,E);
  cv.s(3,12,[200,90,20,220]); cv.s(12,12,[200,90,20,220]);
  // Mid flame (ember-orange, narrowing)
  cv.rect(5,7,10,8,[180,70,14,255]);
  cv.rect(6,5,9,6,ED);
  // Tips (dark red, transparent edges)
  cv.rect(6,3,9,4,ED);
  cv.s(7,2,[148,36,8,220]); cv.s(8,2,[148,36,8,220]);
  cv.s(7,1,[120,20,4,180]); cv.s(8,1,[100,16,4,140]);
  // Flame flicker wisps
  cv.s(5,6,[200,90,20,200]); cv.s(10,6,[200,90,20,200]);
  cv.s(4,9,[240,180,40,160]); cv.s(11,9,[240,180,40,160]);
  cv.s(4,8,[230,160,30,140]); cv.s(11,8,[200,100,20,140]);
  // Yellow highlight in core
  cv.s(7,10,EL); cv.s(8,10,EL);
  cv.s(7,12,[250,220,80,255]); cv.s(8,12,[250,220,80,255]);
  cv.save('effect_fire.png');
}

// 29. effect_drought.png — 16×16
{
  const cv=new CV(16,16);
  // Pale sand/clay base
  const SAND=[200,174,122,255], CRACK=[72,50,24,255];
  cv.rect(0,0,15,15,SAND);
  // Slight color variation
  cv.rect(3,3,12,12,[210,184,132,255]);
  cv.rect(6,6,9,9,[220,196,146,255]);
  // Network of dark cracks
  // Main crack (diagonal NW to SE)
  cv.s(0,3,CRACK); cv.s(1,4,CRACK); cv.s(2,4,CRACK); cv.s(3,5,CRACK);
  cv.s(4,5,CRACK); cv.s(5,6,CRACK); cv.s(6,7,CRACK); cv.s(7,8,CRACK);
  cv.s(8,8,CRACK); cv.s(9,9,CRACK); cv.s(10,10,CRACK); cv.s(11,10,CRACK);
  cv.s(12,11,CRACK); cv.s(13,12,CRACK); cv.s(14,12,CRACK); cv.s(15,13,CRACK);
  // Branch crack from center
  cv.s(6,7,CRACK); cv.s(5,8,CRACK); cv.s(4,9,CRACK); cv.s(3,10,CRACK);
  cv.s(7,9,CRACK); cv.s(8,10,CRACK); cv.s(8,11,CRACK);
  // Horizontal crack (top area)
  cv.s(8,2,CRACK); cv.s(9,2,CRACK); cv.s(10,2,CRACK); cv.s(11,3,CRACK);
  cv.s(12,3,CRACK); cv.s(13,3,CRACK); cv.s(11,4,CRACK); cv.s(10,4,CRACK);
  // Short cracks (bottom-left)
  cv.s(1,12,CRACK); cv.s(2,12,CRACK); cv.s(2,13,CRACK); cv.s(3,13,CRACK);
  cv.s(1,13,CRACK); cv.s(0,14,CRACK);
  cv.s(4,14,CRACK); cv.s(5,14,CRACK); cv.s(5,15,CRACK);
  // Lighter crack edges (dried out)
  cv.s(0,2,[220,194,148,255]); cv.s(14,11,[220,194,148,255]);
  cv.save('effect_drought.png');
}

// 30. ui_logo.png — 256×80
{
  const cv=new CV(256,80);
  // Dark vignette background
  cv.rect(0,0,255,79,[12,8,4,255]);
  // Subtle gradient - lighter center
  cv.rect(40,10,215,69,[22,14,6,255]);
  cv.rect(70,20,185,59,[28,18,8,255]);
  // Decorative border (thin gold line)
  cv.hl(2,2,253,GD); cv.hl(77,2,253,GD);
  cv.vl(2,2,77,GD); cv.vl(253,2,77,GD);
  cv.hl(3,3,252,GD); cv.hl(76,3,252,GD);
  // Crown glyph (above text, center)
  const cx=128;
  // Crown base
  cv.rect(cx-12,6,cx+12,10,GD);
  cv.rect(cx-11,7,cx+11,9,G);
  // Crown points
  cv.rect(cx-12,4,cx-10,6,G);  // left point
  cv.rect(cx-2,3,cx+2,6,G);   // center point (taller)
  cv.s(cx,2,GL); cv.s(cx+1,2,GL); // center tip
  cv.rect(cx+9,4,cx+11,6,G);  // right point
  // Crown jewels
  cv.s(cx-11,5,WL); cv.s(cx,3,GL); cv.s(cx+10,5,WL);
  // Draw "PIXEL" (top line, scale=3)
  // Width: 5 chars × (6+1)×3 = 105px. Center: (256-105)/2 = 75
  const pixelX=75, pixelY=16;
  // Shadow first (ink, offset +2,+2)
  drawString(cv,'PIXEL',pixelX+2,pixelY+2,K,3);
  // Gold text
  drawString(cv,'PIXEL',pixelX,pixelY,G,3);
  // Highlight top-left of letters
  drawString(cv,'PIXEL',pixelX-1,pixelY-1,GL,3);
  // Redraw main gold on top
  drawString(cv,'PIXEL',pixelX,pixelY,G,3);
  // Draw "DOMINION" (bottom line, scale=3)
  // Width: 8 chars × 21 = 168px. Center: (256-168)/2 = 44
  const domX=44, domY=44;
  drawString(cv,'DOMINION',domX+2,domY+2,K,3);
  drawString(cv,'DOMINION',domX,domY,GD,3);
  drawString(cv,'DOMINION',domX-1,domY-1,GL,3);
  drawString(cv,'DOMINION',domX,domY,G,3);
  // Decorative divider line between words
  cv.hl(42,60,195,GD);
  cv.s(60,42,G); cv.s(195,42,G);
  cv.save('ui_logo.png');
}

// 31. ui_event_banner.png — 320×48
{
  const cv=new CV(320,48);
  // Main parchment field
  cv.rect(0,0,319,47,PD);
  cv.rect(8,4,311,43,P);
  cv.rect(16,8,303,39,[248,238,210,255]); // bright center
  // Gold border
  cv.hl(4,8,311,GD); cv.hl(43,8,311,GD); // top/bottom gold lines
  cv.vl(8,4,43,GD); cv.vl(311,4,43,GD);  // left/right gold lines
  cv.hl(5,8,311,GL); cv.hl(42,8,311,GL); // inner highlight
  // Wine-red accent strips
  cv.hl(6,8,311,WD); cv.hl(41,8,311,WD);
  // Rolled scroll ends (left side)
  cv.rect(0,0,14,47,C);   // roll body
  cv.rect(1,1,13,46,CL);  // roll interior
  cv.vl(7,0,47,CD);       // center shadow
  cv.hl(0,1,13,CL);       // top highlight of roll
  cv.hl(47,1,13,CD);      // bottom shadow of roll
  // Roll end caps (darker)
  cv.rect(0,0,2,47,CD);   cv.rect(12,0,14,47,CD);
  // Rolled scroll ends (right side)
  cv.rect(305,0,319,47,C);
  cv.rect(306,1,318,46,CL);
  cv.vl(312,0,47,CD);
  cv.hl(0,306,318,CL); cv.hl(47,306,318,CD);
  cv.rect(305,0,307,47,CD); cv.rect(317,0,319,47,CD);
  // Parchment texture (subtle horizontal lines)
  for(let y=10;y<38;y+=6) cv.hl(y,16,303,PD);
  // Outer border
  cv.hl(0,0,319,K); cv.hl(47,0,319,K); cv.vl(0,0,47,K); cv.vl(319,0,47,K);
  cv.save('ui_event_banner.png');
}

// ============================================================
// UPDATE ART_ASSETS.md — Mark all 31 as Complete
// ============================================================
console.log('\nUpdating ART_ASSETS.md...');
let md = fs.readFileSync(ART_ASSETS, 'utf8');

// Replace all "| Not Started |" status cells → "| Complete |"
md = md.replace(/\| Not Started \|/g, '| Complete |');

// Update the summary table counts
md = md.replace(/\| Terrain Tiles \| 3 \| 3 \| 0 \|/,       '| Terrain Tiles | 3 | 0 | 3 |');
md = md.replace(/\| Civic Buildings \| 7 \| 7 \| 0 \|/,      '| Civic Buildings | 7 | 0 | 7 |');
md = md.replace(/\| Military Buildings \| 7 \| 7 \| 0 \|/,   '| Military Buildings | 7 | 0 | 7 |');
md = md.replace(/\| Destruction \| 1 \| 1 \| 0 \|/,          '| Destruction | 1 | 0 | 1 |');
md = md.replace(/\| Characters & Units \| 6 \| 6 \| 0 \|/,   '| Characters & Units | 6 | 0 | 6 |');
md = md.replace(/\| Obstacles & Resources \| 3 \| 3 \| 0 \|/,'| Obstacles & Resources | 3 | 0 | 3 |');
md = md.replace(/\| Effects \| 2 \| 2 \| 0 \|/,              '| Effects | 2 | 0 | 2 |');
md = md.replace(/\| UI & Branding \| 2 \| 2 \| 0 \|/,        '| UI & Branding | 2 | 0 | 2 |');
md = md.replace(/\| \*\*Total\*\* \| \*\*31\*\* \| \*\*31\*\* \| \*\*0\*\* \|/, '| **Total** | **31** | **0** | **31** |');

fs.writeFileSync(ART_ASSETS, md, 'utf8');
console.log('✓ ART_ASSETS.md updated — all 31 assets marked Complete');
console.log('\n🏰 Pixel Dominion sprites complete!');
