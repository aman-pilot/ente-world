import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {destinationsFor,sailRoute} from '../src/gameplay/islands.js';

// Bog's three moorings sit 380-620 around its dock point, so with the boat gap the exact point was unreachable and
// "Take me to Booquack Bog" left the boat at Home. Routes now aim for free water beside a walled-in dock.
test('a 5-feather Ducky sails from a Home mooring to Booquack Bog past its moored boats and lands', async () => {
  const room=await makeRoom();
  try {
    const bog=destinationsFor('home').find(d=>d.destination==='isle-249');
    assert.equal(sailRoute('home',{x:3960,y:6100},bog.dock,room.boats.filter(b=>b.islandId==='isle-249')).length>0,true);
    const boat=room.boats.find(b=>b.id==='home-3');
    const p=addPlayer(room,9101,{islandId:'home',x:boat.x,y:boat.y,mode:'sailing'});
    Object.assign(boat,{occupant:p.actor.id});p.actor.boatId=boat.id;
    room.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',p.account,5);room.karma.balances.delete(p.account);
    room.webSocketMessage(p.socket,JSON.stringify({type:'destination',seq:1,x:bog.dock.x,y:bog.dock.y}));
    assert.ok(p.actor.sailTarget,'the server sets a course');
    let landed=false;
    for (let i=0;i<20*120 && !landed;i++) {
      room.step();
      if (p.actor.islandId==='isle-249' && p.actor.mode==='sailing' && !p.actor.sailTarget && !p.sent) {
        p.sent=true; room.webSocketMessage(p.socket,JSON.stringify({type:'disembark',seq:2}));
      }
      landed=p.actor.islandId==='isle-249' && p.actor.mode==='walking';
    }
    assert.ok(landed,'lands on Bog within two minutes');
  } finally {clearInterval(room.timer);room.bog?.dispose();}
});
