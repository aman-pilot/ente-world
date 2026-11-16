import {mapPoint} from './sphere-coordinates.js';
import {nearestSeaX} from './flat-layout.js';
// Project a server pose into the viewer's local chart and nearest periodic image.
export function seaViewPose(viewer,pose,reach=Infinity){
 const p=mapPoint(pose.islandId,viewer.islandId,pose);
 const x=nearestSeaX(p.x,viewer.x);
 if(Math.hypot(x-viewer.x,p.y-viewer.y)>reach)return null;
 return {...pose,x,y:p.y};
}
