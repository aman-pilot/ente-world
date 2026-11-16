import test from 'node:test';
import assert from 'node:assert/strict';
import {SEA_WIDTH,SEA_HEIGHT,FLAT_RING,FLAT_POSITIONS,wrapSea} from '../src/world/flat-layout.js';
import {WORLD_ISLANDS,neighboursOf} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {flatRigid,placeRigid} from '../src/world/rigid.js';
import {mapPoint,copyTransform} from '../src/world/sphere-coordinates.js';
import {ISLETS} from '../src/world/islets.js';
import {placeIslet,isletPlacement} from '../src/world/islet-placement.js';
import {isletHull,flatRingGap} from '../src/world/islet-shores.js';
import {coastPolygons} from '../src/world/island-coasts.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('flat sea is the unchanged globe equirectangular chart',()=>{
 close(SEA_WIDTH,80000);close(SEA_HEIGHT,40000);
 for(const i of WORLD_ISLANDS){close(FLAT_POSITIONS[i.id].x,i.lon*SEA_WIDTH/(2*Math.PI));close(FLAT_POSITIONS[i.id].y,-i.lat*SEA_WIDTH/(2*Math.PI));}
 for(const [k,id]of FLAT_RING.entries()){
  const expected=new Set(['home',FLAT_RING[(k+5)%6],FLAT_RING[(k+1)%6]]);
  if(id==='isle-251')expected.add('sunset');
  if(id==='sunset')expected.add('isle-251');
  assert.deepEqual(new Set(neighboursOf(id).map(n=>n.island.id)),expected);
 }
 assert.deepEqual(new Set(neighboursOf('home').map(n=>n.island.id)),new Set(FLAT_RING));
});
test('all gameplay frame mappings compose as pure translation, independent of map centres',()=>{
 for(const a of WORLD_ISLANDS)for(const b of WORLD_ISLANDS){
  const r=flatRigid(a.id,b.id),t=copyTransform(a.id,b.id),m=mapOf(b.id),p={x:m.cx+123,y:m.cy-456};
  assert.deepEqual([r.a,r.b,r.c,r.d],[1,0,0,1]);assert.deepEqual(t,{a:1,b:0,c:0,d:1,x:r.x,y:r.y});
  const q=mapPoint(b.id,a.id,p),drawn=placeRigid(a.id,b.id,p);close(q.x,drawn.x);close(q.y,drawn.y);
  const viaHome=mapPoint('home',a.id,mapPoint(b.id,'home',p));close(q.x,viaHome.x);close(q.y,viaHome.y);
 }
});
test('all six upright islets clear periodic coasts and each other',()=>{
 const hull=i=>isletHull(i).map(p=>{const q=placeIslet('home',i,p);return [q.x,q.y];});
 for(const [k,i]of ISLETS.entries()){
  const h=hull(i),r=isletPlacement('home',i);assert.equal(r.cos,1);assert.equal(r.sin,0);
  for(const island of WORLD_ISLANDS){
   const m=mapOf(island.id);
   for(const coast of coastPolygons(m.world,m.walk)){
    const ring=coast.map(([x,y])=>{const q=placeRigid('home',island.id,{x,y},r);return [q.x,q.y];});
    assert.ok(flatRingGap(h,ring,600)>=600,`${i.id}/${island.id} shore margin`);
   }
  }
  for(const other of ISLETS.slice(0,k))assert.ok(flatRingGap(h,hull(other),600)>=600,`${i.id}/${other.id} separation`);
 }
});
