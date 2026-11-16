import test from 'node:test';
import assert from 'node:assert/strict';
import {blocks,blockerFilter} from '../src/world/walk-rule.js';

test('walking policy keeps plants, sleepers and named scenery open',()=>{
 for(const name of ['oak-tree','bush-flowering','hedge','flower-pot','raised-bed','beehive','garden-arch','book-arch','fountain-arch','fountain-edge','field-cover','la-cover','wl-cover','grove-piece','coast-trim','shop-daisy-pot','flower-pot-greenhouse-left','lupins-by-hall','oak-behind-house'])
  assert.equal(blocks({name}),false,name);
 assert.equal(blocks({prop:'sleeping-box',sleeper:true}),false,'sleeper pose is not a prop');
});

test('walking policy retains buildings, furniture, work props and combat barriers',()=>{
 for(const name of ['cottage','shop','treehouse','bench','seat','lamp','table','cart','sign','crate','sack','drying-shelves','tulip-easel','bandstand','rowing-boat-cradle','music-box','shared-well','banner','scarecrow','writing-desk','watering-can','scarf-basket','sled','tea-story-west','ribbon-drying-line','globe','wind-key','dancer','paper-boat-red','boxing-north-ropes','boxing-corner-post-0','boxing-bleachers','wz-wall','wz-planks','wz-sacks','tulip-pot-shop','cart-daisy-pot','flower-wrapping-workbench'])
  assert.equal(blocks({name}),true,name);
 assert.equal(blocks({id:'lane-cover-north-west'}),true);
 assert.equal(blocks({id:'field-cover-foot-0',author:'warzone'}),true,'authored combat wall');
});

test('source assets resolve opaque ids without treating neighbourhood names as object types',()=>{
 for(const [id,src,want] of [
  ['fishing-west','final/buildings/cottage-4.svg',true],
  ['camp-1-focal','final/props/cocoa-table.svg',true],
  ['close-arc-2--120','benches/close-arc-2--120.svg',true],
  ['hamlet-seedwake-bonnet','hamlets/seedwake/bonnet-cottage-yellow-roof.svg',true],
  ['hamlet-lanternleaf-little-oak-behind-house','/pixi-art/plants/tree-1.svg',false],
  ['lib-18','reeds.svg',false],
 ])assert.equal(blocks({prop:id},{id,src}),want,id);
 assert.equal(blocks({prop:'pink-arc-plaza-55'},{src:'detail/pink-arc-plaza-55.svg',name:'Curved timber bench'}),true);
 assert.equal(blocks({prop:1,building:true},{src:'/pixi-art/prop-01.svg',name:'Market stall'}),true);
 assert.equal(blocks({prop:17,building:true},{src:'/pixi-art/prop-17.svg',name:'Pond reeds'}),false);
});

test('anonymous legacy bases retain buildings and furniture while plants open',()=>{
 const keep=blockerFilter([
  {id:'barn',src:'barn.svg',x:4870,y:1309.8},
  {id:'bench',src:'bench.svg',x:2010,y:2175.6},
  {id:'reeds',src:'reeds.svg',x:1190,y:2142.3},
 ]);
 assert.equal(keep({poly:[[4580,1159.8],[5160,1159.8],[5160,1305.8],[4580,1305.8]]}),true);
 assert.equal(keep({x:2010,y:2165.6,rx:70,ry:24}),true);
 assert.equal(keep({x:1190,y:2136.3,rx:20,ry:21}),false);
});

// Read the live data independently of the regex fixtures above. Curved benches
// have opaque filenames, while plant drawings still retain their visual masks.
import {mapFor} from '../src/world/island-maps.js';
test('live curved benches block and plant contours add no movement obstacle',()=>{
 let benches=0,plants=0;
 for(const theme of ['pink','library','community','snow']){
  const m=mapFor(theme),owners=new Set(m.walk.obstacles.map(o=>o.prop??o.name??o.id));
  for(const p of m.world.props){
   if(/^Curved .*bench/i.test(p.name??'')){
    assert.ok(owners.has(p.id),`${theme}: ${p.id} retains its bench blocker`);benches++;
   }
   if(/^(?:tree|bush|pine|shrub|hedge)[-.]/.test(p.src.split('/').at(-1))){
    assert.equal(owners.has(p.id),false,`${theme}: ${p.id} plant is walkable`);plants++;
   }
  }
 }
 assert.ok(benches>=30);assert.ok(plants>=500);
 for(const [theme,id] of [['pink','hamlet-teacup-tea-story-west'],['pink','hamlet-teacup-tea-story-south'],['pink','hamlet-ribbonwick-ribbon-drying-line'],['library','lib-globe'],['pink','rosy-wind-key']]){
  const m=mapFor(theme);assert.ok(m.walk.obstacles.some(o=>(o.prop??o.name??o.id)===id),id+' work prop/sculpture retains its full contour');
 }
 const n=mapFor('sunflower').nav();
 for(const point of [[4870,1232.8],[5820,1326.4],[2010,2165.6],[5898.7,4786.33]])
  assert.equal(n.walkable(...point),false,`anonymous original building/furniture ${point}`);
});
