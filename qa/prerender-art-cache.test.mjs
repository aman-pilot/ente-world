import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {prerenderCache} from '../scripts/prerender-cache.mjs';
import {prerenderDetailSheets} from '../scripts/prerender-detail.mjs';

test('Pages reuses detail sheets across fresh output directories and rerenders changed art', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'ducky-art-test-'));
  const npmCache = path.join(root, '.npm');
  t.after(() => rm(root, {recursive: true, force: true}));
  for (const [name, value] of Object.entries({CF_PAGES: '1', npm_config_cache: npmCache, DUCKY_ART_CACHE_DIR: ''})) {
    const before = process.env[name];
    process.env[name] = value;
    t.after(() => { if (before === undefined) delete process.env[name]; else process.env[name] = before; });
  }
  const artRoot = path.join(root, 'public');
  await mkdir(artRoot);
  const writeArt = fill => writeFile(path.join(artRoot, 'test.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="${fill}"/></svg>`);
  const sheets = [{width: 8, height: 8, frames: [{
    src: 'test.svg', w: 4, h: 4, scale: 1, x: 2, y: 2, f: {x: 0, y: 0, width: 4, height: 4},
  }]}];
  const build = async out => {
    const artCache = prerenderCache(root, 'a'.repeat(24), {warn: message => assert.fail(message)});
    const cache = new Map();
    const assets = new Map();
    await prerenderDetailSheets(sheets, {
      root: artRoot, output: path.join(root, out), cache, artCache,
      emit: (name, bytes) => assets.set(name, bytes),
    });
    await artCache.prune();
    return {assets, rendered: cache.rendered ?? 0, reused: cache.reused ?? 0};
  };

  await writeArt('red');
  const cold = await build('cold');
  assert.equal(cold.rendered, 1);
  const warm = await build('warm');
  assert.equal(warm.reused, 1);
  assert.deepEqual(warm.assets, cold.assets);

  await writeArt('blue');
  const changed = await build('changed');
  assert.equal(changed.rendered, 1);
  assert.notDeepEqual(changed.assets, cold.assets);
  await writeArt('red');
  assert.equal((await build('after-prune')).rendered, 1);
});
