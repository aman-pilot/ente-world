// Keep authored home moorings stable when tuning live sailing contact.
export const BOAT_GAP = 260;
// Shared by client prediction and the server; half the previous live clearance.
export const MOVING_BOAT_GAP = 130;
export const boatSeparated = (a,b,gap=BOAT_GAP) => Math.hypot(a.x-b.x,a.y-b.y) >= gap;

// Deterministic nearest-first water search, shared by map creation and live placement.
// Never fall back to an occupied or dry point when the area is full.
export function nearestBoatSpace(origin,clear,reach=1040) {
  for (const point of boatSpaceCandidates(origin, reach)) {
    if (clear(point)) return {x:point.x,y:point.y};
  }
  return null;
}

export function* boatSpaceCandidates(origin, reach) {
  yield origin;
  for(let r=20;r<=reach;r+=20){
    const n=Math.ceil(2*Math.PI*r/20);
    for(let k=0;k<n;k++){
      const a=k*2*Math.PI/n;
      yield {x:Math.round(origin.x+Math.cos(a)*r),y:Math.round(origin.y+Math.sin(a)*r)};
    }
  }
}
