import {islandHouseCut} from './home-house-rule.mjs';
import {blocks} from '../src/world/walk-rule.js';
import {boardingPoint} from '../src/gameplay/islands.js';
const walkMoves={"lib-339":{"x":2818.74,"y":705.07},"lib-340":{"x":3412.9,"y":690.9},"lib-54":{"x":1037.1,"y":2666.7},"hamlet-paperboat-mooring-post-midwest":{"x":8095.15,"y":6758.82},"hamlet-paperboat-mooring-post-mideast":{"x":8897.5,"y":6821.25},"lib-166":{"x":3247.8,"y":1060.3},"lib-10":{"x":3552.7,"y":1912.13},"lib-128":{"x":3343.44,"y":1163.47}};
import {changedIds} from '../scripts/pagepond-benches/geometry.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {makeMap} from '../src/world/island-maps.js';import {geometry,inPoly,inShape} from '../assets/world/island-geometry.mjs';import {checkTheme} from '../scripts/theme-index.mjs';
const read=f=>JSON.parse(fs.readFileSync(f));const d='assets/world/themes/library/',a='public/pixi-art/themes/library/',base='scripts/bigger-library/original/';
const world=read(d+'world.json'),walk=read(d+'walk-world.json'),art=read(a+'art.json'),harbor=read(d+'harbor.json'),old=read(base+'world.json'),oldArt=read(base+'art.json'),plan=read('scripts/bigger-library/plan.json');
// lib-256 is the POND/BREAD/HOME name signpost, removed with the other island name boards
const cleared=new Set([...read('scripts/pagepond-bridges/report.json').clearedLandscape,...read('scripts/pagepond-bridges/report.json').retiredBridgeParts,'lib-256']);
const meadowWater=read('scripts/pagepond-meadow/placements.json').waterRegions;
const inMeadowWater=(x,y)=>meadowWater.some(w=>inShape(x,y,w,20));
const checked=checkTheme('library'),map=makeMap('library',{world,walk,harbor,sleepers:checked.sleepers}),geo=geometry(map.walk);
test('bigger library preserves original composition, canal, sleepers and dry-land geometry',()=>{
 assert(checked.ready,checked.problems.join('\n'));assert.equal(checked.sleepers.length,250);const swaps=new Map(JSON.parse(fs.readFileSync('scripts/pagepond-b/placements.json')).planting.replace.map(p=>[p.id,p]));for(const p of oldArt.props){if(cleared.has(p.id)||p.id==='lib-25'||p.id==='close-arc-0--45')continue;const q=art.props.find(q=>q.id===p.id);assert(q,p.id+' retained');for(const k of changedIds.has(p.id)?[]:['x','y','anchor','flip'])assert.deepEqual(q[k],walkMoves[p.id]?.[k]??p[k],p.id+' '+k);if(!changedIds.has(p.id))assert.equal(q.src,swaps.get(p.id)?.src??p.src);}for(const k of ['flats','floating'])for(const p of oldArt[k])assert(art[k].some(q=>JSON.stringify(q)===JSON.stringify(p)),p.src+' retained');for(const deck of oldArt.decks.filter(d=>!d.src.startsWith('canal-bridge')))assert(art.decks.some(d=>d.src===deck.src),deck.src);assert.equal(art.decks.filter(d=>d.homeSource).length,17);const benchSolids=new Map(read('scripts/pagepond-benches/placement.json').map(b=>[b.originalObstacleIndex??b.obstacleIndex,{poly:b.footprint,name:b.id}]));for(const [i,o]of old.obstacles.entries()){if(cleared.has(o.name)||!o.name&&read('scripts/pagepond-bridges/report.json').clearedProps.some(p=>Math.abs(o.x-p.x)<2&&Math.abs(o.y-p.y)<40))continue;let expected=structuredClone(benchSolids.get(i)??o);if(walkMoves[o.name]){const prior=oldArt.props.find(p=>p.id===o.name),dx=walkMoves[o.name].x-prior.x,dy=walkMoves[o.name].y-prior.y;if(expected.poly)expected.poly=expected.poly.map(([x,y])=>[x+dx,y+dy]);else{expected.x+=dx;expected.y+=dy;}}assert(world.obstacles.some(o=>JSON.stringify(o)===JSON.stringify(expected)),'retained obstacle '+(o.name??i));}assert.equal(world.water[0].name,'Pagepond reading pond');for(const p of world.water[0].poly)assert(inShape(...p,old.water[0]),'organic pond stays inside original water reserve');assert.deepEqual(world.water.slice(1,old.water.length),old.water.slice(1));for(const w of old.walkways.slice(5))assert(world.walkways.some(q=>JSON.stringify(q.a)===JSON.stringify(w.a)&&JSON.stringify(q.b)===JSON.stringify(w.b)),'retained pier');assert.deepEqual(world.paths,old.paths);
 const oldGeo=geometry({...old,obstacles:[],walkways:[],bridges:[]}),newGeo=geometry({...world,obstacles:[]});for(let y=450;y<5150;y+=29)for(let x=450;x<7550;x+=29)if(oldGeo.walkable(x,y))assert(newGeo.walkable(x,y)||inMeadowWater(x,y),`original land lost ${x},${y}`);
 for(let y=1100;y<4800;y+=170)for(let x=3900;x<4250;x+=29)if(!inPoly(x,y,old.coast))assert(!inPoly(x,y,world.coast),`canal filled ${x},${y}`);
});
test('bigger library destinations, coast walks and moorings are reachable with visible matched solids',()=>{
 const nav=map.nav();for(const z of plan.places){assert(geo.walkable(...z.spawn),z.id+' spawn');assert(nav.route(map.spawn.x,map.spawn.y,...z.spawn).length,z.id+' route');}
 for(const p of art.props.slice(oldArt.props.length)){assert(p.kind==='boat'||p.parent==='hamlet-paperboat-south-jetty'?!map.landAt(p.x,p.y):inPoly(p.x,p.y,world.coast),p.id+' correct land/water placement');const outlined=map.world.props.find(q=>q.id===p.id);for(const o of [outlined?.footprint].filter(o=>o&&blocks(o,outlined)))for(const ring of [o.poly,...(o.parts??[])])for(const point of ring.filter(point=>islandHouseCut(o)===null||point[1]>=islandHouseCut(o)))assert(!geo.walkable(...point),p.id+' traced solid contact');}
 for(const b of map.boatSpots()){assert(!map.landAt(b.x,b.y),'boat in water');const landing=boardingPoint({...b,islandId:'isle-251'},nav),shore=[landing.x,landing.y];assert(nav.walkable(...shore),`no boarding land ${b.x},${b.y}`);assert(Math.hypot(shore[0]-b.x,shore[1]-b.y)<=280,'boarding within reach');assert(nav.route(map.spawn.x,map.spawn.y,...shore).length,'mooring reachable');}
 assert(nav.route(map.spawn.x,map.spawn.y,map.HARBOR.land.x,map.HARBOR.land.y).length,'jetty route');
});
test('bigger library has about three times the land and GPU-safe, budgeted textures',()=>{
 const area=p=>Math.abs(p.reduce((s,a,i)=>{let b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2),ratio=world.coastRings.reduce((s,r)=>s+area(r),0)/old.coastRings.reduce((s,r)=>s+area(r),0);assert(ratio>=2.8&&ratio<=3.6,ratio);
 let bytes=0;for(const t of art.ground.tiles){const svg=fs.readFileSync(a+t.src,'utf8'),m=svg.match(/<svg[^>]*width="([\d.]+)" height="([\d.]+)"/),w=+m[1],h=+m[2];assert(w<=1536&&h<=1536,t.src);bytes+=w*h*4;}assert(bytes<350e6,'ground base allocation <350 MB');
});
// Reviewed ground approaches to historical painted stations. Fixed offsets make
// a newly blocked approach fail instead of searching for a different passing point.
// Values are [distance, direction in 15-degree steps] from the authored station.
const stationOffsets={
 "west-north-lane":{"54":[16,0],"77":[48,0],"98":[48,0],"140":[48,10],"161":[64,11],"241":[48,10]},
 "west-spine":{"187":[144,0],"220":[272,2],"267":[416,0],"301":[336,14],"322":[160,14],"452":[48,9],"715":[48,17],"736":[80,16],"760":[112,4],"786":[128,22],"851":[64,22],"872":[80,5],"1201":[112,12],"1229":[96,20],"1250":[80,12],"1271":[80,0],"1665":[32,17],"1690":[64,0],"1779":[16,0],"1807":[112,21],"1828":[224,5],"1849":[208,7],"1881":[192,5],"1904":[288,3],"1931":[304,1],"1958":[304,23],"1979":[400,21],"2000":[560,21],"2021":[672,20],"2042":[640,3],"2064":[496,2],"2086":[368,1],"2163":[288,3],"2191":[208,5],"2215":[240,5],"2264":[80,4],"2351":[48,0],"2502":[48,10],"2523":[208,12],"2544":[304,16],"2565":[240,20],"2586":[192,19],"2607":[32,0],"2720":[32,17],"2741":[160,14],"2762":[304,13],"2783":[448,7],"2804":[640,8],"2826":[512,3],"2849":[384,4],"2874":[352,5],"2895":[496,7],"2916":[528,23],"2950":[368,23],"2978":[304,22],"3012":[144,20],"3045":[32,0],"3066":[96,0],"3096":[32,0],"3291":[32,0],"3320":[128,11]},
 "east-spine":{"0":[144,18],"21":[64,10],"116":[112,6],"137":[160,3],"170":[48,0],"1132":[16,17],"1153":[160,4],"1177":[32,3],"1240":[96,15],"1267":[144,17],"1314":[16,5],"1366":[16,0],"1429":[64,19],"1481":[32,2],"1510":[32,0],"1531":[32,16],"1552":[112,7],"1578":[64,10],"1627":[32,0],"1648":[176,0],"1675":[96,5],"2229":[64,0],"2250":[128,0],"2271":[160,11],"2292":[48,10],"2488":[128,19],"2511":[80,4],"2544":[16,2],"2623":[32,16],"2647":[16,14],"2903":[96,21],"2926":[144,8],"3394":[128,4],"3415":[16,0]},
 "west-north-heart":{"54":[160,12],"81":[320,12],"104":[432,11],"151":[352,21],"178":[176,21]},
 "west-south-heart":{"0":[32,0],"1":[48,20]},
 "east-south-heart":{"0":[96,0],"21":[176,8],"52":[96,5],"116":[176,23],"142":[64,10],"340":[32,0],"371":[128,4],"402":[80,4]},
 "east-south-return":{"36":[80,4],"61":[192,6],"97":[240,22],"124":[192,8],"165":[288,6],"196":[160,17],"340":[144,18]},
 "quillwick-entrance-0":{"0":[112,11]},
 "quillwick-entrance-2":{"105":[64,11],"126":[224,12],"160":[384,7],"176":[432,0]},
 "inkleaf-entrance-0":{"0":[144,6],"21":[80,21],"42":[64,18],"63":[112,0]},
 "inkleaf-entrance-1":{"0":[112,19],"44":[16,2],"88":[96,11]},
 "inkleaf-entrance-2":{"53":[32,0]},
 "inkleaf-entrance-3":{"26":[32,4],"65":[112,11],"87":[96,17],"170":[112,7],"185":[160,15]},
 "bedtime-entrance-0":{"0":[16,16],"37":[128,21],"58":[160,5],"79":[96,2],"106":[144,14],"130":[48,11]},
 "bedtime-entrance-1":{"0":[16,15],"39":[80,4],"142":[96,18],"153":[192,18]},
 "bedtime-entrance-2":{"0":[96,16],"21":[16,13],"61":[64,21],"86":[224,21],"118":[256,4],"146":[144,7],"164":[48,5]},
 "paperboat-entrance-0":{"93":[32,5],"123":[128,17],"144":[16,16]},
 "paperboat-entrance-1":{"0":[64,17],"51":[16,15],"84":[16,9],"105":[16,13],"243":[64,0],"264":[112,18],"285":[64,22],"306":[64,16],"327":[32,0],"350":[32,14]},
 "centre-0":{"71":[144,15],"94":[256,17],"115":[272,4],"138":[176,2],"159":[96,0],"180":[16,20]},
 "centre-1":{"84":[32,17]},
 "centre-2":{"42":[48,15],"77":[64,19],"112":[112,21],"141":[112,0],"162":[16,20]},
 "centre-3":{"287":[16,10],"313":[96,11],"339":[144,19]},
 "centre-4":{"123":[64,15],"144":[64,19],"148":[64,17]},
 "centre-6":{"22":[16,15],"44":[128,20],"73":[64,8],"98":[48,5],"128":[16,0],"136":[64,20]},
 "centre-7":{"91":[16,7],"92":[16,7]},
 "centre-8":{"129":[32,15],"150":[16,8],"217":[32,11],"238":[32,10]},
 "centre-9":{"0":[48,19],"46":[112,6],"71":[96,8],"93":[112,5],"114":[32,0]},
 "centre-11":{"0":[96,20],"21":[112,0],"47":[80,15],"226":[32,19],"247":[192,3],"268":[128,5],"354":[112,18],"389":[64,11],"414":[64,4],"420":[112,13],"441":[112,19],"505":[16,2],"526":[160,6],"553":[336,6],"574":[400,21],"597":[336,6],"621":[176,7],"643":[16,0]},
 "centre-12":{"86":[48,17],"88":[48,19]},
 "hamlet-quillwick-ink-and-quill-shop-door":{"0":[16,8],"35":[32,16]},
 "hamlet-quillwick-green-book-cottage-door":{"12":[16,0]},
 "hamlet-inkleaf-cottage-lavender-book-door":{"0":[16,7],"89":[32,0],"162":[64,3],"177":[32,5]},
 "hamlet-inkleaf-cottage-blue-book-door":{"114":[96,19]},
 "hamlet-inkleaf-cottage-coral-book-door":{"0":[48,0],"96":[16,0],"117":[16,0],"201":[16,0],"222":[16,0],"316":[48,14]},
 "hamlet-bedtime-cottage-blue-door":{"0":[144,6],"22":[80,5],"51":[16,13],"160":[32,17]},
 "hamlet-bedtime-cottage-lavender-door":{"0":[144,5],"23":[96,14]},
 "hamlet-bedtime-cottage-sage-door":{"0":[288,7],"53":[384,21],"86":[240,20],"107":[224,21],"132":[192,19],"189":[48,0],"259":[48,13],"262":[48,11]},
 "hamlet-bedtime-cottage-coral-door":{"0":[16,15],"145":[80,16],"148":[64,16]},
 "hamlet-bedtime-moon-book-hall-door":{"0":[144,5],"10":[64,6]},
 "hamlet-paperboat-cottage-green-door":{"55":[32,0]},
 "hamlet-paperboat-cottage-blue-door":{"0":[16,14],"21":[128,16],"46":[64,4],"135":[48,16],"207":[48,19]},
 "hamlet-paperboat-cottage-lilac-door":{"0":[32,18],"94":[64,0],"107":[144,0]},
 "paperboat-jetty-approach":{"68":[128,0],"69":[144,0]},
 "pagepond-stargazing-lane":{"0":[16,9],"2":[224,14],"4":[208,17]},
 "honeywood-bridge-0-b":{"2":[32,12]},
 "honeywood-bridge-9-b":{"2":[16,13]}
};
test('Pagepond clears old villages and spurs while retaining connected main routes',()=>{
 assert.equal(plan.places.length,4);
 assert.equal(plan.homes.length,0,'old homes retired for the approved hamlets');
 assert(!art.props.some(p=>p.id.startsWith('bigger-')),'no old outer houses, workplaces, stalls, benches or trees');
 assert(!world.obstacles.some(o=>o.name?.startsWith('bigger-')),'no invisible old village solids');
 assert(plan.roads.some(r=>r.id==='west-spine'));assert(plan.roads.some(r=>r.id==='east-spine'));assert(plan.roads.every(r=>[104,128].includes(r.width)),'Home widths');
 const nav=map.nav();for(const road of plan.roads){let last=null;for(const [i,[x,y]]of road.points.entries()){if(i&&i<road.points.length-1&&last&&Math.hypot(x-last[0],y-last[1])<160)continue;last=[x,y];
  const [radius,angle]=stationOffsets[road.id]?.[i]??[0,0];
  const station=[x+radius*Math.cos(angle*Math.PI/12),y+radius*Math.sin(angle*Math.PI/12)];
  const route=nav.route(map.spawn.x,map.spawn.y,...station);
  assert(station,road.id+' traversable station '+x+','+y);
  assert(nav.walkable(...station),road.id+' station outside solid art');
  assert.deepEqual(route.at(-1),station,road.id+' connected station');
 }}
});

test('library rivers carry every crossing and prevent walking through open water',()=>{
 assert(world.water.length>old.water.length,'sea-connected moats and open river pieces');
 assert.deepEqual(walk.water,world.water);
 for(const [x,y]of [[760,1000],[7190,1010],[6732,5060]])assert(world.water.some(w=>inShape(x,y,w)),`old jetty water ${x},${y}`);
 for(const c of plan.crossings){assert(world.water.some(w=>inShape(c.x,c.y,w)),c.id+' wet');assert(geo.walkable(c.x,c.y),c.id+' deck');assert(map.nav().route(map.spawn.x,map.spawn.y,c.x,c.y).length,c.id+' accessible');}
 assert(!geo.walkable(-490,2502),'retired stepping stones are open water');
 for(const [x,y]of [[-650,2520],[8600,2900],[5900,5380]])assert(!geo.walkable(x,y),'river blocks '+x+','+y);
 const wetless=geometry({...world,obstacles:[]});for(let y=450;y<5150;y+=20)for(let x=450;x<7550;x+=20)if(geometryOld.walkable(x,y))assert(wetless.walkable(x,y)||inMeadowWater(x,y),'original ground/deck '+x+','+y);

});
const geometryOld=geometry({...old,obstacles:[],walkways:[],bridges:[]});
