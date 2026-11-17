import test from 'node:test';
import {assertReachable} from './lib/audit-reachability.mjs';
test('Home stall front, bakery courtyard and lamp gaps connect to spawn both ways',()=>assertReachable('home',[
 ['H-W01 stall customer front',2416,2090],['H-W02 bakery forecourt',-1222.2222222222222,579.8888888888891],
 ['H-W02 west cart sliver',-1494.2222222222222,563.8888888888891],['H-W02 south cart sliver',-1510.2222222222222,579.8888888888891],
 ['H-W03 Lanternleaf',3097.777777777778,-268.11111111111086],['H-W04 Buttercup steps',-678.2222222222222,251.88888888888914],
 ['Lanternleaf shifted gap',3193.777777777778,-268.11111111111086],
]));
