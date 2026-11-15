import packed from '../../../assets/world/themes/pink/scene-pack.json' with {type:'json'};
import {unpackHomeScene} from '../home/scene-pack.js';
import {createPropOutlines} from './geometry.js';
const data=unpackHomeScene(packed,'pink');
const rule=createPropOutlines(Object.fromEntries(Object.entries(data.outlines).map(([src,rings])=>[src,rings.map(r=>r.map(([x,y])=>[x/256,y/256]))])),data.bodies);
export const outlinePinkProps=props=>props.map(p=>rule.solidBuilding({...p,scale:p.scale??1,anchor:p.anchor??{x:.5,y:1},wind:false}));
