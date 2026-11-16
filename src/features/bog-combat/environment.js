import {normalizeBogBlockers} from './blockers.js';

export function combatForBogEnvironment({map,islandId,deferNavigation=false},records,areas) {
  // The client prepares the shared map before joining. Resolve its navigation
  // on use so importing combat does not eagerly load the island outline asset.
  const navigation=deferNavigation?Object.fromEntries(['walkable','route','nearest','clearLine'].map(key=>[key,(...args)=>map.nav()[key](...args)])):map.nav();
  const blockers=normalizeBogBlockers(records);
  const bases={karma:['karma-nw','karma-sw'],evil:['evil-ne','evil-se']};
  let positions;
  const pads=team=>{
    positions??=Object.fromEntries(Object.entries(bases).map(([team,ids])=>[team,ids.map(base=>{
      const area=areas[base];if(!area)throw new Error(`Missing Bog base: ${base}`);
      const [x,y]=area.pad??[area.x,area.y+240];
      const pad={x,y,base};
      if(!navigation.walkable(pad.x,pad.y))throw new Error(`Blocked Bog base pad: ${base}`);
      return Object.freeze(pad);
    })]));
    return positions[team]??[];
  };
  // Bounds are available without decoding the walking props.
  const origin=map.origin??map.world.origin;
  return {islandId,navigation,blockers,pads,
    bounds:{x0:origin?.x??0,y0:origin?.y??0,width:map.width,height:map.height},
    isBonusZone:point=>areas['site-a']&&Math.hypot(point.x-areas['site-a'].x,point.y-areas['site-a'].y)<420,
  };
}
