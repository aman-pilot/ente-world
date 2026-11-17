import test from 'node:test';
import {assertReachable} from './lib/audit-reachability.mjs';
test('Rosybutton narrow gaps route from and back to spawn',()=>assertReachable('sunset',[
 ['S01 Ribbonwick',816,-324],['S02 Chirrup east',6448,-196],['S03 Chirrup west',5936,-212],['S04 Petalpatch',-880,2316],
 ['Petalpatch lamp relocation',-1216,2444],
]));
