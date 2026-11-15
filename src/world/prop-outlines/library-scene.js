import packed from '../../../assets/world/themes/library/scene-pack.json' with {type:'json'};
import {createIslandScene} from './scene.js';
const readPacked=async()=>packed;
const scene=createIslandScene(packed,'library',readPacked);
export const librarySceneReady=scene.ready,loadLibraryScene=scene.load,outlineLibraryProps=scene.outline;
