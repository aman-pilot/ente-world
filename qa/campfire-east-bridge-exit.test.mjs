import test from 'node:test';
import assert from 'node:assert/strict';
import {navOf} from '../src/gameplay/islands.js';
import {mapOf} from '../src/world/island-maps.js';

test('the campfire-east bridge meets the grass at its east end, so Duckies can walk off it (live 17 Nov)', () => {
  const nav=navOf('isle-250'), bridge=mapOf('isle-250').walk.bridges.find(b=>b.id==='campfire-east');
  const [a,,,d]=bridge.poly, b=bridge.poly[1], c=bridge.poly[2];
  const west={x:(a[0]+d[0])/2,y:(a[1]+d[1])/2}, east={x:(b[0]+c[0])/2,y:(b[1]+c[1])/2}, len=Math.hypot(east.x-west.x,east.y-west.y);
  const ux=(east.x-west.x)/len, uy=(east.y-west.y)/len;
  for (let t=40;t<=len+120;t+=6) {
    const x=Math.round(west.x+ux*t), y=Math.round(west.y+uy*t);
    assert.ok(nav.walkable(x,y),`walkable along the deck and onto the bank at ${x},${y} (t=${t} of ${Math.round(len)})`);
  }
});
