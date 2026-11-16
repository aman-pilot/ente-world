import {mapPoint} from '../world/sphere-coordinates.js';
import {nearestSeaX} from '../world/flat-layout.js';
import {WORLD_ISLANDS} from '../world/world-map.js';
import {mapOf} from '../world/island-maps.js';
import {BOG_RADAR_ISLAND, placeBogRadar} from '../features/bog-combat/bog-radar.js';

export const NEARBY_MAP_WIDTH = 10000;
export const NEARBY_MAP_HEIGHT = NEARBY_MAP_WIDTH;

export function nearbyMapFrame(islandId, point, bogRadar, radarRadius = NEARBY_MAP_WIDTH / 2) {
  return WORLD_ISLANDS.map(island=>{const m=mapOf(island.id),c=mapPoint(island.id,islandId,{x:m.cx,y:m.cy}),q={x:nearestSeaX(c.x,point.x)-point.x,y:c.y-point.y};   // the short way round the wrapping sea
    if (bogRadar && island.id === BOG_RADAR_ISLAND) placeBogRadar(bogRadar,islandId,q.x,q.y,radarRadius);
    return {id:island.id,...q,bearing:0};})
    .sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y)).slice(0,3);
}

// Friends relative to you (map units, the short way round the sea). Ones further than radius sit on the rim,
// with a bearing so the map can point an arrow their way.
export function nearbyFriends(islandId, point, friends, radius = NEARBY_MAP_WIDTH / 2) {
  if (!point) return [];
  return friends.flatMap(friend => {
    let p;
    try {p = mapPoint(friend.islandId, islandId, {x: friend.x, y: friend.y});} catch {return [];}
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return [];
    const x = nearestSeaX(p.x, point.x) - point.x, y = p.y - point.y, d = Math.hypot(x, y);
    const rim = d > radius * .92, k = rim ? radius * .9 / d : 1;
    return [{accountId: friend.accountId, login: friend.login, x: x * k, y: y * k, rim, bearing: Math.atan2(x, -y) * 180 / Math.PI}];
  });
}

export function nearbyHeading(id,p,dx,dy){return Math.atan2(dx,-dy)*180/Math.PI;}
