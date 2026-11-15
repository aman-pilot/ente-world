import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import {mapOf,mapFor} from '../src/world/island-maps.js';
import {geometry,inShape,shapeIndex} from '../assets/world/island-geometry.mjs';
import {propOutlineKind} from '../src/world/home/prop-outline-rules.js';
import {hasPropOutlines} from '../src/world/prop-outlines/islands.js';
import {homeSleeperFootprint} from '../src/world/home/sleep-spots.js';
import {auditRosyTargets} from '../scripts/lib/rosy-walk-targets.mjs';
import {unpackHomeScene,packHomeScene} from '../src/world/home/scene-pack.js';
import packed from '../assets/world/themes/pink/scene-pack.json' with {type:'json'};
import poses from '../src/world/home/sleep-poses.json' with {type:'json'};
const map=mapOf('sunset'),props=map.world.props,nav=map.nav(),client=geometry(map.walk).walkable;
const {outlines}=unpackHomeScene(packed,'pink');
const src=p=>'public'+(p.src.startsWith('/')?p.src:'/pixi-art/themes/pink/'+p.src);

test('only Home and Rosybutton island ids opt into prop outlines',()=>{
 assert.equal(hasPropOutlines('home'),true);assert.equal(hasPropOutlines('sunset'),true);
 for(const id of ['pink','sunflower','blossom','sunbob','bog','library'])assert.equal(hasPropOutlines(id),false,id);
 assert.ok(mapFor('sunflower').world.props.every(p=>!p.outlineKind),'Sunbob stays off');
 assert.equal(map.walk.navigationCellSize,16);
});

test('every Rosybutton prop has a source trace and all solid interiors block client and worker',()=>{
 assert.equal(props.length,999,'all visual-fix props retained');
 for(const p of props){
  assert.ok(outlines[p.src]?.every(r=>r.length>=3),p.id+' traced');assert.equal(p.outlineKind,propOutlineKind(p));
  if(p.outlineKind!=='solid'){assert.equal(p.footprint,undefined,p.id);assert.ok(p.z<map.origin.y-10000);continue;}
  assert.ok(p.bodyFootprint?.bodyBlock,p.id+' body mask');assert.equal(p.bodyFootprint.clearance,0);
  const all=[p.footprint.poly,...(p.footprint.parts??[])].flat(),xs=all.map(v=>v[0]),ys=all.map(v=>v[1]);
  assert.ok(all.flat().every(Number.isFinite),p.id);assert.equal(p.z,Math.max(...ys));
  assert.ok(Math.max(...[p.bodyFootprint.poly,...(p.bodyFootprint.parts??[])].flat().map(v=>v[1]))<=p.sortY+1e-8,p.id+' body mask depth');
  let count=0;const points=[[xs.reduce((a,b)=>a+b)/xs.length,ys.reduce((a,b)=>a+b)/ys.length]];
  for(let i=1;i<12;i++)for(let j=1;j<12;j++)points.push([Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*i/12,Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*j/12]);
  for(const point of points)if(inShape(...point,p.footprint)){assert.equal(client(...point),false,p.id+' client');assert.equal(nav.walkable(...point),false,p.id+' worker');count++;}
  assert.ok(count,p.id+' interior sampled');
 }
});

test('all Rosybutton opaque art including flipped drawings is blocked',async()=>{
 const rasters=new Map();for(const p of props.filter(p=>p.outlineKind==='solid')){
  if(!rasters.has(p.src))rasters.set(p.src,await sharp(src(p)).resize(48,48,{fit:'fill'}).ensureAlpha().raw().toBuffer());
  const data=rasters.get(p.src),w=p.width*p.scale,h=p.height*p.scale;
  for(let y=0;y<48;y++)for(let x=0;x<48;x++)if(data[(y*48+x)*4+3]>240){const wx=p.x+(p.flip?p.anchor.x-(x+.5)/48:(x+.5)/48-p.anchor.x)*w,wy=p.y+((y+.5)/48-p.anchor.y)*h;assert.equal(client(wx,wy),false,p.id+' client art');assert.equal(nav.walkable(wx,wy),false,p.id+' worker art');}
 }
});

test('every exact Rosybutton door shop pickup dock crossing harbour and spawn is reachable',()=>{
 const audit=auditRosyTargets(map);assert.equal(audit.length,178,'complete authored inventory');
 assert.deepEqual(audit.filter(t=>t.blocked||!t.reachable),[]);
 const start=[map.spawn.x,map.spawn.y];for(const t of audit){assert.equal(client(...t.point),true,t.id);let previous=start;const route=nav.route(...start,...t.point);assert.deepEqual(route.at(-1),t.point,t.id);for(const next of route){assert.ok(nav.clearLine(previous,next),t.id+' continuous route');previous=next;}}
});

test('Rosybutton trees lamps and reeds keep their entire traced drawing blocked',()=>{
 const tall=props.filter(p=>/tree|oak|birch|cherry|blossom|palm|lamp|lantern|reeds|cattail/.test(p.src.split('/').at(-1)));
 assert.ok(tall.length>250);for(const p of tall){assert.equal(p.outlineKind,'solid',p.id);for(const [u,v]of outlines[p.src].flat()){const x=p.x+(p.flip?p.anchor.x-u/256:u/256-p.anchor.x)*p.width*p.scale,y=p.y+(v/256-p.anchor.y)*p.height*p.scale;assert.ok(inShape(x,y,p.footprint,p.footprint.clearance),p.id);}}
});

test('all 90 Rosybutton sleepers retain clear opaque bodies and block a body circle',async()=>{
 assert.equal(map.sleepers.length,90);const near=shapeIndex(props.filter(p=>p.footprint).map(p=>p.footprint),0),rasters=new Map();
 for(const bed of map.sleepers){const pose=poses.poses[bed.pose],k=pose.k*.81*.88*.24;assert.equal(bed.tree,undefined);
  if(!rasters.has(bed.pose))rasters.set(bed.pose,await sharp('public'+pose.layers.find(l=>l.id==='duck').src).resize(128,128,{fit:'fill'}).ensureAlpha().raw().toBuffer());
  const data=rasters.get(bed.pose);for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(data[(y*128+x)*4+3]>240){const wx=bed.x+((x+.5)/128*pose.W-(pose.box[0]+pose.box[2])/2)*k*(bed.flip?-1:1),wy=bed.y+((y+.5)/128*pose.H-pose.box[3])*k;assert.ok(!near(wx,wy).some(q=>inShape(wx,wy,q)),bed.pose+' body overlaps '+bed.x+','+bed.y);}
  const o=homeSleeperFootprint(bed);assert.equal(o.rx,o.ry);assert.equal(client(o.x,o.y),false);assert.equal(nav.walkable(o.x,o.y),false);
 }
});

test('pink uses Home scene packing with integer source coordinates and exact round trips',()=>{
 const data=unpackHomeScene(packed,'pink');assert.deepEqual(unpackHomeScene(packHomeScene({pink:data}),'pink'),data);
 for(const rings of [...Object.values(data.outlines),...Object.values(data.bodies)])assert.ok(rings.flat(2).every(Number.isInteger));
 const original=JSON.parse(readFileSync('public/pixi-art/themes/pink/art.json'));assert.equal(Object.keys(outlines).length,new Set(original.props.map(p=>p.src)).size,'one source trace per art');
});

test('Rosybutton cached contours give exactly the original walkable answers at cell and prop edges',()=>{
 const original=geometry({...map.walk,indexPropContours:false}).walkable;
 const same=(x,y)=>assert.equal(client(x,y),original(x,y),`exact walkability at ${x},${y}`);
 let seed=17;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<12000;i++)same(map.origin.x+random()*map.width,map.origin.y+random()*map.height);
 for(const o of [...map.walk.obstacles,...map.walk.water]){
  const ring=o.poly??[[o.x,o.y]],pad=o.clearance??(map.walk.water.includes(o)?20:16);
  for(let i=0;i<ring.length;i+=Math.max(1,Math.ceil(ring.length/8))){
   const [x,y]=ring[i];
   for(const d of [-1e-7,0,1e-7]){
    same(x+pad+d,y);same(x,y+pad+d);
    same(Math.round(x/8)*8+d,Math.round(y/8)*8+d);
   }
  }
 }
 assert.equal(mapOf('home').walk.indexPropContours,undefined,'Home retains its existing lookup');
});

test('cached contour cells preserve concavities, zero clearance, multipart shapes and fixed water padding',()=>{
 const world={width:256,height:256,coast:[[0,0],[256,0],[256,256],[0,256]],islets:[],walkways:[],bridges:[],
  water:[{poly:[[160,40],[180,40],[180,65],[160,65]],clearance:99}],
  obstacles:[
   {poly:[[24,24],[48,24],[48,32],[32,32],[32,48],[24,48]],clearance:0},
   {poly:[[80,24],[96,24],[96,48],[80,48]],parts:[[[112,24],[128,24],[128,48],[112,48]]],clearance:3},
   {x:56,y:140,rx:13,ry:9,clearance:0},
   {poly:[[100,130],[120,130],[120,150],[100,150]],clearance:-2},
  ]};
 const original=geometry(world).walkable,cached=geometry({...world,indexPropContours:true}).walkable;
 for(let y=8;y<240;y+=4)for(let x=8;x<240;x+=4)for(const d of [-1e-7,0,1e-7])assert.equal(cached(x+d,y+d),original(x+d,y+d),`${x+d},${y+d}`);
 for(const p of [[-8,-8],[300,300],[NaN,0],[0,Infinity]])assert.equal(cached(...p),original(...p));
});
