import assert from 'node:assert/strict';
import test from 'node:test';
import {visiblePlayerMarkers} from '../src/rendering/shared/player-markers.js';

const candidate=(id,face=1,x=50,alpha=1)=>({player:{id},p:{x,y:50,face},alpha});
test('globe caps visible live players at four including your own duck',()=>{
  const players=Array.from({length:10},(_,id)=>candidate(id));
  assert.equal(visiblePlayerMarkers(players,{width:100,height:100}).length,4);
  assert.equal(visiblePlayerMarkers(players,{width:100,height:100,ownVisible:true}).length,3);
});
test('hidden and off-screen players do not consume slots; front-facing players win',()=>{
  const players=[candidate('hidden',1,50,0),candidate('outside',1,101),candidate('b',.5),candidate('a',.5),candidate('front',.9)];
  assert.deepEqual(visiblePlayerMarkers(players,{width:100,height:100}).map(({player})=>player.id),['front','a','b']);
});
