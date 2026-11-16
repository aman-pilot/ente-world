import {unpackHomeScene} from '../home/scene-pack.js';
import {createPropOutlines} from './geometry.js';
export function createIslandScene(packed,theme,readPacked){
// Decoded source masks and baked layout footprints are temporary build inputs.
// Only the serialized pack survives between builds.
let pending;
const ready=()=>Boolean(packed);
function load(){
  if(ready())return Promise.resolve();
  return pending??=readPacked().then(data=>{packed=typeof data==='string'?data:JSON.stringify(data);}).catch(error=>{pending=undefined;throw error;});
}
const outline=props=>{
  if(!packed)throw Error(`${theme} layout is not ready`);
  const source=typeof packed==='string'?JSON.parse(packed):packed;
  const data=unpackHomeScene(source,theme,props?['outlines','bodies']:['outlines','bodies','props']);
  const rule=createPropOutlines(Object.fromEntries(Object.entries(data.outlines).map(([src,rings])=>[src,rings.map(r=>r.map(([x,y])=>[x/256,y/256]))])),data.bodies);
  return (props??data.props??[]).map(p=>theme==='bog-arena'&&p.hideBush===true?p:rule.solidBuilding({...p,scale:p.scale??1,anchor:p.anchor??{x:.5,y:1},wind:false}));
};
return {ready,load,outline};
}
