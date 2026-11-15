import packed from '../../../assets/world/themes/bog-arena/scene-pack.json' with {type:'json'};
import {createIslandScene} from './scene.js';
const readPacked=async()=>packed;
const scene=createIslandScene(packed,'bog-arena',readPacked);
export const bogSceneReady=scene.ready,loadBogScene=scene.load,outlineBogProps=scene.outline;
