import { createMotionEngine, motionEasings } from './motion-engine.js';
import { synthesizeSfxWav } from './motion-audio.js';

const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,Number(n)||0));
const number=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
const keyOf=target=>typeof target==='string'?target:target?.id||target?.dataset?.motionId||'anonymous';

export function createMotionDirector({duration=1,fps=30}={}){
 const engine=createMotionEngine({duration,fps}),D=engine.duration,F=engine.fps;
 const scenes=[],cues=[],audio=[],frameHooks=[];let id=0;
 const add=(list,type,target,opts={})=>{
  const start=Math.max(0,number(opts.at??opts.start,0));
  const span=Math.max(0,number(opts.duration??opts.dur,type==='set'?0:.5));
  const cue={id:'motion-'+(++id),type,target:keyOf(target),start,duration:span,end:Math.min(D,start+span),...opts};
  list.push(cue);list.sort((a,b)=>a.start-b.start);return cue;
 };
 const tl={
  to(target,vars={},at=0){const {duration:dur=.5,ease='linear',...to}=vars;add(cues,'tween',target,{at,duration:dur,ease,to});return tl;},
  fromTo(target,from={},to={},at=0){const {duration:dur=.5,ease='linear',...values}=to;add(cues,'tween',target,{at,duration:dur,ease,from,to:values});return tl;},
  set(target,to={},at=0){add(cues,'set',target,{at,duration:0,to});return tl;}
 };
 function scene(target,start,end,opts={}){const s={id:opts.id||'scene-'+(++id),target:keyOf(target),start:Math.max(0,number(start)),end:Math.min(D,Math.max(number(start),number(end))),enter:opts.enter||'fade',exit:opts.exit||'fade',transitionIn:number(opts.transitionIn,.35),transitionOut:number(opts.transitionOut,.3),phase:opts.phase||'A'};scenes.push(s);return s;}
 function seq(items=[],{at=0,transition=.25}={}){let cursor=Math.max(0,number(at));return items.map((item,i)=>{const start=item.start===undefined?cursor:Math.max(0,number(item.start));const end=item.end===undefined?start+Math.max(.01,number(item.duration,1)):Math.max(start,number(item.end));const s=scene(item.target||item.id||'scene-'+i,start,end,{...item,transitionIn:item.transitionIn??transition,transitionOut:item.transitionOut??transition});cursor=end-Math.min(number(item.transitionOut??transition),Math.max(.01,(end-start)*.45));return {...s,source:item};});}
 function text(target,o={}){add(cues,'text-in',target,{at:o.at??0,duration:o.dur??.5,mode:o.in||'rise',by:o.by||'words',stagger:number(o.stagger,.08)});return api;}
 function textOut(target,o={}){add(cues,'text-out',target,{at:o.at??0,duration:o.dur??.3,mode:o.out||'blur'});return api;}
 function show(target,o={}){add(cues,'show',target,{at:o.at??0,duration:o.dur??.5,mode:o.in||'slide'});return api;}
 function count(target,o={}){add(cues,'count',target,{at:o.at??0,duration:o.dur??1,from:number(o.from),to:number(o.to,100),decimals:Math.max(0,Math.min(4,number(o.decimals)))});return api;}
 function captions(words=[],o={}){for(const w of words){const start=number(w.s??w.start),end=Math.max(start,number(w.e??w.end,start+.2));add(cues,'caption',o.target||'captions',{at:start,duration:end-start,text:String(w.w??w.text??''),word:w});}return api;}
 function effect(type,target,o={}){add(cues,type,target,{at:o.at??0,duration:o.duration??D,amplitude:number(o.amplitude,type==='shake'?7:8),period:Math.max(.1,number(o.period,2.4)),frequency:number(o.frequency,18)});return api;}
 function sfx(name,at,o={}){audio.push({id:'sfx-'+(++id),name:String(name),at:Math.max(0,number(at)),gain:number(o.gain),duration:Math.max(.01,number(o.duration,.12))});return api;}
 const draw={underline:(target,o={})=>{add(cues,'draw-underline',target,{at:o.at??0,duration:o.duration??.55,color:o.color||'#fff'});return api;},circle:(target,o={})=>{add(cues,'draw-circle',target,{at:o.at??0,duration:o.duration??.7,color:o.color||'#fff'});return api;},arrow:(target,o={})=>{add(cues,'draw-arrow',target,{at:o.at??0,duration:o.duration??.6,color:o.color||'#fff'});return api;},ring:(target,o={})=>{add(cues,'draw-ring',target,{at:o.at??0,duration:o.duration??.8,color:o.color||'#fff',radius:number(o.r2,80)});return api;},burst:(target,o={})=>{add(cues,'draw-burst',target,{at:o.at??0,duration:o.duration??.55,color:o.color||'#fff'});return api;}};
 function onFrame(callback){if(typeof callback!=='function')throw new TypeError('onFrame expects a function.');frameHooks.push(callback);return ()=>{const i=frameHooks.indexOf(callback);if(i>=0)frameHooks.splice(i,1);};}
 function renderAt(time){
  const t=clamp(number(time),0,D),frame=engine.sampleAt(t),elements={},effects=[];
  for(const c of cues){if(t<c.start)continue;const p=c.duration?clamp((t-c.start)/c.duration):1,values=elements[c.target]||(elements[c.target]={});
   if(c.type==='set')Object.assign(values,c.to||{});
   else if(c.type==='tween'){const easing=motionEasings[c.ease]||motionEasings.linear;for(const [name,to] of Object.entries(c.to||{})){const from=c.from?.[name]??values[name]??(name==='opacity'||name==='scale'?1:0);values[name]=typeof from==='number'&&typeof to==='number'?from+(to-from)*easing(p):(p<1?from:to);}}
   else if(c.type==='count')values.value=Number((number(c.from)+(number(c.to)-number(c.from))*(motionEasings.power2Out||motionEasings.linear)(p)).toFixed(c.decimals||0));
   else if(c.type==='float')values.y=Math.sin((t-c.start)*Math.PI*2/c.period)*c.amplitude;
   else if(c.type==='shake'){const local=t-c.start;values.x=Math.sin(local*c.frequency)*c.amplitude*Math.exp(-local*3);}
   else effects.push({...c,progress:p,visible:t<=c.end});
  }
  const activeScenes=scenes.filter(s=>t>=s.start&&t<=s.end).map(s=>({...s,opacity:Math.min(s.transitionIn?clamp((t-s.start)/s.transitionIn):1,s.transitionOut?clamp((s.end-t)/s.transitionOut):1)}));
  let output={...frame,time:t,scenes:activeScenes,elements,effects,audioEvents:audio.filter(a=>Math.abs(a.at-t)<.5/F)};for(const hook of frameHooks){const patch=hook(output);if(patch&&typeof patch==='object')output={...output,...patch};}return output;
 }
 function check(){const issues=[];for(const item of [...scenes,...cues,...audio]){const start=Number(item.start??item.at),span=Number(item.duration??0),end=Number(item.end??(start+span));if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(span))issues.push({id:item.id,code:'invalid-time'});if(span<0)issues.push({id:item.id,code:'negative-duration'});if(start<0)issues.push({id:item.id,code:'before-zero'});if(end>D+.0001)issues.push({id:item.id,code:'past-duration'});}return {ok:!issues.length,issues};}
 const api={duration:D,fps:F,tl,draw,engine,scene,seq,text,textOut,show,count,captions,float:(target,o={})=>effect('float',target,o),shake:(target,o={})=>effect('shake',target,o),sfx,onFrame,hit:(at,size='s')=>sfx(size==='l'?'impact-large':'impact-small',at,{gain:size==='l'?-2:-7,duration:size==='l'?.5:.12}),win:(target,o={})=>{add(cues,'video-window',target,{at:o.at??0,duration:o.duration??D,mask:o.mask||'rounded',fit:o.fit||'cover'});return api;},camera:(target,o={})=>{add(cues,'camera',target,{at:o.at??0,duration:o.duration??D,move:o.move||'slow-drift',parallax:number(o.parallax,.08)});return api;},chart:(target,data=[],o={})=>{add(cues,'chart',target,{at:o.at??0,duration:o.duration??1,data,kind:o.kind||'bar'});return api;},start(fn){fn({tl,f:F,D,M:api});return api;},renderAt,seekFrame:n=>renderAt(Math.max(0,Math.round(number(n)))/F),compile:()=>({version:1,duration:D,fps:F,scenes:scenes.map(x=>({...x})),cues:cues.map(x=>({...x})),audio:audio.map(x=>({...x}))}),synthesizeAudio:(options={})=>synthesizeSfxWav(audio,D,options),check,track:engine.track,hook:engine.hook,sampleAt:engine.sampleAt};
 return api;
}
