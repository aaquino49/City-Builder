// ============================================================
// Pixel Dominion — Priority 2 Sprites Generator
// Generates:
//   enemy_torch_raider.png
//   enemy_siege_raider.png
//   building_warehouse.png
//   ui_logo.png
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
const P   = [240,230,200,255]; // Parchment
const PD  = [210,195,165,255]; // Parchment dark
const PP  = [180,165,130,255]; // Parchment very dark
const G   = [200,168,75,255];   // Aged Gold
const GD  = [148,118,34,255];   // Gold dark
const GL  = [232,204,112,255];  // Gold light
const W   = [107,36,56,255];    // Burgundy
const WL  = [162,74,94,255];    // Burgundy light
const WD  = [68,18,32,255];     // Burgundy dark
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

// ── 5. enemy_torch_raider.png ───────────────────────────────────────────────
{
  const cv = new CV(16,16);
  
  const HELMB = [58, 40, 18, 255];    // helmet base - darker/near black
  const HELMH = [96, 72, 36, 255];    // helmet highlight - dark red-brown
  const FUR_D = [34, 22, 14, 255];    // fur dark - extremely dark brown
  const FUR_M = [70, 30, 36, 255];    // fur mid - dark burgundy/red (feral look)
  const FUR_L = [118, 44, 50, 255];   // fur light - red highlights
  const TORCH_W = [100, 68, 28, 255]; // wood handle
  const FLAME_R = [180, 40, 20, 255];  // flame red
  const FLAME_O = [212, 99, 26, 255];  // flame orange (E)
  const FLAME_Y = [246, 176, 60, 255]; // flame yellow (EL)
  const EYE = [224, 60, 14, 255];     // glowing red eyes

  // Spikes on helm instead of horns (combats silhouette confusion)
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

  // Fur body (rows 8-12, cols 4-11) - feral design
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

// ── 6. enemy_siege_raider.png ───────────────────────────────────────────────
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

// ── 7. building_warehouse.png ────────────────────────────────────────────────
{
  const cv = new CV(16,16);

  // Dark Slate Shingle Roof (rows 1-6, cols 2-13)
  cv.hl(1, 7, 8, SD);
  cv.hl(2, 6, 9, SD);
  cv.hl(3, 5, 10, SD);
  cv.hl(4, 4, 11, SD);
  cv.hl(5, 3, 12, SDX);
  cv.hl(6, 2, 13, SDX);

  // Roof highlights & tiles
  cv.s(7, 1, SL2); cv.s(6, 2, SL); cv.s(8, 2, SDX);
  cv.s(5, 3, SL); cv.s(9, 3, SDX);
  cv.s(4, 4, SL); cv.s(10, 4, SDX);
  cv.s(3, 5, SL); cv.s(11, 5, SDX);
  cv.s(2, 6, SL); cv.s(12, 6, SDX);

  // Timber walls with stone foundation (rows 7-15, cols 2-13)
  cv.rect(2, 7, 13, 15, P);
  
  // Stone base (row 15)
  cv.hl(15, 2, 13, SG);
  cv.s(2, 15, SD); cv.s(13, 15, SDX);

  // Heavy timber framing (BK)
  cv.vl(2, 7, 15, BK);   // Left frame post
  cv.vl(13, 7, 15, BK);  // Right frame post
  cv.vl(5, 7, 15, BK);   // Door frame left
  cv.vl(10, 7, 15, BK);  // Door frame right
  cv.hl(7, 2, 13, BK);   // Top wall beam
  cv.hl(11, 2, 13, BK);  // Middle wall beam

  // Large double doors (cols 6-9, rows 10-15) - heavy wood planks
  cv.rect(6, 10, 9, 15, CD);
  cv.rect(7, 11, 8, 15, CDX);
  cv.vl(7, 10, 15, BK);  // split down middle of double doors
  // Iron hinges
  cv.s(6, 11, IR); cv.s(9, 11, IR);
  cv.s(6, 14, IR); cv.s(9, 14, IR);

  // Left: Stacked General Goods Crates (cols 0-4, rows 11-15)
  cv.rect(0, 12, 3, 15, C); // bottom crate
  cv.vl(0, 12, 15, CL);
  cv.vl(3, 12, 15, CD);
  cv.s(1, 12, K); cv.s(2, 15, K); // cross bracing detail
  // Top crate
  cv.rect(1, 9, 3, 11, C);
  cv.vl(1, 9, 11, CL);
  cv.vl(3, 9, 11, CD);
  cv.s(2, 10, BK);

  // Right: Stacked Barrels (cols 12-15, rows 12-15)
  cv.rect(12, 12, 14, 15, CD);
  cv.vl(12, 12, 15, CL);
  cv.vl(14, 12, 15, CDX);
  cv.hl(13, 12, 14, IR); // iron hoop bands
  cv.hl(15, 12, 14, IR);

  cv.outline();
  cv.save('building_warehouse.png');
}

// ── 8. ui_logo.png ───────────────────────────────────────────────────────────
{
  const cv = new CV(256,80);
  
  // Dark vignette background treatment for start screen compositing
  cv.rect(0,0,255,79,[12,8,4,255]);
  cv.rect(40,10,215,69,[22,14,6,255]);
  cv.rect(70,20,185,59,[28,18,8,255]);
  
  // Thin decorative gold border framing the logo
  cv.hl(2,2,253,GD); cv.hl(77,2,253,GD);
  cv.vl(2,2,77,GD); cv.vl(253,2,77,GD);
  cv.hl(3,3,252,GD); cv.hl(76,3,252,GD);
  
  // Crown glyph (above text, centered)
  const cx=128;
  cv.rect(cx-12,6,cx+12,10,GD);
  cv.rect(cx-11,7,cx+11,9,G);
  cv.rect(cx-12,4,cx-10,6,G);  // left point
  cv.rect(cx-2,3,cx+2,6,G);   // center point (taller)
  cv.s(cx,2,GL); cv.s(cx+1,2,GL);
  cv.rect(cx+9,4,cx+11,6,G);  // right point
  // Crown jewels
  cv.s(cx-11,5,WL); cv.s(cx,3,GL); cv.s(cx+10,5,WL);
  
  // Draw "PIXEL" (top line, scale=3)
  // Width: 5 chars * 7 * 3 = 105px. Center: (256-105)/2 = 75
  const pixelX=75, pixelY=16;
  drawString(cv,'PIXEL',pixelX+2,pixelY+2,K,3);   // Ink shadow
  drawString(cv,'PIXEL',pixelX,pixelY,G,3);       // Main gold
  drawString(cv,'PIXEL',pixelX-1,pixelY-1,GL,3);  // Highlight
  drawString(cv,'PIXEL',pixelX,pixelY,G,3);
  
  // Draw "DOMINION" (bottom line, scale=3)
  // Width: 8 chars * 7 * 3 = 168px. Center: (256-168)/2 = 44
  const domX=44, domY=44;
  drawString(cv,'DOMINION',domX+2,domY+2,K,3);   // Ink shadow
  drawString(cv,'DOMINION',domX,domY,GD,3);      // Dark gold
  drawString(cv,'DOMINION',domX-1,domY-1,GL,3);  // Highlight
  drawString(cv,'DOMINION',domX,domY,G,3);
  
  // Decorative divider line between words
  cv.hl(42,60,195,GD);
  cv.s(60,42,G); cv.s(195,42,G);

  cv.save('ui_logo.png');
}

console.log('✅ All Priority 2 sprites (torch raider, siege raider, warehouse, logo) generated successfully.');
