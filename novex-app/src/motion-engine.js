const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,Number(n)||0));
const easings={
 linear:t=>t,
 power2Out:t=>1-(1-t)*(1-t),
 power2In:t=>t*t,
 power3In:t=>t*t*t,
 power3Out:t=>1-Math.pow(1-t,3),
 power3InOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
 expoOut:t=>t===1?1:1-Math.pow(2,-10*t),
 circOut:t=>Math.sqrt(1-Math.pow(t-1,2)),
 elasticOut:t=>t===0||t===1?t:Math.pow(2,-10*t)*Math.sin((t*10-.75)*(2*Math.PI/3))+1,
 glide:t=>t<.5?8*Math.pow(t,4):1-Math.pow(-2*t+2,4)/2,
 bounceOut:t=>{const n=7.5625,d=2.75;if(t<1/d)return n*t*t;if(t<2/d){const x=t-1.5/d;return n*x*x+.75;}if(t<2.5/d){const x=t-2.25/d;return n*x*x+.9375;}const x=t-2.625/d;return n*x*x+.984375;},
 backOut:t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);},
 sineInOut:t=>-(Math.cos(Math.PI*t)-1)/2
};
function interpolate(from,to,p){
 if(typeof from==='number'&&typeof to==='number')return from+(to-from)*p;
 if(Array.isArray(from)&&Array.isArray(to)&&from.length===to.length)return from.map((v,i)=>interpolate(v,to[i],p));
 return p<1?from:to;
}
export function createMotionEngine({duration=1,fps=30,onFrame=null}={}){
 const D=Math.max(.001,Number(duration)||1),F=Math.max(1,Math.min(120,Number(fps)||30));
 const tracks=[],hooks=new Map();let lastFrame=null;
 function track(name,{start=0,duration:span=1,from=0,to=1,ease='linear',priority=0}={}){
  if(!name||typeof name!=='string')throw new TypeError('Motion track needs a name.');
  if(!Number.isFinite(Number(start))||!Number.isFinite(Number(span))||Number(span)<=0)throw new RangeError('Motion track timing must be finite and duration must be positive.');
  if(!(ease in easings))throw new Error('Unknown motion easing: '+ease);
  tracks.push({name,start:Math.max(0,Number(start)),duration:Number(span),from,to,ease,priority:Number(priority)||0,order:tracks.length});
  tracks.sort((a,b)=>a.start-b.start||a.priority-b.priority||a.order-b.order);
  return api;
 }
 function hook(event,callback){
  if(typeof callback!=='function')throw new TypeError('Motion hook must be a function.');
  if(!hooks.has(event))hooks.set(event,[]);
  hooks.get(event).push(callback);
  return ()=>{const list=hooks.get(event)||[];const i=list.indexOf(callback);if(i>=0)list.splice(i,1);};
 }
 function sampleAt(time){
  const t=Math.max(0,Math.min(D,Number(time)||0));let state={time:t,frame:Math.round(t*F),duration:D,fps:F};
  for(const item of tracks){
   if(t<item.start)continue;
   const p=clamp((t-item.start)/item.duration),e=easings[item.ease](p);
   state[item.name]=interpolate(item.from,item.to,e);
  }
  for(const callback of hooks.get('frame')||[]){
   const result=callback({time:t,frame:state.frame,duration:D,fps:F,state:{...state}});
   if(result&&typeof result==='object')state={...state,...result};
  }
  lastFrame=Object.freeze({...state});
  if(typeof onFrame==='function')onFrame(lastFrame);
  return lastFrame;
 }
 const api={
  track,hook,sampleAt,
  seekFrame(frame){return sampleAt(Math.max(0,Math.round(Number(frame)||0))/F);},
  get duration(){return D;},get fps(){return F;},
  get tracks(){return tracks.map(({order,...item})=>({...item}));},
  get lastFrame(){return lastFrame;},
  reset(){lastFrame=null;return api;}
 };
 return api;
}
export const motionEasings=Object.freeze({...easings});
export const motionHooks=Object.freeze({
 enter({duration=.72,ease='expoOut'}={}){return {from:{opacity:0,x:48,scale:.92,blur:14},to:{opacity:1,x:0,scale:1,blur:0},duration,ease};},
 exit({duration=.28,ease='power2In'}={}){return {from:{opacity:1,x:0,scale:1,blur:0},to:{opacity:0,x:-56,scale:.97,blur:12},duration,ease};},
 sway({amplitude=8,period=2.4}={}){return ({time})=>({y:Math.sin(time*Math.PI*2/period)*amplitude,rotationY:Math.sin(time*Math.PI*2/period)*7});},
 shake({amplitude=7,frequency=18}={}){return ({time})=>({x:Math.sin(time*frequency)*amplitude*Math.exp(-time*3)});}
});
