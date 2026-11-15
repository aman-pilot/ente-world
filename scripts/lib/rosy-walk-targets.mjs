import centre from '../rosy-ground/data/centre.json' with {type:'json'};
import routes from '../rosy-ground/sampled-routes.json' with {type:'json'};
import pickups from '../../src/gameplay/karma-sites.json' with {type:'json'};
// Exact authored approaches. Sea-islet pickups have their own sailing/walk map.
export function rosyWalkTargets(map){
 const props=map.world.props;
 return [
  {id:'spawn',point:[map.spawn.x,map.spawn.y],kind:'spawn'},
  ...Object.entries(map.world.zones).filter(([,z])=>z.spawn).map(([id,z])=>({id:'zone:'+id,point:z.spawn,kind:'destination'})),
  ...props.filter(p=>p.door||p.communityRole==='home'||(p.communityRole==='workplace'&&!/flower|pot/.test(p.src))||/dollhouse|cake-stall|teacup-cafe|ribbon-workshop|conservatory|tailor-workshop|dovecote-workplace/.test(p.src)).map(p=>({id:'door:'+p.id,point:p.door??[p.x,p.y+34],kind:'door',prop:p.id})),
  ...props.filter(p=>/worktable|potting-bench|music-rack|tea-table/.test(p.src)).map(p=>({id:'work:'+p.id,point:p.approach??[p.x,p.y+100],kind:'work',prop:p.id})),
  ...centre.pathJoins.filter(j=>j.id!=='ribbon-join-north-loop').flatMap(j=>['outer','inner'].map(end=>({id:`join:${j.id}:${end}`,point:j[end],kind:'join'}))),
  ...(map.world.boardingApproaches??[]).map(p=>({id:'berth:'+p.id,point:p.point,kind:'boarding'})),
  ...pickups.filter(p=>p.region==='sunset').map(p=>({id:p.id,point:[p.x,p.y],kind:'pickup'})),
  {id:'harbour',point:[map.HARBOR.land.x,map.HARBOR.land.y],kind:'harbour'},
  ...(map.world.jetties??[]).flatMap(w=>[['foot',w.approachFoot??w.foot],['tip',w.approachTip??w.tip]].map(([end,point])=>({id:`jetty:${w.name}:${end}`,point,kind:'dock'}))),
  ...routes.flatMap(r=>[['start',r.approachStart??r.samples[0]],['end',r.approachEnd??r.samples.at(-1)]].map(([end,point])=>({id:`route:${r.id}:${end}`,point,kind:'route'}))),
  ...map.walk.walkways.flatMap((w,i)=>[['a',w.approachA??w.a],['b',w.approachB??w.b],['middle',w.a.map((v,j)=>(v+w.b[j])/2)]].map(([end,point])=>({id:`crossing:${w.id??i}:${end}`,point,kind:'crossing'}))),
 ];
}
export function auditRosyTargets(map){
 const nav=map.nav(),start=[map.spawn.x,map.spawn.y];
 return rosyWalkTargets(map).map(t=>{
  const blocked=!nav.walkable(...t.point);
  const route=blocked?[]:nav.route(...start,...t.point);
  return {...t,blocked,reachable:JSON.stringify(route.at(-1))===JSON.stringify(t.point)};
 });
}
