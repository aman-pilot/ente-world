import test from 'node:test';
import assert from 'node:assert/strict';
import {telescopeSpots,telescopeArrived} from '../src/rendering/pixi/telescope.js';
import {navOf} from '../src/gameplay/islands.js';
import {mapOf} from '../src/world/island-maps.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import expansion from '../src/world/home/home-expansion.json' with {type:'json'};

test('walking to any telescope ends "at" it, so the sky opens without the long wait', () => {
  let seen=0;
  for (const {id} of WORLD_ISLANDS) {
    const props=id==='home'?[...(mapOf(id).world.props??[]),...(expansion.props??[])]:(mapOf(id).world.props??[]);
    for (const spot of telescopeSpots(props)) {
      const end=navOf(id).nearest(spot.x,spot.y,400);
      assert.ok(end,`${id} ${spot.id}: reachable`);
      const pose={x:end[0],y:end[1],mode:'walking',action:0,travel:0,path:[]};
      assert.ok(telescopeArrived(props,pose,spot),`${id} ${spot.id}: the walk stops ${Math.round(Math.hypot(end[0]-spot.x,end[1]-spot.y))} away and counts as arrived`);
      assert.equal(telescopeArrived(props,{...pose,path:[[0,0]],travel:50},spot),false,'not while still walking');
      seen++;
    }
  }
  assert.ok(seen>=5,'checked every island telescope');
});
