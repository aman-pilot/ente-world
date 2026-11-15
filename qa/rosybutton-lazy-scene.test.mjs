import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build,transform} from 'esbuild';
import {lazyPinkScene} from '../scripts/vite-prerender-art.mjs';
import {mapOf} from '../src/world/island-maps.js';
import {createIslandPrefetch} from '../src/rendering/pixi/art/island-prefetch.js';

const pinkURL='/art-prerender/pink-test.json';

test('production pink data waits for a selected island, retries, and builds identical authority obstacles',async t=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let requests=0,finish,fail=true;
  globalThis.fetch=async url=>{
    assert.equal(url,pinkURL);requests++;
    if(fail)return {ok:false};
    return {ok:true,json:()=>new Promise(resolve=>{finish=resolve;})};
  };
  const {outputFiles:[bundle]}=await build({
    stdin:{resolveDir:process.cwd(),contents:`
      export * from './src/world/island-maps.js';
      export {pickWorldSpawn} from './src/gameplay/world-spawn.js';
      export {RoomClient} from './src/multiplayer/room-client.js';
    `},bundle:true,platform:'node',format:'esm',write:false,
    plugins:[{name:'production-pink',setup(b){
      b.onLoad({filter:/\/world\/prop-outlines\/pink-scene\.js$/},async({path})=>{
        const source=await readFile(path,'utf8');
        const normalized=await transform(source,{format:'esm'});
        return {contents:lazyPinkScene(normalized.code,pinkURL)};
      });
    }}],
  });
  const lazy=await import('data:text/javascript;base64,'+Buffer.from(bundle.text).toString('base64'));
  assert.equal(requests,0,'import does not fetch pink');
  await lazy.prepareIslandMap('home');
  await lazy.prepareIslandMap('isle-251');
  assert.equal(requests,0,'other islands do not fetch pink');
  assert.deepEqual(lazy.mapOf('home').walk,mapOf('home').walk);
  const pink=lazy.mapOf('sunset'),version=lazy.mapsVersion();
  assert.equal(pink.id,'pink','coast and harbour metadata remain available');
  assert.equal(lazy.islandMapReady('sunset'),false);
  assert.throws(()=>pink.nav(),/not ready/);
  const client=new lazy.RoomClient(()=>{});
  client.islandId='sunset';client.player={x:123,y:456,mode:'walking'};
  client.step(.1,{x:1,y:0});client.predict({type:'jump'},0);
  assert.deepEqual(client.player,{x:123,y:456,mode:'walking'},'prediction waits for walking data');
  assert.equal(client.destination(10,20),null);
  const failed=lazy.prepareIslandMap('sunset');
  assert.equal(lazy.prepareIslandMap('sunset'),failed,'concurrent requests share one load');
  await assert.rejects(failed,/unavailable/);
  assert.equal(lazy.islandMapReady('sunset'),false);
  fail=false;
  let spawned=false;
  const spawn=lazy.pickWorldSpawn({hasRoom:id=>id==='sunset',random:()=>.5,prepareIsland:lazy.prepareIslandMap}).then(p=>{spawned=true;return p;});
  while(!finish)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests,2);
  assert.equal(spawned,false,'offline arrival also waits for the selected map');
  assert.throws(()=>pink.nav(),/not ready/);
  finish(JSON.parse(await readFile('assets/world/themes/pink/scene-pack.json','utf8')));
  const arrival=await spawn;
  assert.equal(arrival.islandId,'sunset');
  assert.equal(lazy.islandMapReady('sunset'),true);
  assert.equal(lazy.mapOf('sunset'),pink,'existing geography references stay valid');
  assert.equal(lazy.mapsVersion(),version+1,'sailing caches are invalidated');
  assert.deepEqual(pink.world,mapOf('sunset').world);
  assert.deepEqual(pink.walk,mapOf('sunset').walk);
  assert.deepEqual(pink.sleepers,mapOf('sunset').sleepers);
  assert(pink.nav().walkable(arrival.x,arrival.y));
  await lazy.prepareIslandMap('sunset');
  assert.equal(requests,2,'return trips reuse the loaded scene');
});

test('neighbour prefetch waits for only its selected island data before fetching sheets',async()=>{
  const events=[],idle=[];let finish;
  const prefetch=createIslandPrefetch({
    islands:[{id:'home',x:0,y:0},{id:'sunset',x:1,y:0}],
    idle:callback=>idle.push(callback),getIndex:async()=>({}),
    prepareData:id=>{events.push(id);return new Promise(resolve=>{finish=resolve;});},
    selectTier:()=>({webp:['/pink.webp']}),fetchBytes:async url=>events.push(url),
  });
  prefetch.resume('home');idle.shift()();
  while(!finish)await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(events,['sunset']);
  finish();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(events,['sunset','/pink.webp']);
  prefetch.destroy();
});
