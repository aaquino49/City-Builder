// ============================================================
// Pixel Dominion — Milestone 25 Sprites Generator
// Generates:
//   building_granary.png
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

// ── building_granary.png ─────────────────────────────────────────────────────
{
  const cv = new CV(16,16);

  const SG = [138, 123, 106, 255];  // Stone gray
  const SL = [168, 154, 137, 255];  // Stone light
  const SL2 = [195, 183, 168, 255]; // Stone very light
  const SD = [106, 94, 80, 255];    // Stone dark
  const SDX = [76, 66, 54, 255];    // Stone very dark
  
  const C = [139, 101, 50, 255];     // Clay / warm brown
  const CL = [200, 168, 120, 255];   // Clay light
  const CD = [100, 68, 28, 255];     // Clay dark
  const CDX = [64, 38, 12, 255];     // Clay very dark
  const BK = [42, 28, 14, 255];      // Dark wood
  
  const P = [240, 230, 200, 255];    // Parchment / sack base
  const PD = [210, 195, 165, 255];   // Parchment dark / sack shadow
  
  const IR = [106, 122, 138, 255];   // Iron blue-gray
  
  // ── Timber Barrel Roof (rows 1-7, cols 3-12) ──
  cv.hl(1, 6, 9, CD);
  cv.hl(2, 5, 10, C);
  cv.hl(3, 4, 11, C);
  cv.rect(3, 4, 12, 7, C); // body of the roof
  
  // Roof highlights & horizontal lines
  cv.hl(1, 6, 7, CL);
  cv.hl(2, 5, 7, CL);
  cv.hl(3, 4, 7, CL);
  cv.hl(4, 4, 11, CD);
  cv.hl(5, 3, 7, CL);
  cv.hl(6, 3, 12, CD);
  cv.hl(7, 3, 12, CDX);
  
  // ── Stone walls (rows 8-15, cols 3-12) ──
  cv.rect(3, 8, 12, 15, SG);
  // Highlight / shading on stone walls
  cv.vl(3, 8, 15, SL);
  cv.vl(4, 8, 15, SL2);
  cv.vl(11, 8, 15, SD);
  cv.vl(12, 8, 15, SDX);
  
  // Brick detail lines
  cv.hl(10, 3, 12, SD);
  cv.hl(13, 3, 12, SD);
  cv.s(5, 9, SL2);
  cv.s(10, 12, SDX);
  
  // ── Arched Double Doors (cols 6-9, rows 11-15) ──
  cv.rect(6, 11, 9, 15, BK);
  cv.s(6, 11, K); cv.s(9, 11, K);
  cv.s(7, 11, BK); cv.s(8, 11, BK);
  // Door details
  cv.vl(7, 12, 15, CDX);
  cv.vl(8, 12, 15, CDX);
  // Hinges
  cv.s(6, 12, IR); cv.s(9, 12, IR);
  cv.s(6, 14, IR); cv.s(9, 14, IR);
  
  // ── Left: Grain Sack (cols 1-3, rows 12-15) ──
  cv.rect(1, 13, 3, 15, P);
  cv.s(2, 12, P);
  cv.s(1, 13, PD); cv.s(1, 14, PD); cv.s(1, 15, PD);
  cv.s(2, 12, CD); // tie
  
  // ── Right: Barrel (cols 12-14, rows 12-15) ──
  cv.rect(12, 12, 14, 15, C);
  cv.vl(12, 12, 15, CL);
  cv.vl(14, 12, 15, CD);
  cv.hl(13, 12, 14, IR);
  cv.hl(15, 12, 14, IR);

  cv.outline();
  cv.save('building_granary.png');
}

console.log('✅ building_granary.png generated successfully.');
