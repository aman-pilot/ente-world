import test from 'node:test';
import {assertReachable} from './lib/audit-reachability.mjs';
test('Campfire bakery, cottage, beach and Storynest gaps connect in both directions',()=>assertReachable('isle-250',[
 ['CF-01 courtyard',7418,5204],['Lanternloaf authored path approach',6887,5114],['CF-02 north bakery lawn',7288,4872],
 ['CF-03 sign approach',7676.141104721641,4999.4548132206255],['CF-03 middle sliver',7860,5008],['CF-03 east sliver',7932,5052],['CF-03 cottage front',8016,5064],
 ['CF-04 beach gap',6434,3894],['Storynest authored path approach',173,491],['CF-05 west seats',56,408],['CF-05 east seats',336,408],
 ['east lantern-line moved gap',7880,5384],
]));
