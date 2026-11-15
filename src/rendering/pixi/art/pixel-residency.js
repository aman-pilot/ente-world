import {extensions,ExtensionType,glUploadImageResource} from 'pixi.js';

// Only reproducible static pictures use this uploader. Dimensions, frames and
// GPU textures stay intact; the HTTP cache replaces their decoded CPU copy.
const pictures=new Map(), gameContexts=new WeakMap(), gates=new WeakMap();
const close=resource=>{resource?.close?.();};
export function cacheBackedPixels(source,reload) {
  if(typeof source.resource?.close!=='function')return source;
  pictures.set(source,{reload,uploaded:false,pending:null});
  source.autoGarbageCollect=false;
  source.uploadMethodId='cacheBackedImage';
  source.once('destroy',()=>{close(source.resource);pictures.delete(source);});
  return source;
}
export function releaseArtPixels(source) {
  if(pictures.get(source)?.uploaded&&source.resource){close(source.resource);source.resource=null;source.options.resource=null;}
}
extensions.add({extension:{type:ExtensionType.TextureUploaderWebGL,name:'cacheBackedImage'},
  id:'cacheBackedImage',upload(source,texture,gl,...args){
    if(gl.isContextLost())return;
    if(!source.resource)throw Error(`Picture needs recovery: ${source.label}`);
    glUploadImageResource.upload(source,texture,gl,...args);
    if(gameContexts.has(gl)){const entry=pictures.get(source);entry.uploaded=true;entry.renderer=gameContexts.get(gl);releaseArtPixels(source);}
  },
});
// Snow only needs a tiny frame sample. Read the existing GPU frame on demand
// rather than pinning an entire decoded Duck or hat sheet for that sample.
export function readArtFrame(texture){
  const renderer=pictures.get(texture.source)?.renderer;
  return renderer&&!renderer.gl.isContextLost()?renderer.texture.generateCanvas(texture):null;
}
export async function prepareArtPixels(source,renderer) {
  const gate=gates.get(renderer);if(gate)await gate.promise;
  if(source.destroyed||source.resource||source._gpuData?.[renderer.uid])return;
  await reloadPixels(source);
}
async function reloadPixels(source){
  const entry=pictures.get(source);
  if(!entry||source.destroyed||source.resource)return;
  if(!entry.pending)entry.pending=Promise.resolve().then(entry.reload).then(resource=>{
    if(source.destroyed)close(resource);else source.resource=resource;
  }).finally(()=>{entry.pending=null;});
  await entry.pending;
}
export function installPixelRecovery(renderer,{lost=()=>{},restored=()=>{},failed=()=>{}}={}) {
  const canvas=renderer.canvas;gameContexts.set(renderer.gl,renderer);let dead=false;
  const onLost=event=>{
    event.preventDefault();
    if(!gates.has(renderer)){let resolve;const promise=new Promise(r=>resolve=r);gates.set(renderer,{promise,resolve});}
    lost();
  };
  const onRestored=async()=>{
    try{
      // One sheet at a time. Never rebuild a second full island in CPU memory.
      for(const [source,entry] of pictures){
        if(dead)return;
        if(entry.renderer!==renderer||!entry.uploaded||source.destroyed)continue;
        await reloadPixels(source);
        if(dead||source.destroyed)continue;
        renderer.texture.bindSource(source);
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      if(!dead){gates.get(renderer)?.resolve();gates.delete(renderer);restored();}
    }catch(error){if(!dead)failed(error);}
  };
  canvas.addEventListener('webglcontextlost',onLost);
  canvas.addEventListener('webglcontextrestored',onRestored);
  return ()=>{dead=true;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);gates.get(renderer)?.resolve();gates.delete(renderer);gameContexts.delete(renderer.gl);for(const entry of pictures.values())if(entry.renderer===renderer){entry.renderer=null;entry.uploaded=false;}};
}
