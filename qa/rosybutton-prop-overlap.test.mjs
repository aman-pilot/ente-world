import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {propAlphaOracle,overlapInventory,isStructure,overlapDrawings} from '../scripts/lib/prop-alpha-overlap.mjs';
import allowed from './fixtures/rosybutton-allowed-overlaps.json' with {type:'json'};

// Captured from main b4a57c866. Only placement ids and occupied world-pixel
// counts are stored, so this check works in a fresh checkout without git refs.
const art=JSON.parse(readFileSync('public/pixi-art/themes/pink/art.json'));
const drawings=overlapDrawings(art);
const oracle=await propAlphaOracle(drawings);
const current=overlapInventory(drawings,oracle);

test('every Rosybutton drawing stays within main building and structure alpha overlaps',()=>{
 const structures=new Set(drawings.filter(p=>isStructure(p)||p.id.startsWith('deck-')||p.id.endsWith('-dock')).map(p=>p.id));
 const regressions=Object.entries(current).filter(([key,n])=>key.split('|').some(id=>structures.has(id))&&n>(allowed[key]??0));
 assert.deepEqual(regressions,[],'occupied alpha area exceeds main, in square world units');
});

test('Rosybutton prop drawings introduce no new or larger mutual alpha overlaps',()=>{
 assert.deepEqual(Object.entries(current).filter(([key,n])=>n>(allowed[key]??0)),[]);
});

test('alpha comparison respects transparent holes, anchors and horizontal flips',async()=>{
 const pot=art.props.find(p=>p.id==='hamlet-ribbonwick-tulip-pot-ne');
 const b=oracle.bounds(pot),same={...pot,id:'same'};
 assert.ok(oracle.overlap(pot,same)>0);
 assert.equal(oracle.overlap(pot,{...pot,x:pot.x+b.w+1}),0);
 const flipped={...pot,flip:!pot.flip};
 assert.ok(oracle.overlap(pot,flipped)<oracle.overlap(pot,same));
 assert.equal(oracle.occupied(pot,b.x0+.5,b.y0+.5),false,'transparent box corner');
});
