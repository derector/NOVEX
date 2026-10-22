import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';

export function createLogoScene(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.25;
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(36,1,.1,100);
 camera.position.set(0,.1,8.6);
 scene.add(new THREE.AmbientLight(0x8999ff,1.4));
 const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(-3,4,6);scene.add(key);
 const rim=new THREE.PointLight(0x42dfff,18,18);rim.position.set(3,1,2);scene.add(rim);
 const violet=new THREE.PointLight(0xb45cff,15,16);violet.position.set(-3,-2,2);scene.add(violet);
 const group=new THREE.Group();scene.add(group);
 const loader=new FontLoader();const font=loader.parse(fontData);
 let mesh=null,playing=false,raf=0,started=0,elapsed=0,disposed=false;
 const mat=new THREE.MeshPhysicalMaterial({color:0xe7e9ff,metalness:.92,roughness:.19,clearcoat:1,clearcoatRoughness:.12});
 function setText(value='NOVEX'){
  const text=String(value||'NOVEX').slice(0,24).toUpperCase();
  const geo=new TextGeometry(text,{font,size:1,depth:.22,curveSegments:10,bevelEnabled:true,bevelThickness:.045,bevelSize:.025,bevelSegments:3});
  geo.computeBoundingBox();geo.center();
  if(mesh){group.remove(mesh);mesh.geometry.dispose();}
  mesh=new THREE.Mesh(geo,mat);group.add(mesh);
 }
 function resize(){
  if(disposed)return;
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=w/h<1.15?10.2:8.6;camera.updateProjectionMatrix();
 }
 function draw(t){
  if(disposed)return;
  group.rotation.y=Math.sin(t*.58)*.52;
  group.rotation.x=Math.sin(t*.8)*.09;
  group.position.y=Math.sin(t*1.4)*.07;
  rim.intensity=15+Math.sin(t*1.7)*4;
  renderer.render(scene,camera);
 }
 function tick(now){
  if(!playing||disposed)return;
  elapsed+=(now-started)/1000;started=now;draw(elapsed);raf=requestAnimationFrame(tick);
 }
 setText();resize();draw(0);
 const ro=new ResizeObserver(resize);ro.observe(canvas);
 return {
  setText,
  play(){if(playing||disposed)return;playing=true;started=performance.now();raf=requestAnimationFrame(tick);},
  pause(){playing=false;cancelAnimationFrame(raf);draw(elapsed);},
  isPlaying(){return playing;},
  renderAt(t){draw(Math.max(0,Number(t)||0));},
  dispose(){disposed=true;playing=false;cancelAnimationFrame(raf);ro.disconnect();if(mesh)mesh.geometry.dispose();mat.dispose();renderer.dispose();}
 };
}
