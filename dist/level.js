import {connected,detached,nearestSlot} from './physics.js';
export function createNaturalBoard({cols,rows,r,left,top,colorCount=6},rng=Math.random){
 const balls=[],phase=rng()*Math.PI*2;
 // One uninterrupted field. Only the lower edge varies; there are no stems or pods.
 for(let row=0;row<rows;row++)for(let col=0;col<cols-row%2;col++){
  const edge=rows-2+Math.sin(col*.44+phase)*1.1+Math.sin(col*.91+phase*.6)*.55;
  if(row>Math.max(rows-4,edge))continue;
  balls.push({x:left+(col*2+row%2)*r,y:top+row*r*Math.sqrt(3),color:-1,row,col});
 }
 const neighbors=new Map(balls.map(a=>[a,balls.filter(b=>a!==b&&Math.hypot(a.x-b.x,a.y-b.y)<r*2.13)]));
 const empty=new Set(balls);
 while(empty.size){
  const seed=[...empty][Math.floor(rng()*empty.size)],patch=[],frontier=[seed],queued=new Set(frontier);
  const target=4+Math.floor(rng()*8);
  while(frontier.length&&patch.length<target){
   const i=Math.floor(rng()*frontier.length),cell=frontier.splice(i,1)[0];if(!empty.has(cell))continue;
   empty.delete(cell);patch.push(cell);
   for(const n of neighbors.get(cell))if(empty.has(n)&&!queued.has(n)){queued.add(n);frontier.push(n)}
  }
  const boundary=new Set(patch.flatMap(c=>neighbors.get(c)).filter(n=>n.color>=0).map(n=>n.color));
  const available=Array.from({length:colorCount},(_,i)=>i).filter(i=>!boundary.has(i));
  const color=available.length?available[Math.floor(rng()*available.length)]:Math.floor(rng()*colorCount);
  patch.forEach(c=>c.color=color);
 }
 return balls;
}
export function traceAim(board,{r,left,right,top,origin},angle){
 let x=origin.x,y=origin.y,dx=Math.sin(angle),dy=-Math.cos(angle);
 for(let bounce=0;bounce<4;bounce++){
  const wall=dx>1e-6?(right-x)/dx:dx<-1e-6?(left-x)/dx:Infinity,ceiling=(top-y)/dy;
  let distance=Math.min(wall,ceiling),hit=null;
  for(const b of board){const rx=x-b.x,ry=y-b.y,projection=rx*dx+ry*dy,disc=projection*projection-(rx*rx+ry*ry-(r*1.98)**2);if(disc<0)continue;const t=-projection-Math.sqrt(disc);if(t>=-.01&&t<distance){distance=t;hit=b}}
  x+=dx*distance;y+=dy*distance;
  if(hit||ceiling<=wall){const slot=nearestSlot(x,y,board,r,left,right,top);return slot?{slot,hit}:null}
  dx=-dx;x+=dx*.001;
 }
 return null;
}
export function shotOptions(board,settings){
 if(!board.length)return [];
 const {r,top}=settings,choices=new Map(),cache=new Map(),exposed=new Set();
 const ids=new Map(board.map((b,i)=>[b,i]));
 for(let i=0;i<=88;i++){
  const angle=-1.30+i/88*2.60,impact=traceAim(board,settings,angle);if(!impact)continue;
  const nearby=board.filter(b=>Math.hypot(b.x-impact.slot.x,b.y-impact.slot.y)<r*2.13);
  for(const color of new Set(nearby.map(b=>b.color))){
   exposed.add(color);
   const probe={...impact.slot,color},group=connected(probe,[...board,probe],r,true);
   if(group.length<3)continue;
   const selected=new Set(group),key=group.filter(b=>b!==probe).map(b=>ids.get(b)).sort((a,b)=>a-b).join(',');
   let dropped=cache.get(key);if(dropped===undefined){dropped=detached(board.filter(b=>!selected.has(b)),r,top).length;cache.set(key,dropped)}
   const value=group.length+dropped*1.8,old=choices.get(color);
   if(!old||value>old.value||(value===old.value&&Math.abs(angle)<Math.abs(old.angle)))choices.set(color,{color,value,popped:group.length,dropped,angle,slot:impact.slot});
  }
 }
 const result=[...choices.values()].sort((a,b)=>b.value-a.value);result.exposedColors=[...exposed];return result;
}
export function pickShotColor(options,board,avoid,rng=Math.random,forceMatch=false){
 // Prefer reachable matches, without selecting colors by predicted jackpot size.
 const present=[...new Set(board.map(b=>b.color))];
 const candidates=options.length&&(forceMatch||rng()<.78)?options.map(o=>o.color):(options.exposedColors?.length?options.exposedColors:present);
 if(!candidates.length)return 0;
 const weights=candidates.map(c=>c===avoid?.55:1);let value=rng()*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<candidates.length;i++){value-=weights[i];if(value<=0)return candidates[i]}return candidates.at(-1);
}
