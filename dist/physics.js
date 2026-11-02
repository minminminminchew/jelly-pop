export function connected(start, balls, radius, sameColor=false) {
 const seen=new Set([start]), queue=[start];
 for(let i=0;i<queue.length;i++) for(const b of balls) if(!seen.has(b)&&(!sameColor||b.color===start.color)&&Math.hypot(b.x-queue[i].x,b.y-queue[i].y)<radius*2.13){seen.add(b);queue.push(b)}
 return [...seen];
}
export function detached(balls,radius,top){
 const anchored=new Set(),queue=balls.filter(b=>b.y<=top+radius*.7);
 queue.forEach(b=>anchored.add(b));
 for(let i=0;i<queue.length;i++) for(const b of balls) if(!anchored.has(b)&&Math.hypot(b.x-queue[i].x,b.y-queue[i].y)<radius*2.13){anchored.add(b);queue.push(b)}
 return balls.filter(b=>!anchored.has(b));
}
export function aimVector(x,y,origin){const a=Math.max(-1.37,Math.min(1.37,Math.atan2(x-origin.x,origin.y-y)));return {x:Math.sin(a),y:-Math.cos(a)}}
export function nearestSlot(x,y,balls,r,left,right,top){
 const candidates=[];
 for(let c=0;c<Math.round((right-left)/(r*2))+1;c++)candidates.push({x:left+c*r*2,y:top});
 for(const b of balls)for(let n=0;n<6;n++){const a=n*Math.PI/3;candidates.push({x:b.x+Math.cos(a)*r*2,y:b.y+Math.sin(a)*r*2})}
 return candidates.filter(p=>p.x>=left-.1&&p.x<=right+.1&&p.y>=top-.1).sort((a,b)=>(a.x-x)**2+(a.y-y)**2-((b.x-x)**2+(b.y-y)**2)).find(p=>!balls.some(b=>(b.x-p.x)**2+(b.y-p.y)**2<(r*1.9)**2));
}
