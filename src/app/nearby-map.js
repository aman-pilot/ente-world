import {TELEPORTERS} from '../gameplay/teleport.js';
import {mapPoint} from '../world/sphere-coordinates.js';
import {nearestSeaImage} from '../world/flat-layout.js';
import {flatRigid,seaCentreY} from '../world/rigid.js';
import {WORLD_ISLANDS} from '../world/world-map.js';
import {BOG_RADAR_ISLAND, placeBogRadar} from '../features/bog-combat/bog-radar.js';

export const NEARBY_MAP_WIDTH = 10000;
export const NEARBY_MAP_HEIGHT = NEARBY_MAP_WIDTH;

export function nearbyMapFrame(islandId, point, bogRadar, radarRadius = NEARBY_MAP_WIDTH / 2) {
  return WORLD_ISLANDS.map(island=>{const c=flatRigid(islandId,island.id,point),q={x:c.x-point.x,y:c.y-point.y};
    if (bogRadar && island.id === BOG_RADAR_ISLAND) placeBogRadar(bogRadar,islandId,q.x,q.y,radarRadius);
    return {id:island.id,...q,bearing:0,flip:c.d};})
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
    const image=nearestSeaImage(p.x,p.y,point,seaCentreY(islandId));
    const x=image.x-point.x,y=image.y-point.y,d=Math.hypot(x,y);
    const rim = d > radius * .92, k = rim ? radius * .9 / d : 1;
    return [{accountId: friend.accountId, login: friend.login, x: x * k, y: y * k, rim, bearing: Math.atan2(x, -y) * 180 / Math.PI}];
  });
}

export function nearbyHeading(id,p,dx,dy){return Math.atan2(dx,-dy)*180/Math.PI;}

export function nearbyOffMapTeleporterBearing(islandId, player, unlocked, radius = NEARBY_MAP_WIDTH / 2) {
  const machine = TELEPORTERS.get(islandId);
  if (!player || !unlocked || !machine) return null;
  const image = nearestSeaImage(machine.x, machine.y, player, seaCentreY(islandId));
  const dx = image.x - player.x, dy = image.y - player.y;
  return Math.hypot(dx, dy) > radius ? nearbyHeading(islandId, player, dx, dy) : null;
}

export function teleporterRimPosition(bearing, radius, bogBadge) {
  const angle = bearing * Math.PI / 180;
  const x = radius * Math.sin(angle), y = -radius * Math.cos(angle);
  if (!bogBadge || Math.hypot(x - bogBadge.x, y - bogBadge.y) >= bogBadge.clearance) return {x, y};

  // Where the badge overlaps the rim, use the nearest clear spot.
  const distance = Math.hypot(bogBadge.x, bogBadge.y);
  if (!distance) return {x, y};
  const badgeAngle = Math.atan2(bogBadge.x, -bogBadge.y);
  const cosine = (radius ** 2 + distance ** 2 - bogBadge.clearance ** 2) / (2 * radius * distance);
  const offset = Math.acos(Math.max(-1, Math.min(1, cosine)));
  const clearAngle = badgeAngle + (Math.sin(angle - badgeAngle) < 0 ? -offset : offset);
  return {x: radius * Math.sin(clearAngle), y: -radius * Math.cos(clearAngle)};
}
