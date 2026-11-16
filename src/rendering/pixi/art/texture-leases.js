import {Assets} from 'pixi.js';
import {ART_TEXTURE} from './art-texture.js';

export function createTextureLeases(assets=Assets) {
  const leases=new Map(),unloads=new Map();
  function acquire(src,resolution=1,{mipmaps=true}={}) {
    let entry=leases.get(src);
    if(!entry){
      // Assets can still return its cached texture while an asynchronous unload
      // is destroying it. A new island lease must wait for that unload to finish.
      const load=()=>assets.load({src,data:{resolution,...(mipmaps?ART_TEXTURE:{groundPadding:2})}});
      entry={count:0,resolution,promise:unloads.has(src)?unloads.get(src).then(load):load()};
      entry.promise.catch(()=>{if(leases.get(src)===entry)leases.delete(src);});
      leases.set(src,entry);
    }
    entry.count++;
    return entry.promise;
  }
  function release(src) {
    const entry=leases.get(src);
    if(!entry||--entry.count)return;
    entry.promise.then(()=>{
      if(entry.count||leases.get(src)!==entry)return;
      leases.delete(src);
      const unloading=assets.unload(src).catch(()=>{});
      unloads.set(src,unloading);
      unloading.finally(()=>{if(unloads.get(src)===unloading)unloads.delete(src);});
    }).catch(()=>{if(leases.get(src)===entry)leases.delete(src);});
  }
  return {leases,acquire,release};
}
