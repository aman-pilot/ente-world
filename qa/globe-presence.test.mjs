import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer,fakeSocket} from './room-harness.mjs';
import {RoomClient} from '../src/multiplayer/room-client.js';
import {BOG_ISLAND} from '../src/features/bog-combat/entry.js';
import {createHeartLocations} from '../src/rendering/shared/heart-activity.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';

test('world presence reaches other islands in snapshots and deltas, excluding spectators',async()=>{
  const room=await makeRoom();
  const home=addPlayer(room,1,{x:1800,y:430});
  const bog=addPlayer(room,2,{islandId:BOG_ISLAND,x:100,y:100});
  const spectator=fakeSocket();room.connections.set(spectator,{islandId:'home'});
  room.connections.get(home.socket).deltas=true;
  room.broadcast();
  const full=JSON.parse(home.socket.last);
  assert.deepEqual(full.islandPresence,{home:1,[BOG_ISLAND]:1});
  assert.equal(full.players.length,1);
  room.connections.delete(bog.socket);room.broadcast();
  assert.deepEqual(home.socket.notes.at(-1).islandPresence,{home:1});
  const client=new RoomClient(()=>{});
  client.snapshot(full);
  assert.deepEqual(client.islandPresence,full.islandPresence);
  client.reset();assert.deepEqual(client.islandPresence,{});
});

test('activity only selects occupied islands and clears departed islands from its pool',()=>{
  const next=createHeartLocations(WORLD_ISLANDS,mapOf);
  assert.equal(next({}),null);
  for(let i=0;i<10;i++)assert.equal(next({home:1}).island.id,'home');
  for(let i=0;i<10;i++)assert.equal(next({[BOG_ISLAND]:2}).island.id,BOG_ISLAND);
  assert.equal(next({home:0,[BOG_ISLAND]:0}),null);
});
