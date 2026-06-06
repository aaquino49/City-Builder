// ============================================================
// Pixel Dominion — Milestone 26 Sprites Generator
// Generates:
//   building_tavern.png
// ============================================================
'use strict';
const fs   = require('path');
const fs2  = require('fs');
const zlib = require('zlib');

const SPRITES_DIR = fs.resolve(__dirname, '../assets/sprites');
if (!fs2.existsSync(SPRITES_DIR)) fs2.mkdirSync(SPRITES_DIR, { recursive: true });

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
  fs2.writeFileSync(filePath, png);
  console.log('✓  ' + fs.basename(filePath));
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
  save(name) { saveGrid(this.px, fs.join(SPRITES_DIR, name)); return this; }
}

const K = [26,16,8,255]; // Ink/Outline

// ── building_tavern.png ──────────────────────────────────────────────────────
{
  const cv = new CV(16,16);

  const P = [240,230,200,255];   // Parchment wall
  const PD = [210,195,165,255];  // Dark parchment wall
  const G = [200,168,75,255];    // Gold (thatch mid)
  const GL = [232,204,112,255];  // Gold light (thatch highlights)
  const GD = [148,118,34,255];   // Gold dark (thatch shadows)
  const BK = [42,28,14,255];      // Dark wood / timber
  const C = [139,101,50,255];     // Wood mid
  const CD = [100,68,28,255];     // Wood dark
  const CDX = [64,38,12,255];     // Wood very dark
  const E = [212,99,26,255];      // Ember orange
  const EL = [246,176,60,255];    // Candlelight yellow
  const SG = [138,123,106,255];   // Stone base
  const SD = [106,94,80,255];     // Stone shadow
  const SL = [168,154,137,255];   // Stone light
  const IR = [106,122,138,255];   // Iron blue-gray

  // ── Thatched Roof (rows 1-7, cols 2-13) ──
  cv.hl(1, 7, 8, GL);
  cv.hl(2, 6, 9, G);
  cv.hl(3, 5, 10, G);
  cv.hl(4, 4, 11, G);
  cv.hl(5, 3, 12, G);
  cv.hl(6, 2, 13, G);
  cv.hl(7, 1, 14, GD);

  // Thatch vertical straw lines/highlights
  cv.s(7,2,GL); cv.s(8,2,GL);
  cv.s(6,3,GL); cv.s(9,3,GL);
  cv.s(5,4,GL); cv.s(10,4,GD);
  cv.s(4,5,GL); cv.s(11,5,GD);
  cv.s(3,6,GL); cv.s(12,6,GD);
  cv.s(2,7,GD); cv.s(13,7,GD);

  // Chimney (rows 2-4, col 11-12)
  cv.rect(11,2,12,4,SG);
  cv.s(11,2,SL); cv.s(12,2,SL);
  cv.s(12,3,SD); cv.s(12,4,SD);

  // ── Timber Frame Walls (rows 8-15, cols 2-13) ──
  cv.rect(2,8,13,15,P);
  // Stone foundation at very bottom row 15
  cv.hl(15,2,13,SG);
  cv.s(2,15,SD); cv.s(13,15,SD);

  // Timber Frame lines
  cv.vl(2,8,15,BK);  // Left corner post
  cv.vl(13,8,15,BK); // Right corner post
  cv.hl(8,2,13,BK);  // Top horizontal beam
  cv.hl(12,2,13,BK); // Mid horizontal beam
  
  // Vertical timber beams
  cv.vl(5,8,12,BK);
  cv.vl(8,8,12,BK);
  
  // Diagonal cross-bracing
  cv.s(3,9,BK); cv.s(4,10,BK);
  cv.s(12,9,BK); cv.s(11,10,BK);

  // ── Warm-lit Window (cols 3-5, rows 10-11) ──
  cv.rect(3,10,5,11,K);
  cv.rect(4,10,4,11,EL);
  cv.s(3,10,E); cv.s(5,11,E);

  // ── Door (cols 8-10, rows 10-15) ──
  cv.rect(8,10,10,15,CD);
  cv.rect(9,11,9,15,CDX);
  cv.s(8,10,K); cv.s(10,10,K);
  cv.s(9,13,EL); // door window

  // ── Hanging Sign (cols 0-2, rows 7-10) ──
  cv.hl(7,0,2,BK);
  cv.rect(0,8,1,9,G);
  cv.s(0,8,GL); cv.s(1,9,GD);
  cv.s(0,7,IR); cv.s(1,7,IR);

  cv.outline();
  cv.save('building_tavern.png');
}

console.log('✅ building_tavern.png generated successfully.');
