import test from 'node:test';
import assert from 'node:assert/strict';
import {furnitureDepth} from '../src/rendering/pixi/furniture-depth.js';

test('furniture depth keeps the plain depth while an island\'s props have not loaded (live black screen 17 Nov)', () => {
  for (const props of [undefined, null, []]) assert.equal(furnitureDepth(props, 100, 200, 250), 250);
  assert.equal(furnitureDepth(undefined, 100, 200), 200);
});
