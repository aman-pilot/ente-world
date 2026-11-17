import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapOf} from '../src/world/island-maps.js';
import {placeRigid,unplaceRigid} from '../src/world/rigid.js';
import {withRigidVisitors} from '../src/rendering/shared/rigid-visitors.js';
const source=fs.readFileSync(new URL('../src/rendering/pixi/engine.js',import.meta.url),'utf8');
// Exercise the production render pass without a GPU or browser.
const render=source.slice(source.indexOf('  renderLiveCopies('),source.indexOf('  rigidReadback('));
const update=source.slice(source.indexOf('  updateBridgeOver('),source.indexOf('  dispose() {',source.indexOf('  updateBridgeOver(')));
const Engine=new Function('unplaceRigid','withRigidVisitors','drawLiveIsland','cameraSpan','TILT',`return class {${render}\n${update}}`);
const cases=[['home','home','blossom',1376,3456,'home-west-bridge'],['blossom','sunflower','home',1440,4576,'original-1'],['isle-251','library','home',736,960,'pagepond-west'],['sunset','pink','home',1664,4768,'rosewater-promenade'],['isle-250','community','home',1024,1344,'campfire-northwest']];
for(const [id,theme,from,x,y,name] of cases)test(`passing boat stays under ${theme} arch in a nearby island copy`,()=>{
 const data=JSON.parse(fs.readFileSync(theme==='home'?'src/world/home/home-expansion.json':`public/pixi-art/themes/${theme}/art.json`));
 const deck=data.decks.find(d=>(d.bridgeId??d.id)===name);assert.ok(deck,name+' exists in the real deck inventory');
 const local={x,y:y-50},foreign=placeRigid(from,id,local),cover={x0:deck.x-20,x1:deck.x+deck.width+20,y0:deck.y,y1:deck.y+deck.height+40,sprite:{visible:false}};
 let draws=0,fail=false;
 const C=Engine(unplaceRigid,withRigidVisitors,()=>{draws++;assert.equal(cover.sprite.visible,true,'cover is above the boat during drawing');if(fail)throw Error('render failed');},()=>({width:1440,height:900}),.65);
 const e=new C();Object.assign(e,{islandId:from,artShown:mapOf(from).id,bridgeOver:theme==='home'?[cover]:[],arts:new Map(theme==='home'?[]:[[theme,{bridgeOver:[cover]}]]),bridgeSailers:[foreign],camera:{...foreign,zoom:1},width:1440,height:900,archipelago:{root:{visible:true}},ocean:{visible:true},scene:{visible:true},app:{renderer:{}},mapSleepers:new Map(),transientForCopies:()=>[],artProps:()=>[],sleeperRigs:()=>[],showArt:()=>{}});
 const departureArt=e.artShown;e.artShown=theme;e.updateBridgeOver([local]);assert.equal(cover.sprite.visible,true,'own-frame control');e.artShown=departureArt;cover.sprite.visible=false;
 const copy={id,map:theme};e.renderLiveCopies(undefined,[copy]);assert.equal(draws,1);assert.equal(cover.sprite.visible,false,'main cover state restores');assert.deepEqual(e.bridgeSailers,[foreign],'sailor coordinates restore');
 fail=true;assert.throws(()=>e.renderLiveCopies(undefined,[copy]),/render failed/);assert.equal(cover.sprite.visible,false,'cover state restores after failure');
});
