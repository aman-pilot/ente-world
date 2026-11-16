import test from 'node:test';
import assert from 'node:assert/strict';
import {Container,Texture,ImageSource} from 'pixi.js';
import {createTextureLeases} from '../src/rendering/pixi/art/texture-leases.js';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
const flush=()=>new Promise(setImmediate);

test('Home tile fallback reacquires final textures after leaving during asynchronous asset unload',async()=>{
 const cached=new Map(),unloading=[],loads=[];
 const assets={
  async load({src}){
   loads.push(src);
   if(!cached.has(src))cached.set(src,new Texture({source:new ImageSource({width:100,height:100})}));
   return cached.get(src);
  },
  unload(src){return new Promise(resolve=>unloading.push(()=>{cached.get(src)?.destroy(true);cached.delete(src);resolve();}));}
 };
 const {acquire,release,leases}=createTextureLeases(assets),pool=createGroundPool({acquire,release});
 const root=new Container(),tiles=[{src:'/home-tile.svg',x:0,y:0,width:100,height:100}];
 const first=pool.create(tiles,root);await first.prepare();const old=first.entries[0].sprite.texture;
 first.destroy();await flush();assert.equal(unloading.length,1);
 const returned=pool.create(tiles,root),preparing=returned.prepare();await flush();
 assert.equal(loads.length,1,'return waits until the previous source has finished unloading');
 unloading.shift()();await preparing;
 const final=returned.entries[0].sprite.texture;
 assert.notEqual(final,old);assert(old.destroyed);assert(!final.destroyed);assert.equal(final.source.pixelWidth,100);
 for(const x of [-160000,-80000,0,80000]){
  pool.update([{stream:returned,camera:{x,y:50,zoom:.19},width:1440,height:900}]);
  pool.update([]);assert.equal(returned.entries[0].sprite.texture,final);
 }
 assert.equal(leases.get('/home-tile.svg').count,1);
 pool.destroy();await flush();unloading.splice(0).forEach(f=>f());await flush();root.destroy({children:true});
 assert.equal(leases.size,0);
});

test('shared leases survive a same-turn release and reacquire without unloading',async()=>{
 let unloads=0,loads=0;
 const cache=createTextureLeases({load:async()=>{loads++;return {};},unload:async()=>unloads++});
 await cache.acquire('shared');cache.release('shared');await cache.acquire('shared');await flush();
 assert.equal(loads,1);assert.equal(unloads,0);cache.release('shared');await flush();assert.equal(unloads,1);
});

test('a failed picture lease is evicted so the returning island retries it',async()=>{
 let attempts=0;
 const cache=createTextureLeases({load:async()=>{if(++attempts===1)throw Error('offline');return {};},unload:async()=>{}});
 await assert.rejects(cache.acquire('retry'),/offline/);assert.equal(cache.leases.size,0);
 await cache.acquire('retry');assert.equal(attempts,2);cache.release('retry');await flush();
});
