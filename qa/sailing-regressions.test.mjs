import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PixiIsland} from './helpers/pixi-engine.mjs';
import {neighboursOf} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {SEA_WIDTH} from '../src/world/flat-layout.js';
import {unplaceRigid} from '../src/world/rigid.js';
import {tileInView} from '../src/rendering/pixi/art/ground-stream.js';
import {destinationsFor,harborOf,setSailDestination,sailStep,boatRoom,canSail,BOAT_GAP} from '../src/gameplay/islands.js';
import {makeRoom,addPlayer} from './room-harness.mjs';

test('Take me to resumes its sailing leg after opening and closing the globe',()=>{
 const player={mode:'sailing',islandId:'home',x:5000,y:9000,sailTarget:{x:8000,y:9000}};
 const game=Object.assign(Object.create(PixiIsland.prototype),{room:{player,stopInput(){player.sailTarget=null;},view:()=>player},
  islandId:'home',trip:{target:'blossom',leg:'home',stoppedAt:{x:5000,y:9000},idleSince:0},
  archipelago:{},worldView:{},camera:{zoom:.2},target:{},zoomMotion:{velocity:0},keys:new Set(),gestures:{clear(){}},
  mapHere:()=>mapOf('home'),birdZoom:()=>.01,zoomFloor:()=>.01,zoomCeiling:()=>2,
  setDestination(point){player.sailTarget=point;return [point.x,point.y];}});
 assert(game.openGlobe());assert(game.trip);game.stepTrip();assert.equal(player.sailTarget,null);
 assert(game.closeGlobe());game.stepTrip();assert.equal(game.trip.leg,'home');assert(player.sailTarget);
 assert.equal(game.follow,true);
 assert(game.openGlobe());game.globeT=1;game.worldView.pinAt=()=>true;
 game.tap({x:0,y:0});assert(game.trip,'closing via the globe pin preserves the trip');
 game.stepTrip();assert(player.sailTarget);
});

test('Pagepond and Rosybutton autopilot routes sail across the seam in both directions',()=>{
 for(const [from,to,direction]of [['isle-251','sunset',1],['sunset','isle-251',-1]]){
  assert(neighboursOf(from).some(n=>n.island.id===to));
  const h=harborOf(from),actor={islandId:from,mode:'sailing',...h.water,path:[],action:0};
  const d=destinationsFor(from).find(d=>d.destination===to);assert(d);
  assert(setSailDestination(actor,d.dock.x,d.dock.y));
  const end=actor.sailRoute.at(-1)??actor.sailTarget;
  assert.equal(Math.sign(end.x-actor.x),direction);
  assert(Math.abs(end.x-actor.x)<SEA_WIDTH/2);
  for(let k=0;k<4000&&actor.sailTarget;k++)sailStep(actor,.05,{x:0,y:0});
  assert.equal(actor.sailTarget,null);assert(Math.abs(actor.x-end.x)<1);
 }
});

test('refused Bog landing leaves a 600-unit escape apron and preserves boat gaps',async()=>{
 const room=await makeRoom();
 try{
  for(const from of ['isle-249','isle-251']){
   const point=from==='isle-249'?harborOf(from).water:destinationsFor(from).find(d=>d.destination==='isle-249').dock;
   const p=addPlayer(room,from==='isle-249'?9901:9902,{islandId:from,...point,mode:'sailing'});
   const boat=room.boats.find(b=>b.islandId===from&&!b.occupant);Object.assign(boat,point,{occupant:p.actor.id});p.actor.boatId=boat.id;
   const info=room.connections.get(p.socket);assert.equal(room.allowLanding(p.socket,info,'isle-249'),false);
   assert(boatRoom(p.actor,room.boats));assert.equal(p.actor.mode,'sailing');assert.deepEqual([boat.x,boat.y],[p.actor.x,p.actor.y]);
   for(const [x,y]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const a={...p.actor,path:[]};for(let k=0;k<20;k++)sailStep(a,.05,{x,y},null,room.boats);
    assert(Math.hypot(a.x-p.actor.x,a.y-p.actor.y)>500);assert(boatRoom(a,room.boats));assert(canSail(a.x,a.y,from));
   }
  }
  assert.equal(BOAT_GAP,350);
 }finally{clearInterval(room.timer);room.bog?.dispose();}
});

test('travel refusal notice expires and cleans up its timer',()=>{
 const source=readFileSync(new URL('../src/app/PixiPage.jsx',import.meta.url),'utf8');
 const match=source.match(/useEffect\(\(\) => \{\s*if \(!travelNotice\) return;([\s\S]*?)\},\[travelNotice\]\)/);assert(match);
 let callback,delay,cleared,notice='Bog refusal';
 const cleanup=new Function('setTimeout','clearTimeout','setTravelNotice',match[1])((fn,ms)=>{callback=fn;delay=ms;return 42;},id=>cleared=id,value=>notice=value);
 assert.equal(delay,5000);callback();assert.equal(notice,'');cleanup();assert.equal(cleared,42);
});

test('Home ground culling returns to authored tile coordinates after repeated laps',()=>{
 const m=mapOf('home'),tile={x:m.cx-100,y:m.cy-100,width:200,height:200};
 for(const winding of [-2,-1,0,1,2]){
  const camera={x:m.cx+winding*SEA_WIDTH,y:m.cy,zoom:.19};
  const local={...camera,...unplaceRigid('home','home',camera)};
  assert(tileInView(tile,local,1440,900));
 }
 const source=readFileSync(new URL('../src/rendering/pixi/engine.js',import.meta.url),'utf8');
 assert(source.includes('unplaceRigid(this.islandId,this.islandId,this.camera)'));
});
