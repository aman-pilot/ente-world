import test from 'node:test';
import assert from 'node:assert/strict';
import {drawLiveIsland} from '../src/rendering/pixi/sphere-mesh.js';
import {placeRigid} from '../src/world/rigid.js';
import {SEA_WIDTH} from '../src/world/flat-layout.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';

test('a live island copy lands under the camera on either side of the sea seam', () => {
  for (const from of WORLD_ISLANDS) for (const to of WORLD_ISLANDS) {
    const m=mapOf(to.id),centre=placeRigid(from.id,to.id,{x:m.cx,y:m.cy});
    for (const lap of [-1,0,1]) {
      const camera={x:centre.x+lap*SEA_WIDTH,y:centre.y,zoom:1,basis:{a:1,b:0,c:0,d:1}};
      let seen;
      drawLiveIsland({render:o=>{seen=o.transform;}},from.id,to.id,{},camera,1000,800,1,null);
      const sx=seen.a*m.cx+seen.c*m.cy+seen.tx;
      assert.ok(Math.abs(sx-500)<1e-3,`${from.id}>${to.id} lap ${lap}: island centre drawn at x=${sx}, not under the camera`);
    }
  }
});
