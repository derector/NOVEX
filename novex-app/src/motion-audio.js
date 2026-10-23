const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,Number(n)||0));
const number=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;

function sampleTone(type,t,duration){
 const low=type.includes('large')||type==='boom'||type==='impact' ? 74 : type.includes('small')||type==='tick' ? 1150 : type==='whoosh' ? 280 : type==='pop' ? 520 : 760;
 const high=type.includes('large')||type==='boom'||type==='impact' ? 36 : type.includes('small') ? 180 : type==='tick' ? 620 : type==='whoosh' ? 95 : type==='pop' ? 170 : 340;
 const f=low+(high-low)*(t/duration);
 const phase=2*Math.PI*(low*t+(high-low)*t*t/(2*duration));
 const body=Math.sin(phase);
 const overtone=Math.sin(phase*2.03)*.24;
 const click=Math.sin(2*Math.PI*(high*2.7)*t)*Math.exp(-t*42)*.32;
 const texture=type==='whoosh'?(Math.sin(2*Math.PI*133*t)+Math.sin(2*Math.PI*197*t)+Math.sin(2*Math.PI*241*t))*.12:0;
 return body+overtone+click+texture;
}

/** Deterministically synthesize short motion SFX into a mono PCM WAV for FFmpeg mixing. */
export function synthesizeSfxWav(cues=[],duration=1,{sampleRate=24000,masterGain=.32}={}){
 const sr=Math.max(8000,Math.min(48000,Math.round(number(sampleRate,24000))));
 const seconds=Math.max(.01,Math.min(900,number(duration,1)));
 const count=Math.ceil(seconds*sr),mix=new Float32Array(count);
 for(const cue of cues){
  const start=Math.max(0,number(cue.at??cue.start,0));
  if(start>=seconds)continue;
  const kind=String(cue.name??cue.kind??cue.type??'pop').toLowerCase();
  const length=Math.min(seconds-start,Math.max(.025,Math.min(1.4,number(cue.duration,kind.includes('large')?.48:kind==='whoosh'?.5:.14))));
  const offset=Math.floor(start*sr),frames=Math.min(count-offset,Math.ceil(length*sr));
  const gain=clamp(Math.pow(10,number(cue.gain,0)/20),0,4)*clamp(masterGain,0,1);
  for(let j=0;j<frames;j++){
   const t=j/sr,p=j/Math.max(1,frames-1);
   const attack=clamp(t/.004),release=Math.pow(1-p,kind.includes('large')?1.65:2.7);
   const envelope=attack*release;
   const wave=sampleTone(kind,t,length);
   mix[offset+j]+=wave*envelope*gain;
  }
 }
 const bytes=new Uint8Array(44+count*2),view=new DataView(bytes.buffer);
 const write=(offset,text)=>{for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);};
 write(0,'RIFF');view.setUint32(4,bytes.length-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sr,true);view.setUint32(28,sr*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,count*2,true);
 for(let i=0;i<count;i++){const s=Math.max(-1,Math.min(1,mix[i]));view.setInt16(44+i*2,Math.round(s*32767),true);}
 return bytes;
}
