import {unpackHomeScene} from '../home/scene-pack.js';
import {createPropOutlines} from './geometry.js';
export function createIslandScene(packed,theme,readPacked){
let layoutProps;
function makeRule(packed){
  const data=unpackHomeScene(packed,theme);
  layoutProps=data.props;
  return createPropOutlines(Object.fromEntries(Object.entries(data.outlines).map(([src,rings])=>[src,rings.map(r=>r.map(([x,y])=>[x/256,y/256]))])),data.bodies);
}
// Node authorities retain the eager JSON import. The production client replaces
// it with a deferred fetch, using exactly the same decoder and obstacle rule.
let rule=packed?makeRule(packed):null,pending;
const ready=()=>Boolean(rule);
function load(){
  if(rule)return Promise.resolve();
  return pending??=readPacked().then(data=>{rule=makeRule(data);}).catch(error=>{pending=undefined;throw error;});
}
const outline=(props=layoutProps??[])=>{
  if(!rule)throw Error(`${theme} layout is not ready`);
  return props.map(p=>theme==='bog-arena'&&p.hideBush===true?p:rule.solidBuilding({...p,scale:p.scale??1,anchor:p.anchor??{x:.5,y:1},wind:false}));
};
return {ready,load,outline};
}
