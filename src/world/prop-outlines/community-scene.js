import packed from '../../../assets/world/themes/community/scene-pack.json' with {type:'json'};
import {createIslandScene} from './scene.js';
const readPacked=async()=>packed;
const scene=createIslandScene(packed,'community',readPacked);
export const communitySceneReady=scene.ready,loadCommunityScene=scene.load,outlineCommunityProps=scene.outline;
