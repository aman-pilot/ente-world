import data from './bog-environment.json' with {type:'json'};
import {registerMap,THEME_OF,mapFor} from '../../world/island-maps.js';

export const BOG_MAP_ID='bog-arena';
export const BOG_REVIEW_ISLAND='isle-249';
export const BOG_AREAS=Object.freeze(Object.fromEntries(Object.entries(data.world.zones)
 .filter(([id])=>id!=='plaza').map(([id,{x,y,combatPad}])=>[id,{x,y,...(combatPad?{pad:combatPad}:{})}])));
export function installBogEnvironment(){
 const previous=THEME_OF.get(BOG_REVIEW_ISLAND);
 if(!registerMap(BOG_MAP_ID,data))throw Error('Bog environment registration failed');
 THEME_OF.set(BOG_REVIEW_ISLAND,BOG_MAP_ID);
 return {map:mapFor(BOG_MAP_ID),islandId:BOG_REVIEW_ISLAND,restore(){
  THEME_OF.set(BOG_REVIEW_ISLAND,previous);registerMap(BOG_MAP_ID,null);
 }};
}
