import test from 'node:test';
import assert from 'node:assert/strict';
import {furnitureDepth} from '../src/rendering/pixi/furniture-depth.js';

test('furniture depth keeps the plain depth while an island\'s props have not loaded (live black screen 17 Nov)', () => {
  for (const props of [undefined, null, []]) assert.equal(furnitureDepth(props, 100, 200, 250), 250);
  assert.equal(furnitureDepth(undefined, 100, 200), 200);
});

test('furniture depth skips footprints without a point list instead of crashing every frame (live freeze on Rosybutton 17 Nov)', () => {
  const props=[
    {src:'a.svg',name:'bench',x:0,y:0,width:100,height:60,footprint:{x:0,y:0,rx:40,ry:20}},
    {src:'b.svg',name:'stall',x:0,y:0,width:100,height:60,footprint:{parts:[{poly:[[0,0],[10,0],[10,10]]}]}},
    {src:'c.svg',name:'lamp',x:0,y:0,width:20,height:80,footprint:{poly:undefined,parts:[undefined]}},
  ];
  assert.doesNotThrow(()=>furnitureDepth(props,5,5,7));
  assert.equal(typeof furnitureDepth(props,5,5,7),'number');
});
