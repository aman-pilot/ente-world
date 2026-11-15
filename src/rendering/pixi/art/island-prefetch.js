// The other islands are tens of megabytes. On mobile data, with Save-Data on or
// on a slow link they are left until visited. Browsers that do not report the
// connection (Safari, Firefox) keep prefetching.
export const prefetchAllowed=(connection=globalThis.navigator?.connection)=>!connection
  ||!(connection.saveData||connection.type==='cellular'||/(^|-)[23]g$/.test(connection.effectiveType??''));
// HTTP-cache warming only. No renderer, bitmap decoder or texture allocation.
export function createIslandPrefetch({getIndex,selectTier,islands,limit=Infinity,prepareData=async()=>{},allowed=prefetchAllowed,distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2,fetchBytes=async(url,signal)=>{
  const response=await fetch(url,{priority:'low',signal});
  if(!response.ok)throw Error(`Island prefetch HTTP ${response.status}`);
  // Drain into the HTTP cache without allocating a sheet-sized ArrayBuffer.
  if(response.body?.getReader){
    const reader=response.body.getReader();
    try{while(!(await reader.read()).done){signal?.throwIfAborted();}}
    finally{reader.releaseLock();}
  }else await response.arrayBuffer();
},idle=callback=>globalThis.requestIdleCallback?requestIdleCallback(callback,{timeout:2000}):setTimeout(callback,100)}={}) {
  // Limit the nearest set before excluding cached islands, so finishing those
  // neighbours never advances into the rest of the world.
  const candidates=()=>{
    const origin=islands.find(i=>i.id===current);if(!origin)return [];
    return islands.filter(i=>i.id!==current).sort((a,b)=>distance(origin,a)-distance(origin,b)||a.id.localeCompare(b.id)).slice(0,limit);
  };
  const done=new Set();let current,paused=true,scheduled=false,running=false,controller,dead=false,generation=0;
  const schedule=()=>{
    if(dead||paused||running||scheduled||!current||!allowed()||!candidates().some(i=>!done.has(i.id)))return;
    scheduled=true;idle(()=>{scheduled=false;void run();});
  };
  const run=async()=>{
    if(dead||paused||running)return;
    const next=candidates().find(i=>!done.has(i.id));
    if(!next)return;
    running=true;const epoch=generation;controller=new AbortController();
    try{
      const data=await getIndex();
      if(dead||paused||epoch!==generation||!allowed())return;
      await prepareData(next.id);
      if(dead||paused||epoch!==generation)return;
      const tier=selectTier(data,next.id);
      for(const url of new Set([...tier.webp,...tier.ground??[]])){
        if(dead||paused||epoch!==generation||!allowed())return;
        await fetchBytes(url,controller.signal);
      }
      done.add(next.id);
    }catch(error){if(error.name!=='AbortError')done.add(next.id);}
    finally{running=false;controller=null;schedule();}
  };
  return {
    pause(){paused=true;generation++;controller?.abort();},
    resume(id){if(current&&current!==id){generation++;controller?.abort();}current=id;done.add(id);paused=false;schedule();},
    destroy(){dead=true;controller?.abort();},
  };
}
