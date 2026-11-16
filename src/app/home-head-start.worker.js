import {unpackHomeScene} from '../world/home/scene-pack.js';
import {selectIslandTier} from './ducky-prefetch.js';
import {splitGroundMesh,decodeStrokeMask} from '../rendering/pixi/art/ground-mesh-worker.js';
const json=new Map(),bytes=new Map(),scenes=new Map(),controllers=new Map();
let cancelled=false;
const binary=url=>{if(cancelled)return Promise.reject(Error('Home preparation cancelled'));if(!bytes.has(url)){const controller=new AbortController();controllers.set(url,controller);bytes.set(url,fetch(url,{priority:'low',signal:controller.signal}).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);return r.arrayBuffer();}).catch(e=>{bytes.delete(url);throw e;}).finally(()=>controllers.delete(url)));}return bytes.get(url);};
const read=url=>{if(!json.has(url))json.set(url,fetch(url,{priority:'low',...(url==='/art-prerender/islands.json'?{cache:'no-cache'}:{})}).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);return r.json();}).catch(e=>{json.delete(url);throw e;}));return json.get(url);};
self.onmessage=async({data:{id,kind,url,options}})=>{
  try{
    let value,transfer=[];
    if(kind==='cancel'){cancelled=true;for(const c of controllers.values())c.abort();value=true;}
    else if(kind==='json')value=await read(url);
    else if(kind==='scene'){const key=url+':'+options;value=scenes.get(key)??unpackHomeScene(await read(url),options);scenes.delete(key);}
    else if(kind==='ground'){if(json.has(url))await read(url);else await binary(url);value=true;}
    else if(kind==='bitmap'){
      value=await createImageBitmap(new Blob([await binary(url)]),{premultiplyAlpha:'premultiply'});transfer=[value];
    }else if(kind==='mesh'){
      let buffer=await binary(url);
      if(options.compression==='gzip'&&new Uint8Array(buffer)[0]===31&&new Uint8Array(buffer)[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      value=splitGroundMesh(buffer);if(value.metadata.strokeMask)value.strokeMaskPixels=await decodeStrokeMask(value.metadata.strokeMask);
      transfer=[...value.chunks.flatMap(c=>[c.positions.buffer,c.colors.buffer,c.indices.buffer,...(c.uv?[c.uv.buffer]:[])]),...(value.strokeMaskPixels?[value.strokeMaskPixels.buffer]:[])];
    }else if(kind==='warm'){
      const {dpr,width,height,sceneURL,groundURL}=options;
      for(const [url,value] of options.seed??[])if(!json.has(url))json.set(url,Promise.resolve(value));
      const scene=read(sceneURL).then(data=>{for(const name of ['solo','room'])scenes.set(sceneURL+':'+name,unpackHomeScene(data,name));});scene.catch(()=>{});
      const ground=groundURL?read(groundURL):Promise.resolve({});ground.catch(()=>{});
      const indexURL=(await read('/art-prerender/islands.json')).url,index=await read(indexURL);
      const tier=selectIslandTier(index,'home',dpr,width,height),manifest=await read(tier.manifest);
      const lighter=index.version>=2&&tier.rasterDetail&&!tier.rasterDetail.overBudget?selectIslandTier(index,'home',dpr,width,height,3.5e6):null;
      const planURL=lighter?.bytes<tier.bytes?tier.rasterDetail.plan:null;
      const covered=planURL?new Set((await read(planURL)).sheets.flatMap(s=>s.frames.map(f=>f.src))):null;
      const choose=urls=>{const set=new Set(urls),selected=new Map();for(const [src,e]of Object.entries(manifest)){const t=e.tiers.filter(t=>set.has(t.sheet??t.url)).sort((a,b)=>b.scale-a.scale)[0];if(t)selected.set(src,t);}return selected;};
      let selected=choose(tier.webp);
      if(covered){const light=choose(lighter.webp);selected=new Map([...selected].map(([src,t])=>[src,covered.has(src)&&light.has(src)?light.get(src):t]));}
      if(cancelled)throw Error('Home preparation cancelled');
      for(const url of tier.ground??[])void (url===groundURL?read(url):binary(url)).catch(()=>{});
      await scene;
      const shared=await Promise.all([...json].map(async([url,value])=>[url,await value]));
      value={json:shared,indexURL,manifestURL:tier.manifest,planURL,sheets:[...new Set([...selected.values()].map(t=>t.sheet??t.url)),...((await ground).home?.waterMask?[(await ground).home.waterMask.url]:[])],mesh:(await ground).home};
    }else throw Error('Unknown preparation task');
    self.postMessage({id,value},transfer);
  }catch(error){self.postMessage({id,error:error.message});}
};
