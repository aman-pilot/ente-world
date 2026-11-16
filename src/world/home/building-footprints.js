import bodyMasks from './front-body-silhouettes.json' with {type:'json'};
import silhouettes from './building-silhouettes.json' with {type:'json'};
import {createPropOutlines} from '../prop-outlines/geometry.js';
let rule;
const homeRule=()=>rule??=createPropOutlines(silhouettes,bodyMasks,{pixelMasks:false});
export function buildingFootprint(prop){return homeRule().buildingFootprint(prop);}
export function solidBuilding(prop){return homeRule().solidBuilding(prop);}
