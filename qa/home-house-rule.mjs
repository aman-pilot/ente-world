// Independent reference for the Home-only house exception in collision audits.
export function homeHouseCut(p) {
  const f = p.footprint ?? p;
  if (!f.poly) return null;
  const name = `${f.prop ?? ''} ${f.name ?? ''} ${f.id ?? ''}`;
  if (!/house|cottage|bakery|cafe|shop|lodge|studio|hall|greenhouse/i.test(name) || /lighthouse|lamp|sign|shadow/i.test(name)) return null;
  const ys = [f.poly, ...(f.parts ?? [])].flat().map(q => q[1]);
  const bottom = Math.max(...ys);
  return bottom - Math.min(140, Math.max(36, (bottom - Math.min(...ys)) * .3));
}

// Independent extension reference. Furniture named after its neighbourhood is
// still solid, as are bird shelters, pools, stages and the cafe ring benches.
export function islandHouseCut(p) {
  const f=p.footprint??p, name=`${f.prop??''} ${f.name??''} ${f.id??''}`;
  if (/birdhouse|bench|bookshelf|chair|table|rack|stool|hanging-lantern|paper-rolls|woodpile|mailbox|lectern|books-hall|candy-cart|pink-arc-cafe|pool|stage/i.test(name)) return null;
  return homeHouseCut(p);
}
