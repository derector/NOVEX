import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';

export function createLogoScene(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor(0x000000,0);
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
 // Lightweight 3D environment: depth particles and animated energy rings.
 const particleCount=260,particlePositions=new Float32Array(particleCount*3);
 for(let i=0;i<particleCount;i++){particlePositions[i*3]=(Math.random()-.5)*15;particlePositions[i*3+1]=(Math.random()-.5)*9;particlePositions[i*3+2]=-2-Math.random()*13;}
 const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
 const particleMaterial=new THREE.PointsMaterial({color:0x9dbbff,size:.035,transparent:true,opacity:.68,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
 const particles=new THREE.Points(particleGeometry,particleMaterial);scene.add(particles);
 const ringMaterialA=new THREE.MeshBasicMaterial({color:0x42dfff,transparent:true,opacity:.48,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false});
 const ringMaterialB=new THREE.MeshBasicMaterial({color:0xb45cff,transparent:true,opacity:.36,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false});
 const ringA=new THREE.Mesh(new THREE.TorusGeometry(2.35,.012,8,120),ringMaterialA),ringB=new THREE.Mesh(new THREE.TorusGeometry(2.8,.009,8,120),ringMaterialB);
 ringA.position.z=-.55;ringB.position.z=-.8;ringA.rotation.x=.32;ringB.rotation.x=-.46;scene.add(ringA,ringB);
 let cameraMode='slow-orbit',effectMode='cinematic-particles',effectIntensity=1,baseCameraZ=8.6;
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
  renderer.setSize(w,h,false);camera.aspect=w/h;baseCameraZ=w/h<1.15?10.2:8.6;camera.position.z=baseCameraZ;camera.updateProjectionMatrix();
 }
 function draw(t){
  if(disposed)return;
  const baseZ=baseCameraZ;
  group.rotation.y=Math.sin(t*.58)*.52;
  group.rotation.x=Math.sin(t*.8)*.09;
  group.position.y=Math.sin(t*1.4)*.07;
  camera.position.set(0,.1,baseZ);
  camera.rotation.z=0;
  if(cameraMode==='orbit'){
   camera.position.x=Math.sin(t*.92)*2.15;
   camera.position.y=.1+Math.sin(t*.61)*.5;
   camera.position.z=baseZ+Math.cos(t*.92)*.35;
  }else if(cameraMode==='dolly-in'){
   camera.position.z=baseZ-Math.min(1.7,t*.62);
   camera.position.x=Math.sin(t*.38)*.12;
  }else if(cameraMode==='dolly-out'){
   camera.position.z=baseZ+Math.min(1.9,t*.68);
   camera.position.x=Math.sin(t*.35)*.1;
  }else if(cameraMode==='whip-pan'){
   camera.position.x=Math.sin(t*5.4)*.65*Math.exp(-t*.45);
   camera.rotation.z=Math.sin(t*5.4)*.045*Math.exp(-t*.6);
  }else{
   camera.position.x=Math.sin(t*.28)*.2;
   camera.position.z=baseZ+Math.cos(t*.42)*.22;
  }
  camera.lookAt(0,0,0);
  if(cameraMode==='whip-pan')camera.rotation.z+=Math.sin(t*5.4)*.045*Math.exp(-t*.6);
  particles.visible=effectMode!=='none';
  ringA.visible=effectMode==='energy-rings'||effectMode==='cinematic-particles'||effectMode==='light-streaks';
  ringB.visible=ringA.visible;
  particles.rotation.z=effectMode==='light-streaks'?Math.sin(t*1.7)*.12:Math.sin(t*.15)*.025;
  particles.rotation.y=effectMode==='light-streaks'?t*.16:t*.025;
  particleMaterial.opacity=effectMode==='none'?0:(effectMode==='light-streaks'?.88:.48)*effectIntensity;
  ringA.rotation.z=t*.45;ringB.rotation.z=-t*.31;
  ringA.scale.setScalar(1+Math.sin(t*2.2)*.035);
  ringB.scale.setScalar(1+Math.cos(t*1.6)*.045);
  ringMaterialA.opacity=(effectMode==='energy-rings'?.72:.38)*effectIntensity;
  ringMaterialB.opacity=(effectMode==='energy-rings'?.56:.28)*effectIntensity;
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
  setOptions(options={}){
   const camera=String(options.camera||'slow-orbit').toLowerCase();
   cameraMode=({orbit:'orbit','slow-orbit':'slow-orbit','dolly-in':'dolly-in','dolly-out':'dolly-out','whip-pan':'whip-pan'})[camera]||'slow-orbit';
   const effect=String(options.effect||'cinematic-particles').toLowerCase();
   effectMode=({particles:'cinematic-particles','cinematic-particles':'cinematic-particles','energy-rings':'energy-rings','light-streaks':'light-streaks',none:'none'})[effect]||'cinematic-particles';
   effectIntensity=Math.max(.25,Math.min(1.8,Number(options.intensity)||1));
   draw(elapsed);
   return {camera:cameraMode,effect:effectMode,intensity:effectIntensity};
  },
  play(){if(playing||disposed)return;playing=true;started=performance.now();raf=requestAnimationFrame(tick);},
  pause(){playing=false;cancelAnimationFrame(raf);draw(elapsed);},
  isPlaying(){return playing;},
  renderAt(t){draw(Math.max(0,Number(t)||0));},
  async exportFrames({width,height,frames,fps=30,start=0,duration=2.8,writeFrame}){
   const wasPlaying=playing;
   if(wasPlaying){playing=false;cancelAnimationFrame(raf);}
   const oldW=canvas.width,oldH=canvas.height,oldBaseCameraZ=baseCameraZ;
   const oldStyleW=canvas.style.width,oldStyleH=canvas.style.height;
   renderer.setClearColor(0x000000,0);
   renderer.setSize(width,height,false);
   camera.aspect=width/height;
   baseCameraZ=width/height<1.15?10.2:8.6;
   camera.position.z=baseCameraZ;
   camera.updateProjectionMatrix();
   try{
    for(let i=0;i<frames;i++){
     const t=Math.min(Math.max(0,duration),i/fps);
     draw(t);
     const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось получить PNG-кадр 3D')),'image/png'));
     const bytes=new Uint8Array(await blob.arrayBuffer());
     await writeFrame(i,bytes);
    }
   }finally{
    canvas.style.width=oldStyleW;canvas.style.height=oldStyleH;
    renderer.setSize(Math.max(1,canvas.clientWidth),Math.max(1,canvas.clientHeight),false);
    camera.aspect=Math.max(1,canvas.clientWidth)/Math.max(1,canvas.clientHeight);
    baseCameraZ=oldBaseCameraZ;camera.position.z=baseCameraZ;camera.updateProjectionMatrix();draw(0);
    if(wasPlaying&&!disposed){playing=true;started=performance.now();raf=requestAnimationFrame(tick);}
   }
   return ()=>{renderer.setClearColor(0x000000,0);};
  },
  dispose(){disposed=true;playing=false;cancelAnimationFrame(raf);ro.disconnect();if(mesh)mesh.geometry.dispose();particleGeometry.dispose();particleMaterial.dispose();ringA.geometry.dispose();ringB.geometry.dispose();ringMaterialA.dispose();ringMaterialB.dispose();mat.dispose();renderer.dispose();}
 };
}
