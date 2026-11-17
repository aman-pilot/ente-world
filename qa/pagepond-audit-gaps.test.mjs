import test from 'node:test';
import {assertReachable} from './lib/audit-reachability.mjs';
import assert from 'node:assert/strict';
import {mapOf,prepareIslandMap} from '../src/world/island-maps.js';
test('Pagepond bench lane connects in both directions',()=>assertReachable('isle-251',[
 ['PP-01 bench lane west',1504,3344],['PP-01 bench lane east',1728,3376],
]));
test('Pagepond solid body contours leave no valid standing points inside the thirteen sealed pinholes',async()=>{
 await prepareIslandMap('isle-251');const m=mapOf('isle-251'),n=m.nav();
 for(const [name,x,y] of [
 ['PP-02',8800,6832],['PP-03',8688,1104],['PP-04',1872,4064],['PP-05',-288,4688],['PP-06',9072,896],['PP-07',1888,4016],['PP-08',8160,6816],['PP-09',-800,480],['PP-10',9024,1136],['PP-11',2752,3984],['PP-12',1904,4000],['PP-13',-240,4704],['PP-14',5536,4992]]){
  assert.equal(n.walkable(x,y),false,name+' closed consistently inside solid padding');
  const p=n.nearest(x,y,192);assert.ok(p,name+' keeps nearby walking ground');
  const path=n.route(m.spawn.x,m.spawn.y,...p);assert.ok(path.length,name+' adjacent ground remains reachable');
 }
});
