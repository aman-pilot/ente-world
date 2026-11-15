import packed from '../../../assets/world/themes/pink/scene-pack.json' with {type:'json'};
import {createIslandScene} from './scene.js';
const readPacked=async()=>packed;
const scene=createIslandScene(packed,'pink',readPacked);
export const pinkSceneReady=scene.ready,loadPinkScene=scene.load,outlinePinkProps=scene.outline;
