import test from 'node:test';
import assert from 'node:assert/strict';
import {boatSpots,harborOf,canSail,boardingPoint,createBoats,fillMoorings,retireBoat,sailStep,PARKED_LINGER,navOf} from '../src/gameplay/islands.js';
import {PORT_BOATS,PORT_CLEAR} from '../src/world/island-maps.js';
import {BOAT_GAP} from '../src/gameplay/boat-spacing.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';

test('every island keeps 3 boats at its port and the rest spread around its coast, all boardable', () => {
  for (const {id} of WORLD_ISLANDS) {
    const spots=boatSpots(id), port=harborOf(id).water;
    const atPort=spots.filter(p=>Math.hypot(p.x-port.x,p.y-port.y)<PORT_CLEAR);
    assert.ok(atPort.length<=PORT_BOATS,`${id}: ${atPort.length} boats at the port`);
    assert.ok(spots.length-atPort.length>=5,`${id}: ${spots.length-atPort.length} boats around the island`);
    for (const p of spots) {
      assert.ok(canSail(p.x,p.y,id),`${id} boat at ${p.x},${p.y} floats`);
      const b=boardingPoint({...p,islandId:id});assert.ok(navOf(id).walkable(b.x,b.y),`${id} boat at ${p.x},${p.y} can be boarded`);
    }
  }
});

test('boats left at a port go after a short wait, so a port never piles up (Iceland had 20)', () => {
  const boats=createBoats(), port=harborOf('isle-55').water, count=()=>boats.filter(b=>b.islandId==='isle-55').length;
  const before=count();
  for (let k=0;k<8;k++) boats.push({id:`home-${k%3}~pile${k}`,islandId:'isle-55',x:port.x+(k%4)*300-450,y:port.y+300+Math.floor(k/4)*300,occupant:null,parked:true});
  fillMoorings(boats);
  assert.ok(count()>before,'just-landed boats wait so their Duckies can hop back in');
  for (const b of boats) if (b.parked) b.parkedAt-=PARKED_LINGER;
  fillMoorings(boats);
  assert.equal(count(),before,'after the wait only the island\'s own boats are left');
});

test('a boat squeezed inside another boat\'s gap can still sail away from it', () => {
  const [a]=boatSpots('isle-55');
  const actor={id:'me',boatId:'mine',islandId:'isle-55',x:a.x,y:a.y+300,mode:'sailing',path:[],action:0};
  const other={id:'other',islandId:'isle-55',x:actor.x,y:actor.y+BOAT_GAP-60,occupant:null};
  assert.ok(canSail(actor.x,actor.y,'isle-55'));
  const y0=actor.y;
  for (let i=0;i<5;i++) sailStep(actor,.05,{x:0,y:-1},null,[other]);
  assert.ok(actor.y<y0,'it moves away');
  const d1=other.y-actor.y;
  for (let i=0;i<20;i++) sailStep(actor,.05,{x:0,y:1},null,[other]);
  assert.ok(other.y-actor.y>=Math.min(BOAT_GAP,d1)-1e-6,'and never back inside the gap');
});
