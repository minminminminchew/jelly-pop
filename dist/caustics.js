// Trace a directional light through a unit jelly sphere onto a receiving plane.
// Precomputed optical footprint; animated balls deform this footprint in real time.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
const norm=v=>v.map(x=>x/Math.hypot(...v));
export function refract(direction,normal,eta){const c=-dot(direction,normal),k=1-eta*eta*(1-c*c);return k<0?null:add(direction.map(x=>x*eta),normal,eta*c-Math.sqrt(k));}
export function traceFootprint(size=192,samples=140){
 const light=norm([.36,-.5,-1]),u=norm([light[2],0,-light[0]]),v=[light[1]*u[2]-light[2]*u[1],light[2]*u[0]-light[0]*u[2],light[0]*u[1]-light[1]*u[0]];
 const energy=new Float32Array(size*size),depth=new Float32Array(size*size);let hits=0;
 for(let row=0;row<samples;row++)for(let col=0;col<samples;col++){
  const a=(col+.5)/samples*2-1,b=(row+.5)/samples*2-1;if(a*a+b*b>=.99)continue;
  const origin=add(add(light.map(x=>-x*4),u,a),v,b),od=dot(origin,light),disc=od*od-dot(origin,origin)+1;if(disc<=0)continue;
  const entry=add(origin,light,-od-Math.sqrt(disc)),inside=refract(light,entry,1/1.34);if(!inside)continue;
  const length=-2*dot(entry,inside),exit=add(entry,inside,length),out=refract(inside,exit.map(x=>-x),1.34);if(!out||out[2]>=0)continue;
  const point=add(exit,out,(-2.25-exit[2])/out[2]);
  const x=(point[0]+3)/6*size,y=(3-point[1])/6*size;hits++;
  const incidence=Math.max(.1,-dot(light,entry));
  for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){
   const px=Math.floor(x)+ox,py=Math.floor(y)+oy;if(px<0||py<0||px>=size||py>=size)continue;
   const weight=Math.exp(-((px+.5-x)**2+(py+.5-y)**2)/2.4)*incidence;
   const index=py*size+px;energy[index]+=weight;depth[index]+=weight*length;
  }
 }
 const sorted=Array.from(energy).filter(x=>x>0).sort((a,b)=>a-b);const exposure=sorted[Math.floor(sorted.length*.96)]||1;
 return {size,energy,depth,exposure,hits};
}
