// Reproducible authored-data proof: node scripts/rosy-ground/review-walk.mjs
// Optional refs select the visual baseline and the start of a placement pass.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import sharp from 'sharp';
import {artPath} from '../lib/prop-alpha-overlap.mjs';
import {outlinePinkProps} from '../../src/world/prop-outlines/pink-scene.js';
import {propZ} from '../../src/rendering/shared/flat-props.js';
const baseRef=process.argv[2]??'3a02e7903',changeRef=process.argv[3]??'a6227651a';
const path='public/pixi-art/themes/pink/art.json';
const at=ref=>JSON.parse(execFileSync('git',['show',ref+':'+path],{maxBuffer:50e6}));
const before=at(baseRef),start=at(changeRef),after=JSON.parse(readFileSync(path));
const moved=after.props.filter(p=>{if(process.argv[4]&&!p.id.includes(process.argv[4]))return false;const q=start.props.find(q=>q.id===p.id);return q&&(p.x!==q.x||p.y!==q.y);});
const images=new Map();
async function picture(p){const width=Math.min(1600,Math.ceil(p.width*(p.scale??1)*1.4)),key=p.src+'|'+width;if(!images.has(key))images.set(key,loadImage(await sharp(artPath(p.src)).resize({width}).png().toBuffer()));return images.get(key);}
function box(p){const w=p.width*(p.scale??1),h=p.height*(p.scale??1),a=p.anchor??{x:0,y:0};return [p.x-(p.flip?1-a.x:a.x)*w,p.y-a.y*h,w,h];}
async function render(art,rect,dest,highlight){
 const [x,y,w,h]=rect,scale=highlight?Math.min(1.2,1500/w,1100/h):Math.min(.3,3300/w,2500/h),canvas=createCanvas(Math.ceil(w*scale),Math.ceil(h*scale)),ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(-x,-y);ctx.fillStyle=art.sea;ctx.fillRect(x,y,w,h);
 const draw=async p=>{const [px,py,pw,ph]=box(p);if(px+pw<x||px>x+w||py+ph<y||py>y+h)return;ctx.save();if(p.flip){ctx.translate(px+pw,py);ctx.scale(-1,1);ctx.drawImage(await picture(p),0,0,pw,ph);}else ctx.drawImage(await picture(p),px,py,pw,ph);ctx.restore();};
 for(const p of art.ground.tiles)await draw(p);
 for(const p of art.decks??[])await draw(p);
 for(const p of art.flats??[])await draw({...p,anchor:p.anchor??(p.topLeft?{x:0,y:0}:{x:.5,y:1})});
 const props=art===after?outlinePinkProps(art.props):art.props;
 for(const p of [...props].sort((a,b)=>(a.z??propZ(a,a.sortY??a.y))-(b.z??propZ(b,b.sortY??b.y))))await draw(p);
 if(highlight){ctx.strokeStyle='#bd1744';ctx.lineWidth=2/scale;ctx.setLineDash([6/scale,5/scale]);ctx.strokeRect(...box(highlight));}
 writeFileSync(dest,canvas.toBuffer('image/png'));
}
mkdirSync('review-walk',{recursive:true});
const sections=[];
for(const p of moved){const q=before.props.find(q=>q.id===p.id),A=box(p),B=box(q),x=Math.min(A[0],B[0])-180,y=Math.min(A[1],B[1])-150,w=Math.max(A[0]+A[2],B[0]+B[2])-x+180,h=Math.max(A[1]+A[3],B[1]+B[3])-y+190,rect=[x,y,w,h],name='prop-'+p.id;
 await render(before,rect,`review-walk/${name}-before.png`,q);await render(after,rect,`review-walk/${name}-after.png`,p);
 sections.push(`<section><h2>${p.id}</h2><p>Base (${q.x}, ${q.y}) → now (${p.x}, ${p.y})</p><img loading="lazy" src="${name}-before.png"><img loading="lazy" src="${name}-after.png"></section>`);
}
for(const [name,art]of [['before',before],['after',after]])await render(art,[art.origin.x,art.origin.y,art.width,art.height],`review-walk/overview-${name}.png`);
writeFileSync('review-walk/index.html',`<!doctype html><meta charset="utf-8"><title>Rosybutton overlap cleanup</title><style>body{font:16px sans-serif;margin:24px;background:#f8f5ef;color:#292521}img{width:48%;margin:.5%;vertical-align:top}section{margin:40px 0}h2{font-size:18px}</style><h1>Rosybutton overlap cleanup</h1><p>Left: base ${baseRef}. Right: current. ${moved.length} props changed since ${changeRef}. Dashed boxes identify the reviewed prop; artwork is rendered from the authored ground, decks, flats and props.</p><img src="overview-before.png"><img src="overview-after.png">${sections.join('')}`);
