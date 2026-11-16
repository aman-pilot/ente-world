import {headStartJSON} from '../../../app/home-head-start.js';
// Fetch all sheets concurrently at foreground priority, without Wasm or SVG work.
export async function loadRasterDetail(spec,{signal,fetcher=fetch,decode=createImageBitmap,consume}={}){
 const sheetsPromise=fetcher===fetch?headStartJSON(spec.plan,{signal}):fetcher(spec.plan,{signal,priority:'high'}).then(r=>{if(!r.ok)throw Error(`Detail plan HTTP ${r.status}`);return r.json();});
 sheetsPromise.catch(()=>{});
 let packed;
 if(spec.rasterPack){
  try{const r=await fetcher(spec.rasterPack.url,{signal,priority:'high'});if(!r.ok)throw Error(`Detail pack HTTP ${r.status}`);packed=await r.blob();}
  catch(error){await sheetsPromise.catch(()=>{});throw error;}
 }
 const count=spec.rasterPack?spec.rasterPack.ranges.length:spec.raster.length;
 const reload=i=>async()=>{
  const url=spec.rasterPack?.url??spec.raster[i];
  const response=await fetcher(url,{priority:'high'});if(!response.ok)throw Error(`Detail recovery HTTP ${response.status}`);
  let blob=await response.blob();
  if(spec.rasterPack){const [offset,length]=spec.rasterPack.ranges[i];blob=blob.slice(offset,offset+length,'image/webp');}
  return decode(blob,{premultiplyAlpha:'premultiply'});
 };
 const results=new Array(count);let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,count)},async()=>{
  while(cursor<count){const i=cursor++;
   let bitmap,source;
   try{
    signal?.throwIfAborted();let blob;
    if(packed){const [offset,length]=spec.rasterPack.ranges[i];blob=packed.slice(offset,offset+length,'image/webp');}
    else{const r=await fetcher(spec.raster[i],{signal,priority:'high'});if(!r.ok)throw Error(`Detail sheet HTTP ${r.status}`);blob=await r.blob();}
    bitmap=await decode(blob,{premultiplyAlpha:'premultiply'});
    if(consume)source=await consume(bitmap,(await sheetsPromise).sheets[i],reload(i));
    results[i]={status:'fulfilled',value:bitmap,source};
   }catch(reason){source?.destroy();bitmap?.close();results[i]={status:'rejected',reason};}
  }
 }));
 let plan;
 try{plan=await sheetsPromise;const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;signal?.throwIfAborted();}
 catch(error){for(const r of results)if(r.status==='fulfilled'){r.source?.destroy();r.value.close();}throw error;}
 return {sheets:plan.sheets,bitmaps:results.map(r=>r.value),sources:consume?results.map(r=>r.source):undefined,reloads:results.map((_,i)=>reload(i))};
}
