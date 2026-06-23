// Generates the PWA icons (no external deps — hand-rolled PNG via zlib).
// Teal full-bleed background + white medical cross. Maskable-safe.
//   node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function pngFromRGBA(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // rows with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const teal = [15, 118, 110, 255];
  const white = [255, 255, 255, 255];
  const buf = Buffer.alloc(size * size * 4);

  const barT = size * 0.38; // cross arm thickness region
  const barB = size * 0.62;
  const armT = size * 0.17; // cross arm length region
  const armB = size * 0.83;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const vBar = x >= barT && x <= barB && y >= armT && y <= armB;
      const hBar = y >= barT && y <= barB && x >= armT && x <= armB;
      const c = vBar || hBar ? white : teal;
      const i = (y * size + x) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
    }
  }
  return pngFromRGBA(size, size, buf);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), makeIcon(size));
  console.log(`wrote public/icon-${size}.png`);
}
// apple-touch-icon (180) reuses the 192 art at 180px
writeFileSync(new URL(`../public/apple-touch-icon.png`, import.meta.url), makeIcon(180));
console.log("wrote public/apple-touch-icon.png");
