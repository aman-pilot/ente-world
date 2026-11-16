import packed from '../../../assets/world/themes/snow/scene-pack.json' with {type:'json'};
import {createIslandScene} from './scene.js';
const readPacked=async()=>packed;
const scene=createIslandScene(packed,'snow',readPacked);
export const snowSceneReady=scene.ready,loadSnowScene=scene.load,outlineSnowProps=scene.outline;
