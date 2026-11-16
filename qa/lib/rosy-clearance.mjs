import {blocks} from '../../src/world/walk-rule.js';
import assert from 'node:assert/strict';
import {mapOf} from '../../src/world/island-maps.js';
import {homeClearanceOracle} from '../../scripts/lib/home-clearance-audit.mjs';
const map=mapOf('sunset');
const props=map.world.props.map(p=>({...p,src:p.src.startsWith('/')?p.src:'/pixi-art/themes/pink/'+p.src}));
export const rosyOracle=await homeClearanceOracle(props.filter(p=>blocks(p.footprint??{prop:p.id},p)),map.walk);
// Audit both directions against freshly rasterized source alpha. The band
// between 22 and 30 includes Home's conservative one-source-pixel allowance.
export function assertRosySample(nav,point,label){
 if(rosyOracle.eligible(...point))assert.equal(nav.walkable(...point),true,label+' open alpha-safe ground');
 else if(!rosyOracle.connectedEligible(...point))assert.equal(nav.walkable(...point),false,label+' alpha/body/water blocker');
 else assert.equal(nav.walkable(...point),map.nav().walkable(...point),label+' shared conservative edge');
}
