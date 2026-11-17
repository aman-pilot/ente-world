import {compactContours} from '../../../assets/world/island-geometry.mjs';
import {propOutlineKind,propBaseCut} from '../home/prop-outline-rules.js';
export const bodyMaskKey = p => JSON.stringify([p.src,p.width*(p.scale??1),p.height*(p.scale??1),Boolean(p.flip)]);
// Factories live outside the rule closure so a projected prop cannot retain
// the decoded silhouettes/body-mask dictionary through its lexical parent.
const projectSilhouette=(x,y,flip,ax,ay,w,h)=>(u,v)=>[x+(flip?ax-u:u-ax)*w,y+(v-ay)*h];
const projectBody=(px,py,flip,ax,ay,width,height,scale,pixelMasks)=>(x,y)=>pixelMasks?[px+(x/256+(flip?ax:-ax))*width*scale,py+(y/256-ay)*height*scale]:[px+x,py+y];
export function createPropOutlines(silhouettes,bodyMasks,{pixelMasks=true}={}) {
// Opaque SVG silhouettes, normalized to the authored view box. Blocking the
// projected roof as well as the walls prevents a Ducky disappearing beneath it.
// Clearance is applied once by shared geometry, as distance to these contours.
// One raster pixel covers simplification error; it is not a second body pad.
function buildingFootprint(prop) {
  const kind = propOutlineKind(prop);
  if (kind !== 'solid') return null;
  const contours = silhouettes[prop.src];
  if (!contours) return null;
  const outline = contours.flat();
  const w = prop.width * (prop.scale ?? 1), h = prop.height * (prop.scale ?? 1);
  if (prop.spinPeriod) {
    const radius = Math.max(...outline.map(([u,v]) => Math.hypot((u-prop.anchor.x)*w,(v-prop.anchor.y)*h)));
    // Circumscribe the full animated sweep, not only the initial blade pose.
    const r = radius / Math.cos(Math.PI/32);
    return {prop: prop.id, ...(pixelMasks?{name:prop.id}:{}), building: true, clearance: 22, poly: Array.from({length:32},(_,i) => [prop.x+r*Math.cos(i*Math.PI/16),prop.y+r*Math.sin(i*Math.PI/16)])};
  }
  const rings = contours.map(ring => ring.map(([u,v]) => [
    prop.x + (prop.flip ? prop.anchor.x - u : u - prop.anchor.x) * w,
    prop.y + (v - prop.anchor.y) * h,
  ]));
  const cut=propBaseCut(prop,Math.max(...rings.flat().map(p=>p[1])));
  if(cut!==null){
    const clipped=rings.map(r=>r.flatMap((a,i)=>{const b=r[(i+1)%r.length],out=a[1]>=cut?[a]:[];
      if((a[1]>=cut)!==(b[1]>=cut))out.push([a[0]+(b[0]-a[0])*(cut-a[1])/(b[1]-a[1]),cut]);return out;})).filter(r=>r.length>=3);
    return compactContours({prop:prop.id,...(pixelMasks?{name:prop.id}:{}),building:true,propBase:true,clearance:22+Math.max(w,h)/256,
      poly:clipped[0],...(clipped.length>1?{parts:clipped.slice(1)}:{})});
  }
  const {x,y,flip,anchor:{x:ax,y:ay}}=prop;
  return compactContours({prop: prop.id, ...(pixelMasks?{name:prop.id}:{}), building: true, clearance: 22 + Math.max(w,h) / 256,
    poly: rings[0], ...(rings.length > 1 ? {parts: rings.slice(1)} : {})},contours,
    projectSilhouette(x,y,flip,ax,ay,w,h));
}

function solidBuilding(prop) {
  const footprint = buildingFootprint(prop);
  const outlineKind = propOutlineKind(prop);
  if (!footprint) {
    if (outlineKind === 'solid') throw Error(`Missing prop outline: ${prop.src}`);
    const {footprint: oldFootprint, ...rest} = prop;
    return {...rest, outlineKind, z: -100000, sortY: -100000};
  }
  // Sort at the front of the solid, including overhangs extending below its
  // anchor. A Ducky on the approach is in front; one above the roof is behind.
  const sortY = Math.max(...[footprint.poly, ...(footprint.parts ?? [])].flat().map(p => p[1]));
  const rings=bodyMasks[pixelMasks?bodyMaskKey(prop):prop.id]?.map(r=>r.map(([x,y])=>pixelMasks?[prop.x+(x/256+(prop.flip?prop.anchor.x:-prop.anchor.x))*prop.width*(prop.scale??1),prop.y+(y/256-prop.anchor.y)*prop.height*(prop.scale??1)]:[prop.x+x,prop.y+y]));
  const {x:px,y:py,flip,anchor:{x:ax,y:ay},width,height,scale=1}=prop;
  const bodyFootprint=rings?compactContours({prop:prop.id,...(pixelMasks?{name:prop.id}:{}),building:true,bodyBlock:true,clearance:0,poly:rings[0],...(rings.length>1?{parts:rings.slice(1)}:{})},bodyMasks[pixelMasks?bodyMaskKey(prop):prop.id],
    projectBody(px,py,flip,ax,ay,width,height,scale,pixelMasks)):null;
  return {...prop, outlineKind, footprint, bodyFootprint, z: sortY, sortY};
}

return {buildingFootprint,solidBuilding};
}
