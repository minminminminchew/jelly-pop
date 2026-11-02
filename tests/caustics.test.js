import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refract,traceFootprint} from '../dist/caustics.js';
test('normal incidence passes straight through the interface',()=>{assert.deepEqual(refract([0,0,-1],[0,0,1],1/1.34),[0,0,-1])});
test('light crossing both sphere interfaces focuses below and to the right',()=>{
 const f=traceFootprint(96,80);assert.ok(f.hits>4000);assert.ok(f.exposure>0);assert.ok(f.energy.every(Number.isFinite));
 let x=0,y=0,total=0;f.energy.forEach((e,i)=>{x+=(i%f.size)*e;y+=Math.floor(i/f.size)*e;total+=e});
 assert.ok(x/total>f.size/2);assert.ok(y/total>f.size/2);
});
