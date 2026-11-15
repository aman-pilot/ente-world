import sharp from 'sharp';

export const artPath = src => 'public' + (src.startsWith('/') ? src : '/pixi-art/themes/pink/' + src);
const RESOLUTION = 512;
const ALPHA_THRESHOLD = 32;

// Independently sample rendered alpha on a fixed one-unit world lattice.
// Transparent corners and holes, anchors, scale and flips all participate.
export async function propAlphaOracle(props) {
  const sources = new Map();
  for (const p of props) {
    if (sources.has(p.src)) continue;
    const {data, info} = await sharp(artPath(p.src))
      .resize(RESOLUTION, RESOLUTION, {fit: 'fill'})
      .ensureAlpha().raw().toBuffer({resolveWithObject: true});
    sources.set(p.src, {data, channels: info.channels});
  }

  const boxes = new WeakMap();
  function bounds(p) {
    if (boxes.has(p)) return boxes.get(p);
    const w = p.width * (p.scale ?? 1), h = p.height * (p.scale ?? 1);
    const ax = p.anchor?.x ?? 0, ay = p.anchor?.y ?? 0;
    const box = {x0: p.x - (p.flip ? 1 - ax : ax) * w, y0: p.y - ay * h, w, h};
    boxes.set(p, box);
    return box;
  }

  function occupied(p, x, y) {
    const {x0, y0, w, h} = bounds(p);
    let u = (x - x0) / w;
    const v = (y - y0) / h;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    if (p.flip) u = 1 - u;
    const {data, channels} = sources.get(p.src);
    const row = Math.min(RESOLUTION - 1, Math.floor(v * RESOLUTION));
    const col = Math.min(RESOLUTION - 1, Math.floor(u * RESOLUTION));
    return data[(row * RESOLUTION + col) * channels + channels - 1] > ALPHA_THRESHOLD;
  }

  function overlap(a, b, limit = Infinity) {
    const A = bounds(a), B = bounds(b);
    const x0 = Math.ceil(Math.max(A.x0, B.x0) - .5);
    const y0 = Math.ceil(Math.max(A.y0, B.y0) - .5);
    const x1 = Math.ceil(Math.min(A.x0 + A.w, B.x0 + B.w) - .5);
    const y1 = Math.ceil(Math.min(A.y0 + A.h, B.y0 + B.h) - .5);
    let area = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (occupied(a, x + .5, y + .5) && occupied(b, x + .5, y + .5)) {
        if (++area > limit) return area;
      }
    }
    return area;
  }
  return {bounds, occupied, overlap};
}

export const pairKey = (a, b) => [a.id, b.id].sort().join('|');
export function overlapInventory(props, oracle) {
  const result = {};
  for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) {
    const area = oracle.overlap(props[i], props[j]);
    if (area) result[pairKey(props[i], props[j])] = area;
  }
  return result;
}

export function isStructure(p) {
  const name = p.src.split('/').at(-1);
  if (/^(?:flower|tulip-pot|cart-daisy-pot|daisy-basket|rose-basket)|flowerpot/.test(name)) return false;
  return /house|cottage|cafe|workshop|conservatory|stall|gazebo|tower|arch|maypole|sundial|rack|drying-line|birdhouse|dovecote|post|bridge|jetty|dock|fence|swing-set|worktable|potting-bench|music-rack/.test(name);
}
// Decks include the drawn bridges and docks, which are not standing props.
export const overlapDrawings = art => [
  ...art.props,
  ...(art.decks ?? []).map((p, i) => ({...p, id: p.id ?? `deck-${i}`})),
];
