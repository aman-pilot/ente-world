import {geometry} from '../../assets/world/island-geometry.mjs';
// Searches complete synchronously, including the fine-grid fallback. All maps
// can reuse the largest workspace without retaining one allocation per island.
let workspace,stepWorkspace,fineNavigation;
export function createNavigation(world,{cellSize=world.navigationCellSize??32,walkable:customWalkable}={}){
const walkable=customWalkable??geometry(world).walkable;
const X0=world.origin?.x ?? 0,Y0=world.origin?.y ?? 0;
const CELL=cellSize,COLS=Math.ceil(world.width/CELL),ROWS=Math.ceil(world.height/CELL);
const size=COLS*ROWS,grid=new Uint32Array(Math.ceil(size/32));
const open=id=>id>=0&&id<size&&(grid[id>>5]>>>(id&31)&1);
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(walkable(X0+(x+.5)*CELL,Y0+(y+.5)*CELL)){const i=y*COLS+x;grid[i>>5]|=1<<(i&31);}
// Rank open cells so reusable search and step workspaces never allocate sea
// cells. Prefixes cost one integer per 32 grid cells, with exact cell ids intact.
function popcount(v){v-=v>>>1&0x55555555;v=(v&0x33333333)+(v>>>2&0x33333333);return ((v+(v>>>4)&0x0f0f0f0f)*0x01010101)>>>24;}
const prefixes=new Uint32Array(grid.length);let openCount=0;
for(let i=0;i<grid.length;i++){prefixes[i]=openCount;openCount+=popcount(grid[i]);}
const slot=id=>prefixes[id>>5]+popcount(grid[id>>5]&((1<<(id&31))-1));
function point(id){return [X0+(id%COLS+.5)*CELL,Y0+(Math.floor(id/COLS)+.5)*CELL];}
// Disjoint grid regions cannot have an A* route. Four-neighbour labels are
// conservative: a permitted diagonal already requires both adjacent cells.
// Thin contours may split a label further, so normal line checks still decide.
const components=(world.theme==='library'||world.theme==='community')?(() => {
 const labels=new Uint32Array(openCount),queue=new Uint32Array(openCount);let label=0;
 for(let i=0;i<size;i++)if(open(i)&&!labels[slot(i)]){
  let head=0,tail=1;queue[0]=i;labels[slot(i)]=++label;
  while(head<tail){const cur=queue[head++],x=cur%COLS;
   for(const next of [x?cur-1:-1,x+1<COLS?cur+1:-1,cur-COLS,cur+COLS])
    if(next>=0&&next<size&&open(next)&&!labels[slot(next)]){labels[slot(next)]=label;queue[tail++]=next;}
  }
 }
 return label<=65535?Uint16Array.from(labels):labels;
})():null;
const stepOwner={};
function stepClear(cur,dx,dy,n){
 if(!stepWorkspace||stepWorkspace.cells.length<openCount*2)stepWorkspace={owner:stepOwner,cells:new Uint8Array(openCount*2)};
 else if(stepWorkspace.owner!==stepOwner){stepWorkspace.cells.fill(0);stepWorkspace.owner=stepOwner;}
 const STEP=stepWorkspace.cells;
 const direction=(dy+1)*3+(dx+1),d=direction>4?direction-1:direction,k=slot(cur)*2+(d>>2),shift=(d&3)*2;
 let state=STEP[k]>>shift&3;
 if(!state){state=clearLine(point(cur),point(n))?1:2;STEP[k]|=state<<shift;}
 return state===1;
}
function cell(x,y){return Math.floor((y-Y0)/CELL)*COLS+Math.floor((x-X0)/CELL);}
function nearest(x,y,radius=150){
 if(walkable(x,y))return [x,y];
 for(let r=16;r<=radius;r+=16)for(let a=0;a<24;a++){let xx=x+Math.cos(a*Math.PI/12)*r,yy=y+Math.sin(a*Math.PI/12)*r;if(walkable(xx,yy))return [xx,yy];}
 return null;
}
function clearLine(a,b){let n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let i=1;i<=n;i++)if(!walkable(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;return true;}
function route(sx,sy,tx,ty){
 const near=nearest(tx,ty),target=near||shoreToward(sx,sy,tx,ty);if(!target)return [];
 if(clearLine([sx,sy],target))return [target];
 const path=search(sx,sy,target);if(path.length)return path;
 // Small restored-tree gaps can fall between the primary Home grid samples.
 if(CELL>8&&world.navigationCellSize===16&&walkable(tx,ty)){
  if(fineNavigation?.world!==world||fineNavigation.walkable!==walkable)
   fineNavigation={world,walkable,nav:createNavigation(world,{cellSize:8,walkable})};
  const fine=fineNavigation.nav.route(sx,sy,tx,ty);if(fine.length)return fine;
 }
 if(near)return path;
 const edge=reachToward(sx,sy,tx,ty);return edge?[edge]:[];
}
// Generation stamps share seen/closed state; parents store one of eight
// directions instead of a four-byte cell id. Costs keep Float32 rounding.
function search(sx,sy,target){
 function nearCell(x,y){const c=cell(x,y);if(open(c)&&clearLine([x,y],point(c)))return c;for(let r=1;r<6;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){let xx=Math.floor((x-X0)/CELL)+dx,yy=Math.floor((y-Y0)/CELL)+dy,id=yy*COLS+xx;if(xx>=0&&xx<COLS&&yy>=0&&yy<ROWS&&open(id)&&clearLine([x,y],point(id)))return id;}return -1;}
 const start=nearCell(sx,sy),end=nearCell(...target);if(start<0||end<0||components&&components[slot(start)]!==components[slot(end)])return [];
 let cost,parent,seen,generation;
 if(!workspace||workspace.cost.length<openCount)workspace={cost:new Float32Array(openCount),parent:new Uint8Array(openCount),seen:new Uint8Array(openCount),generation:0};
 if(workspace.generation===127){workspace.seen.fill(0);workspace.generation=0;}
 ({cost,parent,seen}=workspace);generation=++workspace.generation;
 const heap=[],endX=end%COLS,endY=Math.floor(end/COLS);
 const heuristic=components?id=>Math.hypot(id%COLS-endX,Math.floor(id/COLS)-endY):id=>{const a=point(id),b=point(end);return Math.hypot(a[0]-b[0],a[1]-b[1])/CELL;};
 function push(id,f){let i=heap.length;heap.push({id,f});while(i){let p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={id,f};}
 function pop(){let top=heap[0],end=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=end.f)break;heap[i]=heap[c];i=c;}heap[i]=end;}return top.id;}
 if(seen)seen[slot(start)]=generation;cost[slot(start)]=0;push(start,heuristic(start));let found=false;
 while(heap.length){let cur=pop(),curSlot=slot(cur);if(seen[curSlot]===(generation|128))continue;seen[curSlot]=generation|128;if(cur===end){found=true;break;}
 const x=cur%COLS,y=Math.floor(cur/COLS);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy,n=yy*COLS+xx;if(xx<0||yy<0||xx>=COLS||yy>=ROWS||!open(n))continue;const nSlot=slot(n);if(seen[nSlot]===(generation|128))continue;if(dx&&dy&&(!open(y*COLS+xx)||!open(yy*COLS+x)))continue;const nc=cost[curSlot]+(dx&&dy?Math.SQRT2:1);if(seen&&(seen[nSlot]&127)!==generation||nc<cost[nSlot]){if(!stepClear(cur,dx,dy,n))continue;if(seen)seen[nSlot]=generation;cost[nSlot]=nc;parent[nSlot]=(dy+1)*3+(dx+1);push(n,nc+heuristic(n));}}}
 if(!found)return [];
 const cells=[];for(let n=end;n!==start;n=n-(parent[slot(n)]%3-1)-(Math.floor(parent[slot(n)]/3)-1)*COLS)cells.push(point(n));cells.reverse();cells.push(target);
 const raw=[];
 for(const p of cells){
  while(raw.length>1){const a=raw.at(-2),b=raw.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],ex=p[0]-b[0],ey=p[1]-b[1];
   if(dx*ey!==dy*ex||dx*ex+dy*ey<=0)break;raw.pop();}
  raw.push(p);
 }
 let out=[],anchor=[sx,sy];for(let i=0;i<raw.length;){let j=i;while(j+1<raw.length&&clearLine(anchor,raw[j+1]))j++;out.push(raw[j]);anchor=raw[j];i=j+1;}return rounded(out,sx,sy);
}
function shoreToward(sx,sy,tx,ty){
 const len=Math.hypot(tx-sx,ty-sy),n=Math.min(400,Math.ceil(len/16));if(!n)return null;
 for(let i=1;i<=n;i++){const t=i/n;if(!walkable(tx+(sx-tx)*t,ty+(sy-ty)*t))continue;
  let lo=(i-1)/n,hi=t;for(let k=0;k<8;k++){const m=(lo+hi)/2;if(walkable(tx+(sx-tx)*m,ty+(sy-ty)*m))hi=m;else lo=m;}
  const inland=Math.min(1,hi+6/len),p=[tx+(sx-tx)*inland,ty+(sy-ty)*inland];return walkable(...p)?p:[tx+(sx-tx)*hi,ty+(sy-ty)*hi];}
 return null;
}
function reachToward(sx,sy,tx,ty){
 const len=Math.hypot(tx-sx,ty-sy),n=Math.min(400,Math.floor(len/12));let last=null;
 for(let i=1;i<=n;i++){const p=[sx+(tx-sx)*i/n,sy+(ty-sy)*i/n];if(!clearLine(last||[sx,sy],p))break;last=p;}
 return last&&Math.hypot(last[0]-sx,last[1]-sy)>8?last:null;
}
function rounded(path,sx,sy){
 if(path.length<2)return path;const out=[],last=()=>out.at(-1)||[sx,sy];
 for(let i=0;i<path.length;i++){const p=path[i],prev=i?path[i-1]:[sx,sy],next=path[i+1];if(!next){out.push(p);break;}
  const ax=prev[0]-p[0],ay=prev[1]-p[1],bx=next[0]-p[0],by=next[1]-p[1],la=Math.hypot(ax,ay),lb=Math.hypot(bx,by),r=Math.min(28,la*.4,lb*.4);
  if(r<4||(ax*bx+ay*by)/(la*lb)<-.985){out.push(p);continue;}
  const a=[p[0]+ax/la*r,p[1]+ay/la*r],b=[p[0]+bx/lb*r,p[1]+by/lb*r];
  const curve=[a,...[.25,.5,.75].map(t=>[0,1].map(k=>(1-t)*(1-t)*a[k]+2*(1-t)*t*p[k]+t*t*b[k])),b];
  if(clearLine(last(),a)&&curve.every((q,k)=>!k||clearLine(curve[k-1],q))&&clearLine(b,next))out.push(...curve);else out.push(p);}
 return out;
}

return {walkable,route,nearest,clearLine,rink:world.iceland2?.rink??null,icePaths:world.iceland2?.rink?world.iceland2.routes??[]:[]};
}
