import {unpackHomeScene} from '../world/home/scene-pack.js';
// Shared with the game, but safe to evaluate while the landing is animating.
const sceneURL=typeof __HOME_SCENE_URL__==='string'?__HOME_SCENE_URL__:null;
const groundURL=typeof __GROUND_MESH_MANIFEST__==='string'?__GROUND_MESH_MANIFEST__:null;
let worker,serial=0,started=false,planning,generation=0;
const tasks=new Map(),json=new Map(),bitmaps=new Map(),meshes=new Map();
const remembered=()=>{try{return localStorage.getItem('ew-last-island');}catch{return null;}};
export function rememberIsland(id){try{localStorage.setItem('ew-last-island',id);}catch{/* private browsing */}}
async function request(kind,url,options){
  if(!worker){
    worker=new Worker(new URL('./home-head-start.worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{const task=tasks.get(data.id);if(!task){data.value?.close?.();return;}tasks.delete(data.id);clearTimeout(task.timer);data.error?task.reject(Error(data.error)):task.resolve(data.value);};
    worker.onerror=()=>{worker.terminate();worker=undefined;for(const t of tasks.values()){clearTimeout(t.timer);t.reject(Error('Home preparation worker failed'));}tasks.clear();};
  }
  return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{tasks.delete(id);reject(Error('Home preparation timed out'));},options?.timeoutMs??30000);tasks.set(id,{resolve,reject,timer});worker.postMessage({id,kind,url,options});});
}
const once=(cache,key,run)=>{if(!cache.has(key)){const job=run().catch(e=>{cache.delete(key);throw e;});job.catch(()=>{});cache.set(key,job);}return cache.get(key);};
export const headStartJSON=(url,{timeoutMs,signal}={})=>once(json,url,()=>started&&typeof Worker==='function'?request('json',url,{timeoutMs}):fetch(url,{...(url==='/art-prerender/islands.json'?{cache:'no-cache'}:{}),...(signal||timeoutMs?{signal:signal??AbortSignal.timeout(timeoutMs)}:{})}).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}));
export async function takeHomeBitmap(url){if(started)await planning;const value=bitmaps.get(url);bitmaps.delete(url);try{return await value;}catch{return undefined;}}
export async function takeHomeMesh(url){if(started)await planning;const value=meshes.get(url);meshes.delete(url);try{return await value;}catch{return undefined;}}
export async function prepareHomeGround(url){if(started){await planning;return request('ground',url);}const r=await fetch(url);if(!r.ok)throw Error(`Ground HTTP ${r.status}`);await r.arrayBuffer();}
export const homeHeadStartActive=()=>started;
export async function headStartScene(url,room){
  if(started){try{return await request('scene',url,room?'room':'solo');}catch{/* normal scene fallback */}}
  return unpackHomeScene(await headStartJSON(url),room?'room':'solo');
}
export function finishHomeHeadStart(){
  generation++;started=false;
  for(const value of bitmaps.values())value.then(b=>b.close(),()=>{});
  bitmaps.clear();meshes.clear();
  // Do not interrupt a request already handed to the renderer.
  const current=worker;const release=()=>{if(worker!==current)return;if(tasks.size){setTimeout(release,100);return;}current?.terminate();worker=undefined;};release();
}
export function startHomeHeadStart({guest=false}={}){
  if(started||!sceneURL||typeof Worker!=='function'||(!guest&&remembered()&&remembered()!=='home'))return;
  started=true;const current=++generation;
  // Planning, JSON parsing, mesh expansion and image decoding all stay in the worker.
  planning=request('warm',null,{sceneURL,groundURL,dpr:Math.min(devicePixelRatio||1,2),width:innerWidth,height:innerHeight})
    .then(plan=>{if(current!==generation)return;for(const [url,value] of plan.json??[])if(!json.has(url))json.set(url,Promise.resolve(value));const jobs=[
      ...plan.sheets.map(url=>once(bitmaps,url,()=>request('bitmap',url))),
      ...(plan.mesh?[once(meshes,plan.mesh.url,()=>request('mesh',plan.mesh.url,plan.mesh))]:[]),
      // Detail often starts after reveal, when the preparation worker is gone.
      ...(plan.planURL?[headStartJSON(plan.planURL)]:[]),
    ];void Promise.allSettled(jobs);}).catch(()=>{if(current===generation)started=false;});
}
export function settleHomeHeadStart(id){
  rememberIsland(id);
  if(id==='home')return;
  // Shared JSON requests may already belong to the authoritative island.
  // Abort only speculative binary fetches, then drain handed-off requests.
  if(started&&worker)void headStartJSON(sceneURL).catch(()=>{});
  if(worker)void request('cancel').catch(()=>{});
  finishHomeHeadStart();
}

// Fetch only, so the game does not evaluate during the intro. Both calls share
// their requests and the browser's HTTP cache survives the trip through GitHub.
const codeWarm = new Map();
export function warmSignInCache() {
  startHomeHeadStart();
  for (const url of globalThis.__EW_GAME ?? []) {
    if (codeWarm.has(url)) continue;
    const job=fetch(url,{priority:'low'}).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).catch(()=>{codeWarm.delete(url);});
    codeWarm.set(url,job);
  }
}
