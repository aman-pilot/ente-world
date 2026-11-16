// Alpha bounds across all 48 seat-pinned views have a 326-unit diameter. Hulls never touch at
// this gap; at a few angles the tips of two sails may just meet (boss: 350 left too much empty water).
export const BOAT_GAP = 260;
export const boatSeparated = (a,b,gap=BOAT_GAP) => Math.hypot(a.x-b.x,a.y-b.y) >= gap;

// Deterministic nearest-first water search, shared by map creation and live placement.
// Never fall back to an occupied or dry point when the area is full.
export function nearestBoatSpace(origin,clear,reach=1040) {
  if(clear(origin))return {x:origin.x,y:origin.y};
  for(let r=20;r<=reach;r+=20){
    const n=Math.ceil(2*Math.PI*r/20);
    for(let k=0;k<n;k++){
      const a=k*2*Math.PI/n,p={x:Math.round(origin.x+Math.cos(a)*r),y:Math.round(origin.y+Math.sin(a)*r)};
      if(clear(p))return p;
    }
  }
  return null;
}
