import * as THREE from './vendor/three.module.js';
// A tapered, twisted two-color glass vane sealed within a clear marble.
const positions=[],colors=[];
const blue=new THREE.Color('#124dcc'),yellow=new THREE.Color('#e6c80e');
function point(t,u,side){
 const y=(t-.5)*1.58;
 const width=.43*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.72);
 const twist=(t-.5)*2.1+.26*Math.sin(t*Math.PI*2);
 const center=.10*Math.sin(t*Math.PI*2-.4);
 return [center+u*width*Math.cos(twist),y,-.10+u*width*Math.sin(twist)+.09*Math.sin(t*Math.PI*2)+side*.016];
}
function triangle(a,b,c,color){for(const p of [a,b,c]){positions.push(...p);colors.push(color.r,color.g,color.b)}}
for(let half=0;half<2;half++){
 const color=half?blue:yellow;
 for(let i=0;i<40;i++)for(let j=0;j<8;j++){
  const t0=i/40,t1=(i+1)/40,u0=half-1+j/8,u1=half-1+(j+1)/8;
  for(const side of [-1,1]){
   const a=point(t0,u0,side),b=point(t1,u0,side),c=point(t1,u1,side),d=point(t0,u1,side);
   if(side>0){triangle(a,b,c,color);triangle(a,c,d,color)}else{triangle(a,c,b,color);triangle(a,d,c,color)}
  }
 }
 for(let i=0;i<40;i++)for(const u of [half-1,half]){
  const a=point(i/40,u,-1),b=point((i+1)/40,u,-1),c=point((i+1)/40,u,1),d=point(i/40,u,1);
  triangle(a,b,c,color);triangle(a,c,d,color);
 }
}
export const marbleVaneGeometry=new THREE.BufferGeometry();
marbleVaneGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));marbleVaneGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));marbleVaneGeometry.computeVertexNormals();marbleVaneGeometry.computeBoundingSphere();
const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.24,metalness:0,clearcoat:.5,clearcoatRoughness:.18,envMapIntensity:.3,side:THREE.DoubleSide});
export function createGlassVane(){const vane=new THREE.Mesh(marbleVaneGeometry,material);vane.rotation.set((Math.random()-.5)*1.0,(Math.random()-.5)*1.1,Math.random()*Math.PI*2);return vane;}
