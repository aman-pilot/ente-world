import assert from 'node:assert/strict';
import {mapOf,prepareIslandMap} from '../../src/world/island-maps.js';
export async function assertReachable(id,points){
 await prepareIslandMap(id);const m=mapOf(id),nav=m.nav(),spawn=[m.spawn.x,m.spawn.y];
 for(const [name,x,y] of points){
  assert.ok(nav.walkable(x,y),`${name}: open ground at ${x},${y}`);
  for(const [from,to] of [[spawn,[x,y]],[[x,y],spawn]]){
   const path=nav.route(...from,...to);
   assert.ok(path.length,`${name}: route ${from} -> ${to}`);
   assert.ok(Math.hypot(path.at(-1)[0]-to[0],path.at(-1)[1]-to[1])<2,`${name}: reaches requested ground`);
   let prev=from;for(const next of path){assert.ok(nav.clearLine(prev,next),`${name}: collision-free route segment`);prev=next;}
  }
 }
}
