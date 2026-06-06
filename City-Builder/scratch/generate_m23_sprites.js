// ============================================================
// Pixel Dominion — Milestone 23 Sprites Generator
// Generates:
//   enemy_torch_raider.png
//   enemy_siege_raider.png
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

const K = [26,16,8,255]; // Ink/Outline

// ── 1. enemy_torch_raider.png ────────────────────────────────────────────────
{
  const cv = new CV(16,16);
  
  const HELMB = [44, 28, 16, 255];    // helmet base - darker/near black
  const HELMH = [72, 38, 24, 255];    // helmet highlight - dark red-brown
  const FUR_D = [34, 22, 14, 255];    // fur dark - extremely dark brown
  const FUR_M = [60, 24, 28, 255];    // fur mid - dark burgundy/red (feral look)
  const FUR_L = [94, 32, 38, 255];    // fur light - red highlights
  const TORCH_W = [100, 68, 28, 255]; // wood handle
  const FLAME_R = [180, 40, 20, 255];  // flame red
  const FLAME_O = [212, 99, 26, 255];  // flame orange (E)
  const FLAME_Y = [246, 176, 60, 255]; // flame yellow (EL)
  const EYE = [224, 60, 14, 255];     // glowing red eyes

  // Spikes on helm instead of horns
  cv.s(3,1,K); cv.s(3,2,HELMB);
  cv.s(7,0,K); cv.s(7,1,HELMH); cv.s(7,2,HELMH);
  cv.s(11,1,K); cv.s(11,2,HELMB);

  // Helmet body (rows 2-6, cols 4-11)
  cv.rect(4,2,11,6,HELMB);
  cv.hl(2,4,11,HELMH);
  cv.s(5,4,EYE); cv.s(6,4,EYE);
  cv.s(9,4,EYE); cv.s(10,4,EYE);

  // Jaw/Neck
  cv.rect(6,7,9,7,FUR_D);

  // Fur body (rows 8-12, cols 4-11)
  cv.rect(4,8,11,12,FUR_D);
  cv.hl(9,5,10,FUR_M);
  cv.hl(10,5,10,FUR_L);
  cv.hl(11,5,10,FUR_M);
  cv.s(5,9,FUR_L); cv.s(10,9,FUR_L);
  cv.s(4,10,FUR_M); cv.s(11,10,FUR_M);

  // Torch in hand (cols 13-15, rows 4-13)
  cv.vl(13,8,12,TORCH_W);
  cv.s(13,13,K);
  // Flame cluster (rows 4-7, cols 12-15)
  cv.rect(12,6,14,7,FLAME_R);
  cv.s(13,6,FLAME_O); cv.s(14,6,FLAME_O);
  cv.s(13,5,FLAME_Y); cv.s(14,5,FLAME_Y);
  cv.s(13,4,FLAME_O);

  // Legs
  cv.rect(5,13,7,15,FUR_D);
  cv.rect(8,13,10,15,FUR_D);
  cv.vl(5,13,15,FUR_M); cv.vl(10,13,15,FUR_M);

  cv.outline();
  cv.save('enemy_torch_raider.png');
}

// ── 2. enemy_siege_raider.png ────────────────────────────────────────────────
{
  const cv = new CV(16,16);

  const AM_D = [38, 38, 38, 255];    // Armor dark
  const AM_M = [55, 55, 55, 255];    // Armor mid
  const AM_L = [80, 96, 110, 255];   // Armor light (iron blue-grey hint)
  const WOOD = [90, 58, 20, 255];    // Wood for maul handle
  const H_D  = [50, 60, 74, 255];    // Hammer dark (IDX)
  const H_M  = [74, 90, 106, 255];   // Hammer mid (ID)
  const H_L  = [106, 122, 138, 255];  // Hammer light (IR)
  const H_G  = [214, 228, 242, 255]; // Hammer glint (metallic)
  const HELM = [45, 45, 45, 255];    // Helm base
  const H_HL = [70, 70, 70, 255];    // Helm highlight
  const EYE  = [224, 60, 14, 255];   // Feral red eyes

  // Helm (rows 2-6, cols 4-11)
  cv.rect(4,2,11,6,HELM);
  cv.hl(2,5,10,H_HL);
  cv.s(4,2,H_HL); cv.s(11,2,H_HL);
  // Red eyes
  cv.s(5,4,EYE); cv.s(6,4,EYE);
  cv.s(9,4,EYE); cv.s(10,4,EYE);

  // Jaw/Neck
  cv.rect(6,7,9,7,AM_D);

  // Bulkier armor body: rows 8-12, cols 2-13 (noticeably wider than standard 3-12)
  cv.rect(2,8,13,12,AM_D);
  cv.rect(3,8,12,11,AM_M);
  // Plate highlights on shoulders
  cv.rect(2,8,4,9,AM_L); // Left shoulder plate
  cv.rect(11,8,13,9,AM_L); // Right shoulder plate
  cv.s(2,8,H_G); cv.s(13,8,H_G); // Metallic reflection on pauldrons
  // Chest plates
  cv.hl(10,4,11,AM_L);
  cv.hl(11,4,11,AM_M);

  // Battering-ram / Maul weapon:
  // Handle (diagonal from bottom left hand up to top right)
  cv.s(3,11,WOOD); cv.s(4,10,WOOD); cv.s(5,9,WOOD);
  cv.s(6,8,WOOD); cv.s(7,7,WOOD); cv.s(8,6,WOOD);
  cv.s(9,5,WOOD); cv.s(10,4,WOOD); cv.s(11,3,WOOD);
  // Giant Maul head (cols 11-15, rows 1-5)
  cv.rect(11,1,15,5,H_D);
  cv.rect(12,2,14,4,H_M);
  cv.hl(1,12,14,H_L);
  cv.vl(12,2,4,H_L);
  cv.s(12,1,H_G); // hammer sheen

  // Legs (armored, wide)
  cv.rect(3,13,6,15,AM_D);
  cv.rect(9,13,12,15,AM_D);
  cv.vl(3,13,15,AM_M); cv.vl(12,13,15,AM_M);

  cv.outline();
  cv.save('enemy_siege_raider.png');
}

console.log('✅ Milestone 23 sprites generated successfully.');
