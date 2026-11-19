import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomClient} from '../src/multiplayer/room-client.js';
import {ISLANDS,BOAT_GAP,PARKING_GAP,BOARDING_REACH,boatRoom,createBoats,boatSpots,boardingPoint,parkFleetBoat,canSail,navOf} from '../src/gameplay/islands.js';
import {mapOf} from '../src/world/island-maps.js';
import {unplaceRigid,seaCentreY} from '../src/world/rigid.js';
import {seaViewPose} from '../src/world/sea-view.js';
import {SEA_WIDTH,SEA_HEIGHT} from '../src/world/flat-layout.js';
import {makeRoom,addPlayer} from './room-harness.mjs';

function clientSnapshot(actor,boats){
  const room=new RoomClient(()=>{},()=>{},()=>{},()=>{},()=>{});
  room.id=actor.id;
  room.configure(navOf(actor.islandId),{width:5800,height:4400});
  room.snapshot({epoch:'boat-geometry',tick:1,online:1,islandId:actor.islandId,players:[actor],
    self:{ack:0,path:[],emoteLeft:0},boats:boats.map(b=>seaViewPose(actor,b))});
  return room;
}

test('real room snapshots preserve server collision distances across every island pair',()=>{
  for(const from of ISLANDS)for(const to of ISLANDS){
    const m=mapOf(from.id),actor={id:'rider',boatId:'mine',islandId:from.id,mode:'sailing',x:m.cx,y:m.cy+8000,turn:0,action:0,travel:0};
    const other={id:'other',islandId:to.id,...unplaceRigid(from.id,to.id,{x:actor.x+BOAT_GAP-20,y:actor.y}),occupant:null};
    const room=clientSnapshot(actor,[other]);
    try{
      assert.equal(boatRoom(room.player,room.boats),boatRoom(actor,[other]),`${from.id} / ${to.id}`);
      assert.equal(boatRoom(room.player,room.boats),false,'contact is inside the hull gap');
      const drawn=room.boatPoses()[0],wire=seaViewPose(actor,other);
      assert.ok(Math.hypot(drawn.x-wire.x,drawn.y-wire.y)<1e-7,'physics normalization never shifts rendered boats');
    }finally{room.dispose();}
  }
});

test('collision geometry survives wrapped and reflected viewer charts',()=>{
  for(const winding of [-2,0,2])for(const reflected of [false,true]){
    const actor={id:'rider',boatId:'mine',islandId:'home',mode:'sailing',x:3000+winding*SEA_WIDTH,y:11000,turn:0,action:0,travel:0};
    if(reflected){actor.x+=SEA_WIDTH/2;actor.y=2*seaCentreY('home')+SEA_HEIGHT-actor.y;}
    const other={id:'other',islandId:'blossom',...unplaceRigid('home','blossom',{x:3000+BOAT_GAP-20,y:11000}),occupant:null};
    const wire=seaViewPose(actor,other),room=clientSnapshot(actor,[other]);
    try{
      assert.equal(boatRoom(room.player,room.boats),false);
      assert.deepEqual(room.boatPoses().map(b=>[b.x,b.y]),[[wire.x,wire.y]]);
    }finally{room.dispose();}
  }
});

test('return to boat cannot select a saved arrival boat owned by another island',()=>{
  const actor={id:'walker',islandId:'home',mode:'walking',x:3000,y:11000,turn:0,action:0,travel:0};
  const boats=[{id:'local',islandId:'home',x:3100,y:11000,occupant:null},
    {id:'foreign',islandId:'blossom',...unplaceRigid('home','blossom',{x:3001,y:11000}),occupant:null}];
  const room=clientSnapshot(actor,boats);let selected;
  try{
    room.arrivalBoatId='foreign';room.board=id=>{selected=id;return true;};
    assert.equal(room.returnToBoat(),true);
    assert.equal(selected,'local');
  }finally{room.dispose();}
});

test('the authoritative sea mover collides with parked boats owned by an island',async t=>{
  const room=await makeRoom();t.after(()=>clearInterval(room.timer));
  const {actor,socket}=addPlayer(room,9970,{islandId:'home',mode:'sailing',x:3000,y:11000});
  actor.boatId='mine';room.boats=[{id:'mine',islandId:'home',x:actor.x,y:actor.y,occupant:actor.id}];
  const other={id:'remote-parked',islandId:'blossom',...unplaceRigid('home','blossom',{x:actor.x+BOAT_GAP+10,y:actor.y}),occupant:null};
  room.remoteBoats=[other];const info=room.connections.get(socket);info.input={x:1,y:0};info.inputExpires=Date.now()+60000;
  for(let k=0;k<20;k++){
    room.stepMovement(Date.now());
    assert.ok(boatRoom(actor,[...room.boats,...room.remoteBoats]),'server never sails through the parked hull');
  }
  assert.ok(actor.x<3010,'head-on contact stops before the other boat');
  const x=actor.x;info.input={x:-1,y:0};room.stepMovement(Date.now());assert.ok(actor.x<x,'backing away still works');
});

function crowdedShore(){
  const spot=boatSpots('home')[0],boat={id:'arriving',islandId:'home',...spot,occupant:'rider'},landing=boardingPoint(boat);
  const others=[];
  for(let x=-900;x<=900;x+=150)for(let y=-900;y<=900;y+=150){
    const p={x:boat.x+x,y:boat.y+y};
    if(canSail(p.x,p.y,'home'))others.push({id:`parked-${x}/${y}`,islandId:'home',...p,occupant:null});
  }
  return {boat,landing,others};
}

test('a full parking search fails atomically without releasing or overlapping the arriving boat',()=>{
  const {boat,landing,others}=crowdedShore(),before=structuredClone(boat);
  assert.equal(parkFleetBoat(boat,[boat,...others],Date.now(),landing),false);
  assert.deepEqual(boat,before,'failed parking cannot release its sailor or change its saved state');
});

test('a full shore keeps the real room sailor aboard and reports the refusal without closing the socket',async t=>{
  const room=await makeRoom();t.after(()=>clearInterval(room.timer));
  const {boat,landing,others}=crowdedShore();
  const {actor,socket}=addPlayer(room,9971,{islandId:'home',mode:'sailing',x:boat.x,y:boat.y});
  actor.boatId=boat.id;boat.occupant=actor.id;room.boats=[boat,...others];
  const info=room.connections.get(socket);info.landing={...landing,islandId:'home',approach:{x:actor.x,y:actor.y}};
  room.stepMovement(Date.now());
  assert.equal(actor.mode,'sailing');assert.equal(actor.boatId,boat.id);assert.equal(boat.occupant,actor.id);
  assert.equal(socket.readyState,1,'a full shore does not disconnect the player');
  assert.ok(socket.notes.some(n=>n.type==='travel-notice'&&/No room/.test(n.text)));
  assert.ok(!socket.notes.some(n=>n.type==='transfer'||n.type==='role'));
  assert.equal(info.landing,null);
});

test('all 93 authored approaches allow shore-close parking and immediate reboarding',()=>{
  const boats=createBoats();assert.equal(boats.length,93);
  for(const original of boats){
    const boat={...original,occupant:'rider'},landing=boardingPoint(boat),nav=navOf(boat.islandId);
    assert.equal(parkFleetBoat(boat,[boat],1,landing),true,boat.id);
    assert.ok(Math.hypot(boat.x-landing.x,boat.y-landing.y)<=BOARDING_REACH+1,boat.id+' stays near its shore');
    assert.ok(canSail(boat.x,boat.y,boat.islandId),boat.id+' stays afloat');
    assert.ok(nav.walkable(landing.x,landing.y));assert.deepEqual(boardingPoint(boat,nav),landing);
    assert.equal(boat.occupant,null);
  }
});

test('successive parked boats leave space between hulls and full shores refuse additional parking',()=>{
  const original=boatSpots('home')[4],landing=boardingPoint({...original,islandId:'home'}),boats=[];
  for(let k=0;k<8;k++){
    const boat={id:`visitor-${k}`,islandId:'home',...original,occupant:`rider-${k}`},before=structuredClone(boat);
    if(!parkFleetBoat(boat,[...boats,boat],k,landing)){assert.deepEqual(boat,before);continue;}
    for(const other of boats)assert.ok(Math.hypot(boat.x-other.x,boat.y-other.y)>=PARKING_GAP,'parked hulls leave a visual gap');
    boats.push(boat);
  }
  assert.ok(boats.length>0&&boats.length<8,'a crowded landing is not filled with overlapping visitors');
});

test('every public berth can board, dock and reboard through real room commands',async t=>{
  const room=await makeRoom();t.after(()=>clearInterval(room.timer));
  const {actor,socket,account}=addPlayer(room,9972);
  const info=room.connections.get(socket);let seq=0;
  for(const original of createBoats()){
    clearInterval(room.timer);room.timer=null;
    room.boats=createBoats();const boat=room.boats.find(b=>b.id===original.id);
    const shore=boardingPoint(boat,room.navFor(boat.islandId));
    Object.assign(actor,{...shore,islandId:boat.islandId,mode:'walking',boatId:null,path:[],travel:0,until:0});
    Object.assign(info,{islandId:boat.islandId,input:{x:0,y:0},boarding:null,landing:null,tokens:300});
    room.karma.balances.set(account,20);
    room.webSocketMessage(socket,JSON.stringify({type:'board',seq:++seq,boatId:boat.id}));
    room.stepMovement(Date.now());
    assert.equal(actor.mode,'sailing',`${boat.id}: taking`);
    assert.equal(boat.occupant,actor.id);
    room.webSocketMessage(socket,JSON.stringify({type:'disembark',seq:++seq}));
    for(let k=0;k<800&&actor.mode==='sailing';k++)room.stepMovement(Date.now());
    assert.equal(actor.mode,'walking',`${boat.id}: docking`);
    assert.equal(boat.occupant,null);
    assert.ok(room.navFor(actor.islandId).walkable(actor.x,actor.y));
    assert.ok(Math.hypot(actor.x-boat.x,actor.y-boat.y)<=BOARDING_REACH+1,`${boat.id}: shore distance`);
    room.webSocketMessage(socket,JSON.stringify({type:'board',seq:++seq,boatId:boat.id}));
    for(let k=0;k<100&&actor.mode==='walking';k++)room.stepMovement(Date.now());
    assert.equal(actor.mode,'sailing',`${boat.id}: taking again`);
    assert.equal(socket.readyState,1);
  }
});
