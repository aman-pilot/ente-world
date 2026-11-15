#!/usr/bin/env node
// Rebuild the opt-in island's compact scene using the same tracer as Home.
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {alphaContours} from './lib/alpha-contour.mjs';
import {frontBodyMask} from './lib/front-body-mask.mjs';
import {createPropOutlines,bodyMaskKey} from '../src/world/prop-outlines/geometry.js';
import {packHomeScene} from '../src/world/home/scene-pack.js';
const art=JSON.parse(readFileSync('public/pixi-art/themes/pink/art.json'));
const outlines={},bodies={},rasters=new Map();
for(const src of [...new Set(art.props.map(p=>p.src))].sort()){
 const rgba=await sharp('public'+(src.startsWith('/')?src:'/pixi-art/themes/pink/'+src)).resize(256,256,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 // Home's one-pixel error allowance is added to the outline clearance.
 outlines[src]=alphaContours(rgba,256);rasters.set(src,rgba);
}
const rule=createPropOutlines(outlines,{});
for(const p of art.props.map(p=>rule.solidBuilding({...p,scale:p.scale??1}))){
 if(p.outlineKind!=='solid')continue;
 const key=bodyMaskKey(p);
 bodies[key]??=frontBodyMask(rasters.get(p.src),{...p,x:0,y:0,anchor:{x:0,y:0}},p.sortY-p.y+p.anchor.y*p.height*p.scale).map(r=>r.map(([x,y])=>[Math.round(x/(p.width*p.scale)*256),Math.round(y/(p.height*p.scale)*256)]));
}
writeFileSync('assets/world/themes/pink/scene-pack.json',JSON.stringify(packHomeScene({pink:{outlines:Object.fromEntries(Object.entries(outlines).map(([src,rings])=>[src,rings.map(r=>r.map(([x,y])=>[Math.round(x*256),Math.round(y*256)]))])),bodies}}))+'\n');
