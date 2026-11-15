import packed from '../../../assets/world/themes/pink/scene-pack.json' with {type:'json'};
import {unpackHomeScene} from '../home/scene-pack.js';
import {createPropOutlines} from './geometry.js';
const readPacked=async()=>packed;
function makeRule(packed){
  const data=unpackHomeScene(packed,'pink');
  return createPropOutlines(Object.fromEntries(Object.entries(data.outlines).map(([src,rings])=>[src,rings.map(r=>r.map(([x,y])=>[x/256,y/256]))])),data.bodies);
}
// Node authorities retain the eager JSON import. The production client replaces
// it with a deferred fetch, using exactly the same decoder and obstacle rule.
let rule=packed?makeRule(packed):null,pending;
export const pinkSceneReady=()=>Boolean(rule);
export function loadPinkScene(){
  if(rule)return Promise.resolve();
  return pending??=readPacked().then(data=>{rule=makeRule(data);}).catch(error=>{pending=undefined;throw error;});
}
export const outlinePinkProps=props=>{
  if(!rule)throw Error('Rosybutton layout is not ready');
  return props.map(p=>rule.solidBuilding({...p,scale:p.scale??1,anchor:p.anchor??{x:.5,y:1},wind:false}));
};
