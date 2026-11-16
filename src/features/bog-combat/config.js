import {mapFor} from '../../world/island-maps.js';
import {BOG_REVIEW_ISLAND,BOG_AREAS} from './bog-environment.js';
import {getBogBlockers} from './blockers.js';
import {combatForBogEnvironment} from './environment.js';

export const BOG_COMBAT=combatForBogEnvironment(
  {map:mapFor('bog'),islandId:BOG_REVIEW_ISLAND,deferNavigation:true},getBogBlockers(),BOG_AREAS,
);
