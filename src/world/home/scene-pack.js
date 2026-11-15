// The baked Home scene repeats the same outlines many times (each prop's footprint is also a walk obstacle)
// and the signed-in and watching scenes are mostly the same. Store each repeated value once and point to it.
// Unpacking gives back fresh copies, value for value, so nothing downstream shares or sees a change.
const MIN = 64;
const isRef = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && '$r' in v;

export function packHomeScene(scenes) {
  const counts = new Map();
  const count = v => {
    if (!v || typeof v !== 'object') return;
    const s = JSON.stringify(v);
    if (s.length >= MIN) counts.set(s, (counts.get(s) || 0) + 1);
    for (const k in v) count(v[k]);
  };
  for (const scene of Object.values(scenes)) count(scene);
  const table = [], index = new Map();
  const pack = v => {
    if (!v || typeof v !== 'object') return v;
    const s = JSON.stringify(v);
    if (s.length >= MIN && counts.get(s) > 1) {
      if (!index.has(s)) {table.push(null); index.set(s, table.length - 1); table[table.length - 1] = copy(v);}
      return {$r: index.get(s)};
    }
    return copy(v);
  };
  const copy = v => Array.isArray(v) ? v.map(pack) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pack(x)]));
  const packed = Object.fromEntries(Object.entries(scenes).map(([name, scene]) => [name, pack(scene)]));
  return {packed: 1, table, scenes: packed};
}

export function unpackHomeScene(data, name, fields = null) {
  if (!data.packed) return structuredClone(fields ? Object.fromEntries(fields.map(k=>[k,data[name][k]])) : data[name]);
  const {table} = data;
  const open = v => {
    if (!v || typeof v !== 'object') return v;
    if (isRef(v)) return open(table[v.$r]);
    return Array.isArray(v) ? v.map(open) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, open(x)]));
  };
  return open(fields ? Object.fromEntries(fields.map(k=>[k,data.scenes[name][k]])) : data.scenes[name]);
}
