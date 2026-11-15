export const BOG_OUTLINE_PIXELS=3;
export const BOG_TEAM_COLOURS=Object.freeze({
  karma:Object.freeze({body:0xFFD525,ring:0xFFD525,rim:0xFFFFFF}),
  evil:Object.freeze({body:0xEF5144,ring:0xEF5144,rim:0x23182F}),
});

export function createBogReadability(rig) {
  const root=rig.root,previous=root.filters;
  let alpha=null,cached=false;
  return {update(inBush=false,spawnHidden=false,dt=0,reducedMotion=false){
    const target=spawnHidden?.4:inBush?.5:1;
    // Hide immediately; ease back to full colour when concealment ends.
    alpha=alpha===null||target<alpha||reducedMotion?target:alpha+(target-alpha)*(1-Math.exp(-Math.max(0,dt)/.06));
    if(Math.abs(alpha-target)<.001)alpha=target;
    root.tint=0xFFFFFF;
    if(alpha<1){
      // Cache the complete animated rig at full strength, then fade the single cached quad.
      // Unlike inherited part alpha, this also isolates ground marks beneath the body.
      if(!cached){root.filters=null;root.cacheAsTexture({resolution:1,antialias:true});cached=true;}
      root.updateCacheTexture();
    }else if(cached){root.cacheAsTexture(false);root.filters=previous;cached=false;}
    root.alpha=alpha;
  },dispose(){
    if(root.destroyed)return;
    if(cached){root.cacheAsTexture(false);root.filters=previous;cached=false;}
    root.alpha=1;
  }};
}
