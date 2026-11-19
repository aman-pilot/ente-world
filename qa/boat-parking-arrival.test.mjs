import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {PARKING_GAP} from '../src/gameplay/islands.js';

test('arriving boats reserve separate water before commit, survive restart and reject a full shore',async t=>{
  const source=`
    import {WorldService} from './worker/world-service.js';
    import {IslandSimulation} from './worker/simulation.js';
    import {WorldPresence} from './worker/world-presence.js';
    import {simulationStub,worldStub,internalPost} from './server/simulation-routing.js';
    import {boatSpots,boardingPoint,canSail} from './src/gameplay/islands.js';
    export {WorldPresence};
    export class Directory extends WorldService {
      async fetch(request){
        const path=new URL(request.url).pathname;
        if(path==='/simulation/transfer-state'){
          const {id}=await request.json();
          if(id.startsWith('parking-'))return Response.json({state:this.ctx.storage.kv.get(id)??'prepared'});
        }
        if(path==='/fixture/abort'){
          this.ctx.storage.kv.put((await request.json()).id,'aborted');
          return new Response(null,{status:204});
        }
        if(path==='/simulation/abort'){
          const {id}=await request.json();
          if(id.startsWith('parking-')){this.ctx.storage.kv.put(id,'aborted');return Response.json({state:'aborted'});}
        }
        return super.fetch(request);
      }
    }
    export class Island extends IslandSimulation {
      async fetch(request){
        if(!this.room)return super.fetch(request);
        const path=new URL(request.url).pathname,room=this.room;
        if(path==='/fixture/stage'){
          const {id}=await request.json(),boat={id,islandId:'home',...boatSpots('home')[4],occupant:null};
          boat.landing=boardingPoint(boat);
          return room.fetch(new Request('https://island.internal/stage',{method:'POST',body:JSON.stringify({
            id,account:id,generation:1,destination:'home',ack:0,boat,
            actor:{id:'rider-'+id,islandId:'home',mode:'walking',...boat.landing}
          })}));
        }
        if(path==='/fixture/state')return Response.json({boats:room.boats,reserved:[...room.parkingReservations.values()],
          incoming:room.sql.exec('SELECT id,payload FROM incoming').toArray()});
        if(path==='/fixture/activate'){
          const {id}=await request.json(),row=room.sql.exec('SELECT * FROM incoming WHERE id=?',id).toArray()[0];
          if(row)room.activateArrival(row);
          return new Response(null,{status:204});
        }
        if(path==='/fixture/fill'){
          const p=boatSpots('home')[4];room.boats=[];
          for(let x=-900;x<=900;x+=80)for(let y=-900;y<=900;y+=80){
            const q={x:p.x+x,y:p.y+y};
            if(canSail(q.x,q.y,'home'))room.boats.push({id:'crowd-'+x+'/'+y,islandId:'home',...q,occupant:null});
          }
          room.saveBoats();return new Response(null,{status:204});
        }
        if(path==='/fixture/restore'){
          const id='parking-rejected',boat={id,islandId:'home',...boatSpots('home')[4],occupant:null};
          boat.landing=boardingPoint(boat);
          const before={actor:{id:'sailor',islandId:'blossom',mode:'sailing',boatId:id,x:4000,y:11000},
            boat:{id,islandId:'blossom',occupant:'sailor',x:4000,y:11000}};
          const data={id,account:id,digest:id,generation:1,destination:'home',boat,before,
            actor:{id:'sailor',islandId:'home',mode:'walking',...boat.landing}};
          room.sql.exec('INSERT INTO outgoing VALUES(?,?)',id,JSON.stringify(data));
          await room.finishTransfer(data);
          return Response.json({before,boats:room.boats,
            restored:JSON.parse(room.sql.exec('SELECT pose FROM resumes WHERE account=?',id).one().pose),
            outgoing:room.sql.exec('SELECT id FROM outgoing').toArray(),
            departed:room.sql.exec('SELECT account FROM departed_generations').toArray()});
        }
        return super.fetch(request);
      }
    }
    export default {async fetch(request,env){
      const path=new URL(request.url).pathname;
      if(path==='/abort')return internalPost(worldStub(env,'parking-qa'),'/fixture/abort',await request.json());
      const island=simulationStub(env,'parking-qa',path==='/restore'?'blossom':'home');
      await island.fetch('https://island.internal/fixture/state');
      return island.fetch(new Request('https://island.internal/fixture'+path,request));
    }};`;
  const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
  const storage=await mkdtemp(join(tmpdir(),'boat-parking-arrival-'));
  const start=()=>new Miniflare(convertV4MiniflareOptions({resourcePersistencePath:storage,
    modules:[{type:'ESModule',path:'index.js',contents:bundle.outputFiles[0].text}],compatibilityDate:'2026-11-02',
    durableObjects:Object.fromEntries(Object.entries({ISLAND:'Directory',ISLAND_SIM:'Island',WORLD_PRESENCE:'WorldPresence'})
      .map(([key,className])=>[key,{className,useSQLite:true}]))}));
  let runtime=start();
  t.after(async()=>{await runtime.dispose();await rm(storage,{recursive:true,force:true});});
  const request=(path,data)=>runtime.dispatchFetch('https://game.test'+path,data?{method:'POST',body:JSON.stringify(data)}:{});
  const state=async()=>await (await request('/state')).json();
  assert.deepEqual((await Promise.all(['parking-a','parking-b'].map(id=>request('/stage',{id})))).map(r=>r.status),[204,204]);
  const staged=await state();
  assert.equal(staged.boats.length,0,'staging does not duplicate owned boats');
  assert.equal(staged.reserved.length,2);
  const [a,b]=staged.reserved;
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=PARKING_GAP,'simultaneous arrivals cannot reserve overlapping berths');
  assert.equal((await request('/stage',{id:'parking-a'})).status,204);
  assert.deepEqual((await state()).incoming,staged.incoming,'retry preserves the reservation and journal');
  await runtime.dispose();runtime=start();
  assert.deepEqual((await state()).reserved,staged.reserved,'restart restores reservations before admitting boats');
  await request('/activate',{id:'parking-a'});
  await request('/activate',{id:'parking-a'});
  const activated=await state();
  assert.equal(activated.boats.filter(boat=>boat.id==='parking-a').length,1);
  const pose=boat=>({x:boat.x,y:boat.y,landing:boat.landing,occupant:boat.occupant});
  assert.deepEqual(pose(activated.boats[0]),pose(a),'activation uses the reserved position');
  assert.equal(activated.reserved.length,1);
  await request('/abort',{id:'parking-b'});
  assert.equal((await request('/stage',{id:'parking-c'})).status,204);
  assert.ok(!(await state()).incoming.some(row=>row.id==='parking-b'),'aborted reservations release their space');
  await request('/fill');
  const full=await state();
  assert.equal((await request('/stage',{id:'parking-full'})).status,409);
  assert.deepEqual(await state(),full,'full shore cannot stage, release or move another boat');
  const rejected=await (await request('/restore')).json();
  assert.deepEqual(rejected.restored,rejected.before.actor,'failed destination admission restores the original sailor');
  assert.equal(rejected.boats.length,1);
  assert.equal(rejected.boats[0].occupant,rejected.before.actor.id,'the sailor retains the same boat');
  assert.deepEqual(rejected.outgoing,[],'a full shore cannot leave an endless prepared retry');
  assert.deepEqual(rejected.departed,[],'ownership was never committed to the full island');
});
