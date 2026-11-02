import {test} from 'node:test';import assert from 'node:assert/strict';
import {createNaturalBoard,shotOptions,pickShotColor} from '../dist/level.js';
import {connected,detached,nearestSlot} from '../dist/physics.js';
function random(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function liveImpact(board,s,angle){let x=s.origin.x,y=s.origin.y,vx=Math.sin(angle)*s.r*45,vy=-Math.cos(angle)*s.r*45;for(let i=0;i<3000;i++){x+=vx/300;y+=vy/300;if(x<s.left){x=2*s.left-x;vx=Math.abs(vx)}if(x>s.right){x=2*s.right-x;vx=-Math.abs(vx)}if(y<=s.top||board.some(b=>Math.hypot(b.x-x,b.y-y)<=s.r*1.98))return nearestSlot(x,y,board,s.r,s.left,s.right,s.top)}throw new Error('Shot never landed')}
test('natural boards are a continuous field with a complete upper body',()=>{
 for(const cols of [12,23])for(let seed=1;seed<=24;seed++){
  const s={cols,rows:7+seed%3,r:17,left:20,right:20+(cols-1)*34,top:45,origin:{x:20+(cols-1)*17,y:500}};
  const board=createNaturalBoard(s,random(seed));
  assert.equal(detached(board,s.r,s.top).length,0);
  assert.equal(connected(board[0],board,s.r).length,board.length);
  for(let row=0;row<=s.rows-4;row++)assert.equal(board.filter(b=>b.row===row).length,cols-row%2,'No pre-cut channels or hanging pods');
  const options=shotOptions(board,s);assert.ok(options.length>0);
  const best=options[0],shot={...liveImpact(board,s,best.angle),color:best.color};
  const group=connected(shot,[...board,shot],s.r,true);assert.ok(group.length>=3);
  const chosen=pickShotColor(options,board,best.color,random(seed),true);assert.ok(options.some(o=>o.color===chosen));
  for(let i=0;i<10;i++)assert.ok(board.some(b=>b.color===pickShotColor(options,board,-1,random(seed+i))));
 }
});
test('cleared colors do not return in the shot queue',()=>{const board=[{x:0,y:0,color:2},{x:20,y:0,color:2}];for(let seed=1;seed<20;seed++)assert.equal(pickShotColor([],board,5,random(seed)),2)});
