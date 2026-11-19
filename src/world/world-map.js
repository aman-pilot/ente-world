import {sphereFrame} from './sphere.js';
import {flatOffset,FLAT_RING,nearestSeaX} from './flat-layout.js';
import world from '../../assets/world/world.json' with {type: 'json'};
import READY from './delivered-themes.js';

const W = 5800, H = 4400;
export const FINISHED_THEMES = ['sunflower', 'pink', 'library', 'community', 'bog', 'snow'];
export const TEST_THEMES = FINISHED_THEMES.slice(0, 3);
export const THEMED_ISLANDS = [
  ['blossom', 'sunflower', 'Sunbob', 0xf2c53d],
  ['sunset', 'pink', 'Rosyblossom', 0xf29bb7],
  ['isle-251', 'library', 'Pagepond', 0xd9b578],
  ['isle-250', 'community', 'Campfire', 0xb98cf0],
  ['isle-249', 'bog', 'Booquack', 0xb98cf0],
  ['isle-55', 'snow', 'Iceland', 0x9fd4ff],
];
export const sizeOfTheme = theme => {const w = theme && theme !== 'home' ? READY?.[theme]?.world : null; return w?.width > 0 && w?.height > 0 ? {width: w.width, height: w.height} : theme === 'home' || !theme ? {width:world.width,height:world.height} : {width:W,height:H};};
export const ISLAND_COUNT = 1 + FINISHED_THEMES.length;

// Globe picture only (sailing uses the flat chart): Iceland on the north pole, Booquack on the south pole, Home and
// the other four round the equator in flat-sea order (Sunbob NE, Pagepond SE, Rosyblossom SW, Campfire NW), spaced by
// their widths so neighbours never touch.
const ANCHORS = [
  [67, 8], [-142.7, -8], [140.8, -8], [-68.9, 8], [0, -90], [0, 90],
];
const RAD=Math.PI/180;
export const SPHERE_CIRCUMFERENCE=80000;
const BASE_SIZES=new Map(['home',...FINISHED_THEMES].map(t=>[t,sizeOfTheme(t)]));
export function layoutWorld(sizeOf=sizeOfTheme,seed=11,finished=FINISHED_THEMES){
 const out=[{index:0,id:'home',name:'Homeland',accent:0xffda69,tint:0xffffff,lon:0,lat:0,...sizeOf('home')}];
 for(const theme of finished){
  const k=FINISHED_THEMES.indexOf(theme),meta=THEMED_ISLANDS.find(row=>row[1]===theme);
  if(!meta||k<0)throw Error(`No stable island identity for ${theme}`);
  const [lon,lat]=ANCHORS[k];out.push({index:k+1,id:meta[0],theme,name:meta[2],accent:meta[3],tint:0xffffff,lon:lon*RAD,lat:lat*RAD,...sizeOf(theme)});
 }
 let scale=1;
 for(const i of out){
  if(!(i.width>0&&i.height>0&&Number.isFinite(i.width+i.height)))throw Error(`Invalid map bounds for ${i.id}`);
  const base=BASE_SIZES.get(i.theme??'home');scale=Math.max(scale,i.width/base.width,i.height/base.height);
 }
 const Rw=SPHERE_CIRCUMFERENCE/(2*Math.PI)*scale,SX=2*Math.PI*Rw,wrapd=(v,p)=>v-p*Math.round(v/p);
 const islands=out.map(i=>({...i,...sphereFrame(i.lon,i.lat),x:W/2+(i.lon*Rw),y:H/2+(-i.lat*Rw)}));
 return {islands,Rw,SX,wrapd,bounds:{x0:W/2-SX/2,x1:W/2+SX/2,y0:H/2-Math.PI*Rw/2,y1:H/2+Math.PI*Rw/2}};
}

const MAP = layoutWorld();
export const WORLD_ISLANDS = MAP.islands;
export const MAP_BOUNDS = MAP.bounds;
export const WORLD_GEO = {SX: MAP.SX, Rw: MAP.Rw, wrapd: MAP.wrapd, latOf: y => -(y - H / 2) / MAP.Rw};
const byId = new Map(WORLD_ISLANDS.map(island => [island.id, island]));
export const worldIsland = id => byId.get(id);
export function offsetOf(a, b) {
  return flatOffset(a,b);
}
const LINKS = new Map(WORLD_ISLANDS.map(island => [island.id, new Set()]));
// Preserve harbour access, then connect the equator by nearest wrapped distance.
for(const [k,id]of FLAT_RING.entries()){
 LINKS.get('home').add(id); LINKS.get(id).add('home');
 const next=FLAT_RING[(k+1)%FLAT_RING.length];
 LINKS.get(id).add(next); LINKS.get(next).add(id);
}
const equator=WORLD_ISLANDS.filter(i=>Math.abs(i.lat)<Math.PI/2);
for(const island of equator){
 const closest=equator.filter(i=>i.id!==island.id).map(i=>{
  const p=offsetOf(island.id,i.id);return {id:i.id,d:Math.hypot(nearestSeaX(p.x,0),p.y)};
 }).sort((a,b)=>a.d-b.d).slice(0,2);
 for(const other of closest){LINKS.get(island.id).add(other.id);LINKS.get(other.id).add(island.id);}
}
const NEIGHBOURS = new Map();
export function neighboursOf(id) {
  if (!NEIGHBOURS.has(id)) NEIGHBOURS.set(id, [...LINKS.get(id)].map(other => ({island: byId.get(other), ...offsetOf(id, other), x:nearestSeaX(offsetOf(id,other).x,0)}))
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)));
  return NEIGHBOURS.get(id);
}
