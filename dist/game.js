import * as THREE from './vendor/three.module.js';
import {traceFootprint} from './caustics.js';
import {createGlassVane} from './marble.js';
import {createNaturalBoard,shotOptions,pickShotColor} from './level.js';
import {connected,detached,aimVector,nearestSlot} from './physics.js';
const $=id=>document.getElementById(id), canvas=$('scene'), host=$('game');
const palette=['#fa658a','#ffc049','#40cfa0','#5eaff8','#af75ed','#deeff5'];
const MARBLE_TYPE=5;
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){$('notice').textContent='WebGL is unavailable. Please use a current version of Chrome or Safari.';throw e;}
renderer.setClearColor(0xffffff,1);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(0,1000,0,700,.1,100000);camera.position.z=5000;
const geom=new THREE.SphereGeometry(1,32,24);
// A small photographic studio, reflected in the wet jelly surface.
const studio=new THREE.Scene();studio.background=new THREE.Color('#ebe7f0');
function softbox(x,y,z,w,h,intensity){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(intensity,intensity,intensity),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);studio.add(m)}
softbox(-3,4,5,3,4,4);softbox(4,1,3,1,5,2.5);softbox(0,-4,2,5,1,1.8);softbox(-4,-1,1,1,5,.55);
const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromScene(studio,.06,0.1,100);scene.environment=env.texture;pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff,0xe4d4f1,1.5));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-300,500,600);scene.add(key);
const jellyClock={value:0};
const materials=palette.map((color,index)=>{const m=new THREE.MeshPhysicalMaterial({color:new THREE.Color(color).lerp(new THREE.Color(0xffffff),.88),metalness:0,roughness:.035,transmission:1,thickness:1.15,ior:1.34,attenuationColor:color,attenuationDistance:1.7,clearcoat:.28,clearcoatRoughness:.11,envMapIntensity:.8,specularIntensity:1});
 if(index===MARBLE_TYPE){m.color.set(0xffffff);m.attenuationColor.set('#f0faf7');m.roughness=.018;m.ior=1.22;m.thickness=.65;m.clearcoat=.5;}
 m.onBeforeCompile=shader=>{shader.uniforms.jellyTime=jellyClock;shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_fragment>',THREE.ShaderChunk.transmission_fragment.replace('material.thickness = thickness;', 'material.thickness = thickness * max(0.12, pow(abs(normal.z), 1.4));'));shader.vertexShader='uniform float jellyTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float phase = modelMatrix[3].x * 0.07 + modelMatrix[3].y * 0.035;
 float ripple = sin(position.y * 4.5 + jellyTime * 2.2 + phase) * sin(position.x * 3.5 - jellyTime * 1.8 + phase);
 transformed += normal * ripple * 0.018;`);};return m;});
// Render the colored receiving surface first, so transmission sees it too.
const floorScene=new THREE.Scene();floorScene.background=new THREE.Color(0xffffff);
const floorTarget=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});floorTarget.texture.colorSpace=THREE.SRGBColorSpace;scene.background=floorTarget.texture;
const footprint=traceFootprint();
const causticMaterials=palette.map(color=>{
 const c=document.createElement('canvas');c.width=c.height=footprint.size;const ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);
 const tint=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const i=y*c.width+x,e=footprint.energy[i],path=e>0?footprint.depth[i]/e:1;
  const px=x/c.width*6-3,py=3-y/c.height*6;
  const halo=Math.exp(-(((px-.62)/.82)**2+((py+.91)/.78)**2)*2.1)*.025;
  const focus=Math.pow(Math.min(e/footprint.exposure,1.6),.65)*.20;
  const alpha=Math.min(.23,focus+halo);
  for(let k=0;k<3;k++)pixels.data[i*4+k]=Math.round(255*(.18+.82*Math.pow(tint[k],Math.max(.7,path*.6))));
  pixels.data[i*4+3]=Math.round(255*alpha);
 }
 ctx.putImageData(pixels,0,0);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 return new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
});
let W,H,R,left,right,top,origin,cols,topOffset=0,board=[],falling=[],particles=[],projectile=null,current,next,preview=[],dots=[],last=0,elapsed=0,score=0,best=0,level=1,misses=0,combo=0,paused=false,over=false,sound=false,audio=null,shotNumber=0,toastTimer,noticeTimer,pointer={x:0,y:0},dragging=false,downPoint=null,aim={x:0,y:-1},readyAt=0;
try{best=Number(localStorage.getItem('jelly-pop-best'))||0;}catch{}
$('best').textContent=String(best).padStart(4,'0');
const dotGeo=new THREE.SphereGeometry(1,8,6),dotMat=new THREE.MeshBasicMaterial({color:0xb9afcd,transparent:true,opacity:.5});for(let i=0;i<48;i++){const d=new THREE.Mesh(dotGeo,dotMat);scene.add(d);dots.push(d)}
const ring=new THREE.Mesh(new THREE.RingGeometry(1,1.035,80),new THREE.MeshBasicMaterial({color:0xece8f2,side:THREE.DoubleSide,transparent:true,opacity:.8}));scene.add(ring);
const floorLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xf0edf5,transparent:true,opacity:.75}));scene.add(floorLine);
function ball(x,y,color,scale=1){const mesh=new THREE.Mesh(geom,materials[color]);if(color===MARBLE_TYPE)mesh.add(createGlassVane());const shadow=new THREE.Sprite(causticMaterials[color]);floorScene.add(shadow);scene.add(mesh);return {x,y,color,mesh,shadow,scale,wobble:0,seed:Math.random()*6,age:0,vx:0,vy:0};}
function remove(b){scene.remove(b.mesh);floorScene.remove(b.shadow)}
function drawBall(b,dt){b.age+=dt;b.wobble=Math.max(0,b.wobble-dt*1.45);const s=Math.sin(b.age*19)*b.wobble*.23;const breath=Math.sin(elapsed*1.8+b.seed)*.018; b.mesh.position.set(b.x,H-b.y,R*2.25);b.mesh.scale.set(R*b.scale*(1+s+breath),R*b.scale*(1-s*.8-breath),R*b.scale);b.mesh.rotation.z=Math.sin(b.seed+b.age*8)*b.wobble*.14+(b.spin||0)*(b.fallAge||0);b.shadow.position.set(b.x+R*s*.25,H-b.y-R*s*.2,0);b.shadow.scale.set(R*b.scale*6*(1+s*.5),R*b.scale*6*(1-s*.35),1);}
function refreshQueue(first=false){
 const options=shotOptions(board,{r:R,left,right,top,origin});
 if(first)current=pickShotColor(options,board,-1,Math.random,true);
 else current=board.some(b=>b.color===next)?next:pickShotColor(options,board,current,Math.random,true);
 next=pickShotColor(options,board,current,Math.random,misses>=2);setPreview();
}
function setPreview(){preview.forEach(remove);preview=[ball(origin.x,origin.y,current,1.08),ball(origin.x+R*3.7,origin.y+3,next,.73)];preview[0].wobble=.6;}
function resize(){const rect=host.getBoundingClientRect(),oldW=W,oldH=H,oldR=R;W=rect.width<700?440:1000;H=rect.height/rect.width*W;cols=cols||(rect.width<700?12:23);R=Math.min(W/(cols*2+5),H/25);const span=(cols-1)*R*2;left=(W-span)/2;right=W-left;top=Math.max(R*2.9,45);origin={x:W/2,y:H-R*3.3};camera.left=0;camera.right=W;camera.top=H;camera.bottom=0;camera.updateProjectionMatrix();materials.forEach((m,i)=>{m.attenuationDistance=R*(i===MARBLE_TYPE?12:2.6)});renderer.setSize(rect.width,rect.height,false);floorTarget.setSize(Math.round(rect.width*renderer.getPixelRatio()),Math.round(rect.height*renderer.getPixelRatio()));
if(oldW){const sx=W/oldW,sy=H/oldH;[...board,...falling].forEach(b=>{b.x=origin.x+(b.x-oldW/2)*R/oldR;b.y=top+(b.y-Math.max(oldR*2.9,45))*R/oldR});if(projectile){remove(projectile);projectile=null;}setPreview();topOffset=topOffset?R:0;}
ring.position.set(origin.x,H-origin.y,0);ring.scale.set(R*1.57,R*1.57,1);floorLine.geometry.dispose();floorLine.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(left-R,H-origin.y+R*1.95,0),new THREE.Vector3(right+R,H-origin.y+R*1.95,0)]);
const k=rect.width/W;$('launcher-note').style.cssText=`left:${(origin.x+R*5.05)*k}px;top:${(origin.y-R*.4)*k}px`;$('swap').style.cssText=`left:${(origin.x+R*2.05)*k-14}px;top:${origin.y*k-16}px`;$('misses').style.cssText=`left:50%;transform:translateX(-50%);top:${(origin.y+R*2.05)*k}px`;}
function updateScore(points=0){score+=points;$('score').textContent=String(score).padStart(4,'0');if(score>best){best=score;$('best').textContent=String(best).padStart(4,'0');try{localStorage.setItem('jelly-pop-best',String(best))}catch{}}}
function dotsUI(){$('misses').innerHTML=Array.from({length:5},(_,i)=>`<i class="${i<misses?'used':''}"></i>`).join('')}
function newBoard(){
 board.forEach(remove);falling.forEach(remove);particles.forEach(p=>{scene.remove(p.mesh);p.mesh.material.dispose()});board=[];falling=[];particles=[];if(projectile)remove(projectile);projectile=null;
 const rows=Math.min(10,Math.max(7,Math.floor((H*.64-top)/(R*Math.sqrt(3)))));
 board=createNaturalBoard({cols,rows,r:R,left,top,colorCount:palette.length}).map(p=>ball(p.x,p.y,p.color));
 misses=0;topOffset=0;combo=0;over=false;paused=false;readyAt=elapsed+.2;refreshQueue(true);dotsUI();$('level').textContent=String(level).padStart(2,'0');
}
function restart(){score=0;level=1;updateScore();newBoard();closeModal();showNotice('Open a gap. Find your next angle.')}
function showNotice(text){$('notice').textContent=text;$('notice').style.opacity=1;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').style.opacity=0,3500)}
function toast(text,sub){$('toast').innerHTML=`${text}<small>${sub}</small>`;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1500)}
function tone(index=0,kind='pop',delay=0){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const now=audio.currentTime+delay,notes=[261.63,293.66,329.63,392,440,523.25,587.33,659.25];const o=audio.createOscillator(),g=audio.createGain();o.type='sine';const freq=kind==='shoot'?180:notes[index%notes.length];o.frequency.setValueAtTime(freq,now);if(kind==='shoot')o.frequency.exponentialRampToValueAtTime(340,now+.09);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(kind==='shoot'?.025:.065,now+.01);g.gain.exponentialRampToValueAtTime(.001,now+.55);o.connect(g);g.connect(audio.destination);o.start();o.stop(now+.6);}catch{}}
function burst(b){for(let i=0;i<6;i++){const mesh=new THREE.Mesh(dotGeo,new THREE.MeshBasicMaterial({color:b.color===MARBLE_TYPE?(i%2?'#3572e8':'#e8cf43'):palette[b.color],transparent:true,opacity:.7}));scene.add(mesh);const a=i/6*Math.PI*2;particles.push({mesh,x:b.x,y:b.y,vx:Math.cos(a)*R*4,vy:Math.sin(a)*R*4,life:.6,max:.6,size:Math.random()*2+1})}}
function detach(){
 const loose=detached(board,R,top),selected=new Set(loose);
 if(!loose.length)return 0;
 const center=loose.reduce((sum,b)=>sum+b.x,0)/loose.length;board=board.filter(b=>!selected.has(b));
 for(const b of loose){b.vy=-R*(1.3+Math.random());b.vx=(b.x-center)*.65+(Math.random()-.5)*R*.7;b.wobble=1;b.age=0;b.fallAge=0;b.fallDelay=Math.min(.14,(b.y-top)/R*.008);b.spin=(Math.random()-.5)*2.8;falling.push(b)}
 updateScore(loose.length*20*Math.min(combo,5));return loose.length;
}
function resolve(b){
 const group=connected(b,board,R,true);
 if(group.length>=3){
  combo++;misses=0;dotsUI();const points=group.length*10*Math.min(combo,5);updateScore(points);
  const selected=new Set(group);board=board.filter(q=>!selected.has(q));for(const q of group){burst(q);remove(q)}
  for(const q of board)if(Math.hypot(q.x-b.x,q.y-b.y)<R*8){q.wobble=.85;q.age=0}
  const dropped=detach(),bonus=dropped*20*Math.min(combo,5);
  tone(b.color+combo);if(dropped){for(let i=0;i<Math.min(6,2+Math.floor(dropped/4));i++)tone(combo+i,'pop',.05+i*.055)}
  toast(dropped>=8?`${dropped} down. So good!`:combo>1?`${combo} × Jelly good!`:'So satisfying.',`${group.length} popped${dropped?' · '+dropped+' dropped':''} · +${points+bonus}`);
  if(dropped>=8&&!matchMedia('(prefers-reduced-motion: reduce)').matches)canvas.animate([{transform:'translateY(0)'},{transform:'translateY(2px)'},{transform:'translateY(-1px)'},{transform:'translateY(0)'}],{duration:180});
  readyAt=elapsed+.20;
 }else{combo=0;misses++;if(misses>=5){misses=0;descend()}dotsUI()}
 if(!board.length&&!falling.length)win();else checkLoss();
}
function descend(){board.forEach(b=>{b.y+=R*1.732;b.wobble=.3});topOffset=R-topOffset;for(let c=0;c<cols;c++){const x=left+topOffset+c*R*2;if(x<=right+.1&&!board.some(b=>Math.hypot(b.x-x,b.y-top)<R*1.8))board.push(ball(x,top,Math.floor(Math.random()*palette.length)))}showNotice('A little closer. Time for a combo!');}
function checkLoss(){if(board.some(b=>b.y>origin.y-R*3)){over=true;showModal('ONE MORE LITTLE TRY?','One more little try?',`Your score <strong>${score}</strong><br>The bubbles reached the line. Find a new angle and try again.`,'Play again',restart)}}
function win(){if(over)return;over=true;tone(7);showModal('BEAUTIFULLY DONE', 'All clear. All smiles.',`Level ${level} complete · Score ${score}<br>Ready for another shower of jelly?`,'Next level',()=>{level++;newBoard();closeModal()})}
function shoot(){if(paused||over||projectile||elapsed<readyAt||!board.length)return;projectile=ball(origin.x,origin.y,current);projectile.vx=aim.x*R*45;projectile.vy=aim.y*R*45;projectile.wobble=.7;preview[0].mesh.visible=false;preview[0].shadow.visible=false;shotNumber++;tone(0,'shoot');canvas.focus({preventScroll:true})}
function swap(){if(paused||over||projectile)return;[current,next]=[next,current];setPreview();tone(2,'shoot')}
function settle(b){const slot=nearestSlot(b.x,b.y,board,R,left,right,top);if(!slot){remove(b);projectile=null;refreshQueue();return}b.x=slot.x;b.y=slot.y;b.vx=b.vy=0;b.wobble=1;b.age=0;board.push(b);projectile=null;readyAt=elapsed+.15;resolve(b);if(!over)refreshQueue()}
function updateProjectile(dt){if(!projectile)return;const steps=5;for(let i=0;i<steps&&projectile;i++){const b=projectile;b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;if(b.x<left){b.x=left*2-b.x;b.vx=Math.abs(b.vx);b.wobble=.8;tone(2,'shoot')}if(b.x>right){b.x=right*2-b.x;b.vx=-Math.abs(b.vx);b.wobble=.8;tone(2,'shoot')}if(b.y<=top||board.some(q=>Math.hypot(q.x-b.x,q.y-b.y)<=R*1.98))settle(b)}}
function updateFalling(dt){
 for(const b of [...falling]){
  b.fallDelay-=dt;if(b.fallDelay>0)continue;b.fallAge+=dt;b.vy+=R*62*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.x<left||b.x>right){b.vx*=-.6;b.x=Math.max(left,Math.min(right,b.x))}
  if(b.y>H+R*3){falling.splice(falling.indexOf(b),1);remove(b)}
 }
 if(!board.length&&!falling.length&&!over)win();
}
function aimDots(){let x=origin.x,y=origin.y,vx=aim.x,vy=aim.y,stop=paused||over||!!projectile,dist=0,idx=0;while(!stop&&idx<dots.length){x+=vx*R*.5;y+=vy*R*.5;dist+=R*.5;if(x<left){x=2*left-x;vx*=-1}if(x>right){x=2*right-x;vx*=-1}if(y<top||board.some(b=>Math.hypot(x-b.x,y-b.y)<R*1.9)){stop=true;break}if(dist>R*2&&dist%(R*1.15)<R*.5){const d=dots[idx++];d.position.set(x,H-y,5);d.scale.setScalar(R*.065);d.visible=true}}for(;idx<dots.length;idx++)dots[idx].visible=false;}
function showModal(eyebrow,title,body,action,callback){paused=true;$('modal-eyebrow').textContent=eyebrow;$('modal-title').textContent=title;$('modal-body').innerHTML=`<p>${body}</p>`;$('modal-action').innerHTML=`${action}<span>↗</span>`;$('modal-action').onclick=callback;$('modal').hidden=false;$('modal-action').focus();$('pause').setAttribute('aria-label','Resume')}
function closeModal(){paused=false;$('modal').hidden=true;$('pause').setAttribute('aria-label','Pause');canvas.focus({preventScroll:true})}
function pause(){if(over)return;if(paused)closeModal();else showModal('TAKE A LITTLE BREAK','A moment of softness.','Your jellies will be right here.','Keep playing',closeModal)}
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}}
canvas.addEventListener('pointermove',e=>{pointer=point(e);if(dragging&&downPoint&&pointer.y>origin.y){aim=aimVector(origin.x-(pointer.x-downPoint.x),origin.y-Math.max(R*2,pointer.y-downPoint.y),origin)}else aim=aimVector(pointer.x,Math.min(pointer.y,origin.y-R),origin)});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;downPoint=point(e);dragging=true;canvas.setPointerCapture(e.pointerId);aim=aimVector(downPoint.x,Math.min(downPoint.y,origin.y-R),origin)});
canvas.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;const p=point(e);if(Math.hypot(p.x-(origin.x+R*3.7),p.y-origin.y)<R*1.3)swap();else shoot();downPoint=null});canvas.addEventListener('pointercancel',()=>{dragging=false;downPoint=null});
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight',' ','Enter','Escape','p','P','r','R'].includes(e.key)){if(e.target.tagName==='BUTTON'&&e.key==='Enter')return;e.preventDefault();if(e.key===' ')swap();if(e.key==='Enter')shoot();if(e.key==='Escape'||e.key.toLowerCase()==='p')pause();if(e.key.toLowerCase()==='r')restart();if(e.key.startsWith('Arrow')){const a=Math.atan2(aim.x,-aim.y)+(e.key==='ArrowLeft'?-.045:.045);aim=aimVector(origin.x+Math.sin(a)*100,origin.y-Math.cos(a)*100,origin)}}});
$('swap').onclick=swap;$('pause').onclick=pause;$('reset').onclick=restart;$('help').onclick=()=>showModal('A SMALL GUIDE TO JOY','Aim. Bounce. Pop.','Move your mouse or finger to aim. Click or release to shoot.<br>Connect three or more of the same color to pop them.<br>Swirl marbles match other swirl marbles.<br>Open gaps and cut off support to send loose bubbles falling.<br>Bounce off the walls to find a beautiful angle.<br>Space to swap · Arrow keys to aim · Enter to shoot<br>After 5 consecutive shots without a match, the bubbles descend.','Let’s play',closeModal);
$('sound').onclick=()=>{sound=!sound;$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');$('sound').title=sound?'Mute sound':'Enable sound';$('sound').innerHTML=sound?'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Zm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/></svg>';if(sound)tone(4)};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused&&!over)pause()});
function frame(now){const dt=Math.min((now-last)/1000||.016,.033);last=now;if(!paused){elapsed+=dt;jellyClock.value=elapsed;updateProjectile(dt);updateFalling(dt);for(const p of [...particles]){p.life-=dt;if(p.life<=0){scene.remove(p.mesh);p.mesh.material.dispose();particles.splice(particles.indexOf(p),1);continue}p.vy+=R*12*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.mesh.position.set(p.x,H-p.y,30);p.mesh.scale.setScalar(p.size*p.life/p.max);p.mesh.material.opacity=p.life/p.max*.6}for(const b of [...board,...falling,...preview,...(projectile?[projectile]:[])])drawBall(b,dt)}aimDots();renderer.setRenderTarget(floorTarget);renderer.render(floorScene,camera);renderer.setRenderTarget(null);renderer.render(scene,camera);requestAnimationFrame(frame)}
resize();newBoard();updateScore();showNotice('Match colors. Open gaps. Make it rain.');new ResizeObserver(()=>{if(W)resize()}).observe(host);requestAnimationFrame(frame);
