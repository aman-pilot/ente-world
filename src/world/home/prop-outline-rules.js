// Home only. Classify by authored art identity and rendered size, never placement id.
export function propOutlineKind(prop) {
  const name = `${prop.src.split('/').at(-1)} ${prop.asset ?? ''} ${prop.name ?? ''}`.toLowerCase();
  const w = prop.width * (prop.scale ?? 1), h = prop.height * (prop.scale ?? 1);
  if (/bush|shrub|hedge/.test(name)) return 'solid';
  if (/firefly-glints|shadow|oven-smoke|bunting|banner/.test(name)) return 'decoration';
  if (/bridge|jetty|boardwalk/.test(name)) return 'walkway';
  if (/towel|blanket|rug|puddle|petals?(?:[ ._-]|$)|sand-speck|path-stone/.test(name)) return 'decal';
  if (!/pot|planter|bed|island|rack/.test(name) && /flower|tulip|grass|pebble|shell|rope-coil|rock-flat|mushroom/.test(name) && w <= 145 && h <= 110) return 'decal';
  // Trees, lamps and reeds block their entire drawing, including canopies.
  return 'solid';
}

// Furniture uses a feet clearance, not the full dressed duck silhouette.
// Keep the full body mask for overhead foliage so its canopy cannot hide a duck.
export function propBodyPadding(prop) {
  const art = prop.src.split('/').at(-1).toLowerCase();
  return /(?:^|[-_ ])(?:trees?|oak|birch|willow|pine|canopy|umbrella|parasol|bush|shrub|hedge)(?:[-_. ]|$)/.test(art)
    ? {width:160, height:200} : {width:48, height:0};
}

// String-light poles stand on the ground; their suspended cable is not a wall.
export function propBaseCut(prop, bottom) {
  if((prop.src??'').split('/').at(-1)==='stage.svg')return bottom-Math.min(140,prop.height*(prop.scale??1)*.3);
  return /^lights-(?:back|front|span)\.svg$/.test((prop.src??'').split('/').at(-1))
    ? bottom-Math.min(36,prop.height*(prop.scale??1)*.12) : null;
}
