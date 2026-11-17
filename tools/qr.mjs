// Minimal QR Code encoder (byte mode, error correction level M, versions 1-10).
// No dependencies. Follows ISO/IEC 18004; structure after Project Nayuki's reference encoder.
// Returns an inline SVG string. Enough for short URLs like https://voicejudge.app/c/K3.

// [ecCodewordsPerBlock, [blocks, dataCodewordsPerBlock], ...] for level M
const M_TABLE = {
  1: [10, [1, 16]],
  2: [16, [1, 28]],
  3: [26, [1, 44]],
  4: [18, [2, 32]],
  5: [24, [2, 43]],
  6: [16, [4, 27]],
  7: [18, [4, 31]],
  8: [22, [2, 38], [2, 39]],
  9: [22, [3, 36], [2, 37]],
  10: [26, [4, 43], [1, 44]],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

// ---- GF(256) Reed-Solomon ----
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}
function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
  }
  return result;
}

function dataCapacity(v) {
  const [, ...groups] = M_TABLE[v];
  return groups.reduce((s, [n, k]) => s + n * k, 0);
}

function encodeData(bytes, version) {
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const capBits = dataCapacity(version) * 8;
  put(0, Math.min(4, capBits - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  return out;
}

function addEcc(data, version) {
  const [ecLen, ...groups] = M_TABLE[version];
  const blocks = [];
  let k = 0;
  for (const [n, len] of groups) for (let i = 0; i < n; i++) { blocks.push(data.slice(k, k + len)); k += len; }
  const div = rsDivisor(ecLen);
  const ecc = blocks.map((b) => rsRemainder(b, div));
  const out = [];
  const maxLen = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxLen; i++) blocks.forEach((b) => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ecLen; i++) ecc.forEach((e) => out.push(e[i]));
  return out;
}

function buildMatrix(codewords, version, mask) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[version];
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  // format bits (level M = 0b00)
  const fdata = (0 << 3) | mask;
  let rem = fdata;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fbits = ((fdata << 10) | rem) ^ 0x5412;
  const fb = (i) => ((fbits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, fb(i));
  set(8, 7, fb(6)); set(8, 8, fb(7)); set(7, 8, fb(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, fb(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, fb(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, fb(i));
  set(8, size - 8, true);

  if (version >= 7) {
    let r = version;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const vbits = (version << 12) | r;
    for (let i = 0; i < 18; i++) {
      const bit = ((vbits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, bit); set(b, a, bit);
    }
  }

  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vert : vert;
      if (!fn[y][x] && i < codewords.length * 8) {
        m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
        i++;
      }
    }
  }

  const maskFn = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ][mask];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn(x, y)) m[y][x] = !m[y][x];
  return m;
}

function penalty(m) {
  const size = m.length;
  let p = 0;
  for (let pass = 0; pass < 2; pass++) for (let a = 0; a < size; a++) {
    let run = 1;
    for (let b = 1; b < size; b++) {
      const cur = pass ? m[b][a] : m[a][b], prev = pass ? m[b - 1][a] : m[a][b - 1];
      if (cur === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  let dark = 0;
  m.forEach((row) => row.forEach((c) => { if (c) dark++; }));
  p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return p;
}

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 1;
  while (version <= 10 && 4 + (version < 10 ? 8 : 16) + bytes.length * 8 > dataCapacity(version) * 8) version++;
  if (version > 10) throw new Error('QR text too long');
  const codewords = addEcc(encodeData(bytes, version), version);
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const mtx = buildMatrix(codewords, version, mask);
    const p = penalty(mtx);
    if (p < bestP) { bestP = p; best = mtx; }
  }
  return best;
}

export function qrSvg(text, { label = 'QR code', fg = '#07081A', bg = '#FFFFFF' } = {}) {
  const m = qrMatrix(text);
  const quiet = 4, n = m.length + quiet * 2;
  let d = '';
  m.forEach((row, y) => row.forEach((c, x) => { if (c) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="${n}" height="${n}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
