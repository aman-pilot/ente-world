import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {mapFor} from '../../src/world/island-maps.js';
import {checkTheme} from '../theme-index.mjs';
import {inShape} from '../../assets/world/island-geometry.mjs';
import {canSail} from '../../src/gameplay/islands.js';
import {paperboatMoorings} from '../pagepond-boats/config.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
export function pagepondWalkTargets(m){return [

{id:'spawn',point:[m.spawn.x,m.spawn.y],file:'assets/world/themes/library/harbor.json',path:['spawn']},
...Object.entries(m.world.zones).filter(([,z])=>z.spawn).map(([id,z])=>({id:'zone:'+id,point:z.spawn,file:'assets/world/themes/library/world.json',path:['zones',id,'spawn']})),
...read('scripts/pagepond-ground/sampled-routes.json').flatMap((r,i)=>[['start',r.approachStart??r.samples[0]],['end',r.approachEnd??r.samples.at(-1)]].map(([end,point])=>({id:`route:${r.id}:${end}`,point,file:'scripts/pagepond-ground/sampled-routes.json',path:[i,end==='start'?'approachStart':'approachEnd']}))),
...read('src/gameplay/karma-sites.json').flatMap((p,i)=>p.region==='isle-251'?[{id:p.id,point:[p.x,p.y],file:'src/gameplay/karma-sites.json',path:[i]}]:[]),
...(m.world.boardingApproaches??[]).map((a,i)=>({id:'boarding:'+a.id,point:a.point,file:'assets/world/themes/library/world.json',path:['boardingApproaches',i,'point']})),
{id:'harbour',point:[m.HARBOR.land.x,m.HARBOR.land.y]},
...m.world.walkways.flatMap((w,i)=>[['a',w.approachA??w.a],['b',w.approachB??w.b],['middle',w.approachMiddle??w.a.map((v,j)=>(v+w.b[j])/2)]].map(([end,point])=>({id:`crossing:${w.id??i}:${end}`,point,file:'assets/world/themes/library/world.json',path:['walkways',i,'approach'+end[0].toUpperCase()+end.slice(1)]}))),...m.world.props.filter(p=>p.kind==='building'||p.kind==='kiosk'||p.kind==='worktable'||/^hall.svg$|centre\/bookstore\/(?:tower|stall)|^reuse\/street--book-stall/.test(p.src)).map(p=>({id:'door:'+p.id,point:p.approach??[p.x,p.y+34],file:'assets/world/themes/library/world.json',path:['props',m.world.props.indexOf(p),'approach'],prop:p.id})),

];}
export function auditPagepond(){
 const map=mapFor('library'),nav=map.nav(),routes=read('scripts/pagepond-ground/sampled-routes.json'),art=read('public/pixi-art/themes/library/art.json'),issues=[],pathEnds=[];
 let count=0;
 for(const r of routes){
  for(let i=1;i<r.samples.length;i++){
   const a=r.samples[i-1],b=r.samples[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8));
   for(let j=0;j<n;j++){const p=a.map((v,k)=>v+(b[k]-v)*j/n);count++;if(!nav.walkable(...p)&&!map.walk.obstacles.some(o=>inShape(...p,o,o.clearance??16)))issues.push({type:'path-clearance',id:r.id,point:p});}
  }
  for(const [end,p]of [['start',r.approachStart??r.samples[0]],['end',r.approachEnd??r.samples.at(-1)]]){
   const result=nav.route(map.spawn.x,map.spawn.y,...p),q=result.at(-1),reached=nav.walkable(...p)&&q&&Math.hypot(q[0]-p[0],q[1]-p[1])<.01;
   pathEnds.push({path:r.id,end,point:p,reached});if(!reached)issues.push({type:'path-end-access',id:r.id,end,point:p});
  }
 }
 const bridges=map.world.walkways.map((w,i)=>{
  let bad=0;for(let t=0;t<=1;t+=.025)if(!nav.walkable(w.a[0]+(w.b[0]-w.a[0])*t,w.a[1]+(w.b[1]-w.a[1])*t))bad++;
  if(bad)issues.push({type:'bridge-access',id:w.id??i,bad});return {id:w.id??i,bad};
 });
 for(const t of pagepondWalkTargets(map)){const result=nav.route(map.spawn.x,map.spawn.y,...t.point);if(!nav.walkable(...t.point)||JSON.stringify(result.at(-1))!==JSON.stringify(t.point))issues.push({type:'exact-target',id:t.id,point:t.point});}
 const theme=checkTheme('library');if(!theme.ready)issues.push(...theme.problems.map(problem=>({type:'theme-contract',problem})));
 const exact=read('scripts/pagepond-ground/geometry-audit.json');issues.push(...exact.issues);
 const boats=paperboatMoorings.map(p=>({id:p.id,water:map.boatSpots().some(b=>b.x===p.x&&b.y===p.y)&&canSail(p.x,p.y,'isle-251')}));
 for(const b of boats)if(!b.water)issues.push({type:'paperboat-land',id:b.id});
 return {overlaps:exact.issues.length,walkIssues:issues.filter(i=>/access|clearance|contract/.test(i.type)).length,checked:{props:art.props.length,routeSamples:count,bridges:bridges.length,pathEnds:pathEnds.length,sleepers:theme.sleepers.length,boats:boats.length},issues,pathEnds,bridges,boats};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=auditPagepond();fs.writeFileSync('scripts/pagepond-ground/walk-audit.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({checked:r.checked,overlaps:r.overlaps,walkIssues:r.walkIssues,issues:r.issues.slice(0,30)},null,2));if(r.issues.length)process.exitCode=1;}
