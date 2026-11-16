import test from 'node:test';
import {bogFloorSample} from './bog-wall-layout-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import data from '../src/features/bog-combat/bog-environment.json' with {type:'json'};
import {makeMap} from '../src/world/island-maps.js';
import {BOG_BLOCKERS} from '../src/features/bog-combat/bog-blockers.js';
import {BOG_AREAS} from '../src/features/bog-combat/bog-environment.js';
import {getBogBlockers} from '../src/features/bog-combat/blockers.js';
import {traceShot} from '../src/features/bog-combat/physics.js';
import {createPickupSpots} from '../src/features/bog-combat/pickups.js';

const root='public/pixi-art/themes/bog-arena/';
const art=JSON.parse(fs.readFileSync(root+'art.json'));
const nav=makeMap('bog-landmark-check',data).nav();
const combat=getBogBlockers();
const owner='pass2-landmarks';
const prop=id=>art.props.find(p=>p.id===id);
function reachable(x,y,from=[4200,2800]){
 assert.ok(nav.walkable(x,y),`clear floor ${x},${y}`);
 assert.ok(nav.route(...from,x,y).length,`connected floor ${x},${y}`);
}

test('landmark feet match rendered pieces, walking obstacles and authoritative paint collision',()=>{
 const pieces=art.props.filter(p=>p.coverFootprints&&p.author!=='warzone');
 assert.equal(pieces.length,28);
 for(const p of pieces){
  const feet=BOG_BLOCKERS.filter(b=>b.author===owner&&b.prop===p.id);
  assert.equal(feet.length,p.coverFootprints.length,p.id);
  for(const [i,[x,y,w,h]] of p.coverFootprints.entries()){
   const b=feet[i];
   assert.deepEqual([b.x,b.y,b.width,b.height],[p.x-p.width/2+x,p.y-p.height+y,w,h],b.id);
   assert.ok(!nav.walkable(b.x+w/2,b.y+h/2),b.id+' stops walking');
   const hit=traceShot({x:b.x+w/2,y:b.y-2},{x:b.x+w/2,y:b.y+h+2},combat);
   assert.equal(hit.blocker?.id,b.id,b.id+' stops paint');
  }
 }
 assert.equal(BOG_BLOCKERS.filter(b=>b.author===owner).length,54);
});

const flankSamples={"karma-nw:-520":[1384,2277],"karma-nw:520":[2424,2277],"evil-ne:-520":[5984,2277],"evil-ne:520":[7024,2277],"karma-sw:-520":[1446,6108],"karma-sw:520":[2424,6077],"evil-se:-520":[5984,6077],"evil-se:520":[7024,6077]};

test('four mirrored base pads reach the front gate and both flank exits',()=>{
 for(const id of ['karma-nw','evil-ne','karma-sw','evil-se']){
  const {x,y,pad}=BOG_AREAS[id];
  for(const [dx,dy] of [[0,160],[0,500],[0,520],[-520,420],[520,420]]){
   const [wx,wy]=flankSamples[id+':'+dx]??[x+dx,y+dy];reachable(wx,wy,pad);
  }
  assert.equal(traceShot({x,y:y+370},{x,y:y+490},combat).blocker,null,id+' gate opening');
  const hall=prop(id+'-hall');assert.equal(hall.width,640);assert.equal(hall.height,420);
  assert.equal(prop('label-'+id),undefined,id+' has no name sign');
 }
 assert.deepEqual(createPickupSpots(nav).map(({id,x,y})=>[id,x,y]),[
  ['mid',4200,2280],['site-a',2230,3970],['site-b',6200,3970],['west-lane',2949,4522],['east-lane',5400,2900],
 ]);
});

test('both Mid wings have clear approaches beside three shooting bays with independent piers',()=>{
 for(const id of ['mid-west','mid-east']){
  const p=prop(id),left=p.x-p.width/2;
  assert.ok(!BOG_BLOCKERS.some(b=>b.id===id),id+' no invisible facade');
  for(const dx of [100,250,400]){
   const x=left+dx,y=p.y-18;
   const [wx,wy]=bogFloorSample(id+':'+dx,[x,y]);
   reachable(wx,wy);
   assert.ok(nav.clearLine([wx,wy-55],[wx,wy+55]),id+' uncovered approach');
   assert.equal(traceShot({x,y:y-55},{x,y:y+55},combat).blocker,null,id+' can shoot through bay');
  }
 }
});

test('Site A rail entrances and staggered graveyard lanes retain connected fighting floor',()=>{
 for(const point of [[2060,3328],[1680,3650],[2420,3650],[2050,3840],
  [6350,3735],[6121,3622],[6615,3855],[6350,3950],[6178,3970]])reachable(...point);
 assert.equal(prop('bench-11'),undefined,'the shooting court has no bench');
 for(const p of art.props.filter(p=>p.id.startsWith('site-b-arcade-')))reachable(...bogFloorSample('arcade:'+p.id,[p.x,p.y-25]));
});

test('rear pond shares the runtime bottom anchor and blocks only its painted water',()=>{
 const pond=art.flats.find(p=>p.id==='site-a-rear-pond');
 const water=data.world.water.find(w=>w.id===pond.id);
 assert.deepEqual(pond.anchor,{x:.5,y:1});
 assert.deepEqual(water.poly[0],[pond.x-pond.width/2+27,pond.y-pond.height+109]);
 assert.equal(nav.walkable(pond.x,pond.y-100),false,'painted pond centre');
 reachable(2056,3328);
});
