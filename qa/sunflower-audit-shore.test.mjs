import test from 'node:test';
import assert from 'node:assert/strict';
import {mapOf,prepareIslandMap} from '../src/world/island-maps.js';
test('Sunbob shore helper keeps valid fractional ground when integer rounding falls off the coast',async()=>{
 await prepareIslandMap('blossom');const m=mapOf('blossom'),n=m.nav();
 for(const i of [0,4]){const b=m.boatSpots()[i],p=m.shoreFor(b.x,b.y);assert.ok(p);assert.ok(n.walkable(p.x,p.y),`boat ${i} shore is exact valid ground`);const route=n.route(m.spawn.x,m.spawn.y,p.x,p.y);assert.ok(route.length);assert.ok(Math.hypot(route.at(-1)[0]-p.x,route.at(-1)[1]-p.y)<2);}
});
