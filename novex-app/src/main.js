import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import './style.css';
import { createLogoScene } from './motion3d.js';
import { cloud, cloudConfigured, cloudSession, cloudAuth, cloudListProjects, cloudSaveProject, cloudEmailLink, cloudSendSupportMessage } from './cloud.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S={refs:[],track:null,trackUrl:null,source:null,sourceUrl:null,duration:0,bpm:null,envelope:[],analysis:[],plan:null,output:null,outputName:'NOVEX.mp4',projects:[],busy:false,edits:[],editHistory:[]};
const ff=new FFmpeg();let loaded=false,timer;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=n=>{n=Math.max(0,Math.floor(n||0));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.round(n/1024)+' KB';
const radio=n=>document.querySelector('input[name="'+n+'"]:checked')?.value;
let cloudUser = null;
async function refreshCloudProjects(){
  if(!cloudUser || !cloudConfigured) return;
  try {
    const rows = await cloudListProjects();
    S.projects = rows.map(p => ({id:p.id,name:p.name,date:new Date(p.updated_at||p.created_at).toLocaleString('ru-RU'),summary:p.summary,cloud:true,project_data:p.project_data}));
    stats();
    if($('#view-projects').classList.contains('active')) view('projects');
  } catch (e) { toast('Не удалось загрузить облачные проекты: '+e.message,'error'); }
}
function cloudStatus(message,type=''){const el=$('#cloudStatus');if(el){el.textContent=message;el.className='cloud-status '+type;}}
function openCloudDialog(){ $('#cloudDialog').classList.remove('hidden'); $('#cloudPassword').value=''; cloudStatus(cloudConfigured?'Введи данные своего аккаунта NOVEX.':'Облако пока не настроено: добавь переменные Supabase в GitHub Actions.',cloudConfigured?'':'error'); $('#cloudLogout').hidden=!cloudUser; $('#cloudSignup').hidden=!!cloudUser; $('#cloudForm').querySelector('#cloudLogin').hidden=!!cloudUser; $('#cloudEmailLink').hidden=!!cloudUser; $('#cloudSupportWrap').classList.toggle('hidden',!cloudUser); $('#cloudEmail').value=cloudUser?.email||''; }
function toast(m,type=''){const e=$('#toast');e.textContent=m;e.className='toast show '+type;clearTimeout(timer);timer=setTimeout(()=>e.className='toast',4000);}
function busy(b,v,label){b.disabled=v;if(v){b.dataset.old=b.innerHTML;b.innerHTML='<span class="spinner"></span> '+esc(label);}else{b.innerHTML=b.dataset.old||b.innerHTML;delete b.dataset.old;}}
function step(n){['materialsPanel','directionPanel','renderPanel'].forEach((id,i)=>$('#'+id).classList.toggle('hidden',i!==n-1));$$('[data-step-indicator]').forEach(e=>{e.classList.toggle('active',+e.dataset.stepIndicator===n);e.classList.toggle('done',+e.dataset.stepIndicator<n)});$$('.progress-step').forEach(e=>{e.classList.toggle('active',+e.dataset.step===n);e.classList.toggle('done',+e.dataset.step<n)});$('#progressTrack').style.width=((n-1)*50)+'%';}
function stats(){$('#statRefs').textContent=S.refs.length;$('#statDuration').textContent=S.track?clock(S.duration):'—';$('#statBpm').textContent=S.bpm?Math.round(S.bpm)+' BPM':'—';$('#projectCount').textContent=S.projects.length;}
function library(){let a=[...S.refs.map(x=>({t:'Референс',n:x.file.name,m:clock(x.duration)+' · '+size(x.file.size)})),...(S.track?[{t:'Аудио',n:S.track.name,m:clock(S.duration)+' · '+size(S.track.size)}]:[]),...(S.source?[{t:'Источник',n:S.source.name,m:size(S.source.size)}]:[])];$('#libraryGrid').innerHTML=a.length?a.map(x=>'<div class="library-item"><span class="library-type">'+esc(x.t)+'</span><b>'+esc(x.n)+'</b><small>'+esc(x.m)+'</small></div>').join(''):'<div class="empty-card"><b>Медиатека пуста</b><p>Добавь файлы в студии.</p></div>';}
function signals(a){$('#analysisSignals').innerHTML=a.length?a.map(x=>'<div class="signal-row"><span class="signal-dot '+(x.ok?'good':'')+'"></span><div><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small></div><span class="signal-value">'+esc(x.value)+'</span></div>').join(''):'<div class="signal-empty">После анализа появятся параметры материалов.</div>';}
function refList(){const box=$('#referenceList');box.innerHTML='';S.refs.forEach((x,index)=>{const d=document.createElement('div');d.className='media-item media-item-rich';d.innerHTML='<button class="ref-preview" type="button" aria-label="Посмотреть '+esc(x.file.name)+'"><video src="'+x.url+'" muted playsinline preload="metadata"></video><span>▶</span></button><div class="media-copy"><b title="'+esc(x.file.name)+'">'+esc(x.file.name)+'</b><small>'+clock(x.duration)+' · '+x.w+'×'+x.h+' · '+size(x.file.size)+'</small><div class="mini-tags"><span>'+(x.a?'✓ Проанализирован':'Референс '+(index+1))+'</span></div><button class="text-button ref-open" type="button">Смотреть видео ↗</button></div><button class="remove-btn" aria-label="Удалить">×</button>';d.querySelector('.ref-preview').onclick=d.querySelector('.ref-open').onclick=()=>{const preview=$('#previewVideo');preview.pause();preview.src=x.url;preview.dataset.referencePreview=x.url;preview.muted=true;preview.hidden=false;$('#previewStage .preview-placeholder').hidden=true;$('#previewStage').classList.add('has-preview');preview.load();preview.play().catch(()=>{});$('#playPreview').textContent='Ⅱ';};d.querySelector('.remove-btn').onclick=()=>{URL.revokeObjectURL(x.url);S.refs=S.refs.filter(y=>y!==x);refList();stats();};box.append(d);});$('#referenceDrop').classList.toggle('has-files',S.refs.length>0);
  if(S.refs.length&&!S.output){
    const preview=$('#previewVideo');
    if(!preview.dataset.referencePreview||!S.refs.some(x=>x.url===preview.dataset.referencePreview)){
      preview.pause();preview.src=S.refs[0].url;preview.dataset.referencePreview=S.refs[0].url;
      preview.muted=true;preview.hidden=false;$('#previewStage .preview-placeholder').hidden=true;
      $('#previewStage').classList.add('has-preview');preview.load();
    }
  }
  stats();library();
}
async function probe(file){const u=URL.createObjectURL(file),v=document.createElement('video');v.preload='metadata';v.muted=true;v.src=u;try{await new Promise((resolve,reject)=>{v.onloadedmetadata=resolve;v.onerror=()=>reject(new Error('Невозможно прочитать '+file.name));});return {id:crypto.randomUUID?.()||String(Math.random()),file,url:u,duration:Number.isFinite(v.duration)?v.duration:0,w:v.videoWidth,h:v.videoHeight,color:['#553b86','#246779','#77552d','#6b3554'][S.refs.length%4]};}catch(e){URL.revokeObjectURL(u);throw e;}}
async function addRefs(files){for(const f of [...files])if(f.type.startsWith('video/')||/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)){try{S.refs.push(await probe(f));}catch(e){toast(e.message,'error');}}refList();if(files.length)toast('Референсы добавлены.');}
$('#referenceInput').onchange=e=>addRefs(e.target.files);
const drop=$('#referenceDrop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag-over')};drop.ondragleave=()=>drop.classList.remove('drag-over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag-over');addRefs(e.dataTransfer.files)};
$('#trackInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;S.track=f;S.trackUrl=URL.createObjectURL(f);const au=$('#trackAudio');au.src=S.trackUrl;au.hidden=false;await new Promise(r=>{au.onloadedmetadata=r;au.onerror=r});S.duration=Number.isFinite(au.duration)?au.duration:0;$('#trackName').textContent=f.name;$('#trackMeta').textContent=clock(S.duration)+' · '+size(f.size);$('#fullDurationLabel').textContent='Вся длительность · '+clock(S.duration);stats();library();toast('Трек загружен.');};
$('#sourceVideoInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const p=await probe(f);S.source=f;S.sourceUrl=p.url;$('#sourceVideoName').textContent=f.name;$('#sourceVideoMeta').textContent=clock(p.duration)+' · '+p.w+'×'+p.h;$('#sourceTranscriptWrap').classList.remove('hidden');library();}catch(err){toast(err.message,'error')}};
function bpmEstimate(buf){const x=buf.getChannelData(0),sr=buf.sampleRate,ws=Math.floor(sr*.01),env=[];for(let i=0;i+ws<x.length;i+=ws){let a=0;for(let j=i;j<i+ws;j+=4)a+=x[j]*x[j];env.push(Math.sqrt(a/(ws/4)));}const d=env.map((v,i)=>i?Math.max(0,v-env[i-1]):0),avg=d.reduce((a,b)=>a+b,0)/d.length;let best={s:-1,b:0};for(let b=65;b<=180;b+=.5){const lag=Math.round(6000/b);let s=0;for(let i=lag;i<d.length;i++)s+=(d[i]-avg)*(d[i-lag]-avg);if(s>best.s)best={s,b};}return best.b||null;}
function audioEnvelope(buf){const x=buf.getChannelData(0),sr=buf.sampleRate,ws=Math.max(1,Math.floor(sr*.05)),env=[];for(let i=0;i<x.length;i+=ws){let sum=0,n=0;for(let j=i;j<Math.min(x.length,i+ws);j+=4){sum+=x[j]*x[j];n++}env.push(Math.sqrt(sum/Math.max(1,n)));}return env;}
function bestMusicWindow(duration){const env=S.envelope;if(!env.length||!S.duration)return 0;const frame=.05,win=Math.max(1,Math.min(env.length,Math.round(duration/frame))),hop=Math.max(1,Math.round(1/frame));let max=0,scoreBest=-Infinity;const vals=env.filter(Number.isFinite).sort((a,b)=>a-b),q=vals[Math.floor(vals.length*.85)]||1;for(let i=0;i+win<=env.length;i+=hop){let sum=0,peak=0,changes=0,prev=env[i]||0;for(let j=i;j<i+win;j++){const v=env[j]||0;sum+=Math.min(v/q,2);peak+=v*v;if(j>i){changes+=Math.abs(v-prev);prev=v;}}const mean=sum/win,variance=Math.sqrt(peak/win),motion=changes/win;const score=mean*.55+(variance/q)*.25+(motion/q)*.20;if(score>scoreBest){scoreBest=score;max=i*frame;}}return Math.max(0,Math.min(max,S.duration-duration));}
async function analyzeFrames(x){const v=document.createElement('video');v.muted=true;v.src=x.url;await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=()=>j(Error('не удалось декодировать видео'))});const c=document.createElement('canvas');c.width=48;c.height=27;const g=c.getContext('2d',{willReadFrequently:true});let prev=null,cuts=0,light=0;const count=Math.min(8,Math.max(3,Math.ceil(x.duration/8)));for(let k=0;k<count;k++){v.currentTime=x.duration*(k+.5)/count;await new Promise(r=>{let done=false;const f=()=>{if(!done){done=true;r()}};v.onseeked=f;setTimeout(f,1600)});try{g.drawImage(v,0,0,48,27);const p=g.getImageData(0,0,48,27).data,ar=[];let l=0;for(let i=0;i<p.length;i+=4){const z=Math.round((.2126*p[i]+.7152*p[i+1]+.0722*p[i+2])/16);ar.push(z);l+=z*16}light+=l/(48*27);if(prev){let diff=0;for(let i=0;i<ar.length;i++)diff+=Math.abs(ar[i]-prev[i]);if(diff/ar.length>3.5)cuts++}prev=ar}catch{}}return {frames:count,cuts,brightness:Math.round(light/count),orientation:x.w>x.h?'Горизонтальный':x.w===x.h?'Квадратный':'Вертикальный'};}
$('#analyzeBtn').onclick=async()=>{if(!S.refs.length||!S.track){toast('Добавь хотя бы один референс и музыкальный трек.','warn');return;}const b=$('#analyzeBtn');busy(b,true,'Анализируем…');const a=[];try{await Promise.all(S.refs.map(async x=>{try{x.a=await analyzeFrames(x);a.push({title:x.file.name,detail:x.a.frames+' выборочных кадров · '+x.a.orientation+' · яркость '+x.a.brightness+'/255',value:x.a.cuts+' смен',ok:true});}catch(err){a.push({title:x.file.name,detail:err.message,value:'Ошибка',ok:false})}}));const ctx=new (window.AudioContext||window.webkitAudioContext)();try{const audio=await ctx.decodeAudioData((await S.track.arrayBuffer()).slice(0));S.duration=audio.duration;S.bpm=bpmEstimate(audio);S.envelope=audioEnvelope(audio);a.push({title:'Музыкальный анализ',detail:'Web Audio · '+audio.sampleRate+' Hz · '+clock(audio.duration)+' · оценка энергии и атак',value:Math.round(S.bpm||0)+' BPM',ok:true});}finally{await ctx.close()}a.push({title:'Текст',detail:$('#lyrics').value.trim()?$('#lyrics').value.trim().split(/\s+/).length+' слов · требуется сверить таймкоды':'Не добавлен — титры можно отключить',value:$('#lyrics').value.trim()?'Есть':'Нет',ok:true});S.analysis=a;signals(a);refList();step(2);toast('Анализ завершён. Это выборочная эвристика, не точная реконструкция движения.');}catch(err){toast('Анализ не завершён: '+err.message,'error')}finally{busy(b,false)}};
$$('input[name="durationMode"]').forEach(x=>x.onchange=()=>{$('#clipControls').classList.toggle('hidden',radio('durationMode')!=='clip');$$('.choice-card').forEach(c=>{const i=c.querySelector('input');if(i?.name==='durationMode')c.classList.toggle('selected',i.checked)});});
$$('input[name="styleMode"]').forEach(x=>x.onchange=()=>$$('.choice-card').forEach(c=>{const i=c.querySelector('input');if(i?.name==='styleMode')c.classList.toggle('selected',i.checked)}));
function lyricLines(){const text=$('#lyrics').value.trim();if(!text||!$('#burnLyrics').checked)return [];const words=text.replace(/\r/g,'').split(/\s+/).filter(Boolean),lines=[];for(let i=0;i<words.length;i+=5)lines.push(words.slice(i,i+5).join(' '));const range=renderRange();return lines.map((t,i)=>({text:t,start:range.start+range.duration*i/Math.max(1,lines.length),end:range.start+range.duration*(i+1)/Math.max(1,lines.length)}));}
function renderRange(){if(radio('durationMode')==='clip'){let s=Math.max(0,Number($('#clipStart').value)||0);s=Math.min(s,Math.max(0,S.duration-1));return {start:s,duration:Math.max(1,Math.min(Number($('#clipDuration').value)||25,S.duration-s))};}return {start:0,duration:S.duration};}
$('#syncLyrics').onclick=()=>{if(!S.track||!$('#lyrics').value.trim()){toast('Сначала добавь трек и текст.','warn');return}const count=Math.ceil($('#lyrics').value.trim().split(/\s+/).length/5);toast('Текст разделён ориентировочно на '+count+' строки; это не ASR и таймкоды не являются точными.');};
$('#suggestClip').onclick=()=>{if(!S.duration){toast('Сначала загрузи и проанализируй трек.','warn');return}const d=Math.min(30,Math.max(20,Math.round(S.duration*.18)));const start=bestMusicWindow(d);$('#clipStart').value=start.toFixed(1);$('#clipDuration').value=d;toast('Выбран музыкально выразительный фрагмент по энергии и атакам. Смысл припева и слова автоматически не распознаны — проверь прослушиванием.');};
function makePlan(){if(!S.refs.length||!S.track)throw Error('Нужны референсы и трек.');const range=renderRange();if(range.duration<.2||range.start>=S.duration)throw Error('Проверь диапазон трека.');const mode=radio('styleMode')||'inspired',beat=!!$('#beatCut').checked,lines=lyricLines(),period=S.bpm?60/S.bpm:1.8,shot=Math.max(1.4,Math.min(5,beat?period*(mode==='faithful'?4:2):3.4));const timeline=[];let t=0,i=0;while(t<range.duration&&i<120){const ref=mode==='faithful'?S.refs[Math.min(S.refs.length-1,Math.floor(t/range.duration*S.refs.length))]:S.refs[i%S.refs.length];timeline.push({start:t,end:Math.min(range.duration,t+shot),ref});t+=shot;i++;}return {range,mode,lines,timeline,aspect:radio('aspect')||'16:9',resolution:Number(radio('resolution'))||720};}
function showPlan(p){$('#planSummary').innerHTML='<div class="summary-grid"><div><small>РЕЖИМ</small><b>'+({faithful:'Почти 1:1',inspired:'По мотивам',original:'Своя идея'}[p.mode])+'</b></div><div><small>ФРАГМЕНТ</small><b>'+clock(p.range.start)+'–'+clock(p.range.start+p.range.duration)+'</b></div><div><small>БЛОКИ</small><b>'+p.timeline.length+'</b></div><div><small>ФОРМАТ</small><b>'+p.aspect+' · '+p.resolution+'p</b></div></div><p class="micro-note">Режим влияет на порядок и среднюю длительность планов. Это не обещает покадровую копию референсов.</p>';const ruler=$('#timelineRuler');ruler.innerHTML='';for(let i=0;i<=5;i++){const s=document.createElement('span');s.textContent=clock(p.range.duration*i/5);s.style.left=i*20+'%';ruler.append(s)}const tracks=$('#timelineTracks');tracks.innerHTML='';const row=document.createElement('div');row.className='timeline-track';row.innerHTML='<b>VIDEO</b><div class="clips"></div>';p.timeline.forEach((s,i)=>{const d=document.createElement('div');d.className='timeline-clip clip-'+(i%5);d.style.left=s.start/p.range.duration*100+'%';d.style.width=(s.end-s.start)/p.range.duration*100+'%';d.title=s.ref.file.name;d.innerHTML='<span>'+esc((i+1)+'. '+s.ref.file.name)+'</span>';row.querySelector('.clips').append(d)});tracks.append(row);const au=document.createElement('div');au.className='timeline-track';au.innerHTML='<b>AUDIO</b><div class="audio-clip" style="width:100%"><span>♫ '+esc(S.track.name)+'</span></div>';tracks.append(au);const tx=document.createElement('div');tx.className='timeline-track';tx.innerHTML='<b>TEXT</b><div class="clips"></div>';p.lines.forEach(l=>{const d=document.createElement('div');d.className='timeline-clip text-clip';d.style.left=Math.max(0,l.start-p.range.start)/p.range.duration*100+'%';d.style.width=Math.max(.02,(l.end-l.start)/p.range.duration*100)+'%';d.title=l.text;d.innerHTML='<span>'+esc(l.text)+'</span>';tx.querySelector('.clips').append(d)});tracks.append(tx);}
$('#planBtn').onclick=()=>{try{S.plan=makePlan();showPlan(S.plan);$('#renderProgressWrap').classList.add('hidden');$('#exportResult').classList.add('hidden');step(3);$('#renderStatus').textContent='ГОТОВ К РЕНДЕРУ';toast('Монтажный план сформирован.');const project={id:Date.now(),name:S.track.name.replace(/\.[^.]+$/,''),date:new Date().toLocaleString('ru-RU'),summary:S.refs.length+' референсов · '+clock(S.plan.range.duration)+' · '+S.plan.aspect,project_data:{range:S.plan.range,mode:S.plan.mode,aspect:S.plan.aspect,resolution:S.plan.resolution,referenceNames:S.refs.map(x=>x.file.name),trackName:S.track.name,timeline:S.plan.timeline.map(x=>({start:x.start,end:x.end,referenceName:x.ref.file.name})),lyrics:S.plan.lines}};S.projects.unshift(project);S.projects=S.projects.slice(0,15);stats();if(cloudUser){cloudSaveProject(project).then(()=>{toast('Монтажный план сохранён в облако.','success');refreshCloudProjects()}).catch(e=>toast('План создан, но облачное сохранение не удалось: '+e.message,'warn'));}}catch(e){toast(e.message,'error')}};
function progress(n,title,log){$('#renderProgressWrap').classList.remove('hidden');$('#renderStage').textContent=title;$('#renderPercent').textContent=Math.round(n)+'%';$('#renderBar').style.width=Math.max(0,Math.min(100,n))+'%';$('#renderLog').textContent=log;}
async function ffReady(){
  if(loaded)return;
  const base=new URL(import.meta.env.BASE_URL+'ffmpeg/',window.location.href);
  const coreUrl=new URL('ffmpeg-core.js',base).href;
  const wasmUrl=new URL('ffmpeg-core.wasm',base).href;
  ff.on('log',o=>{if(o.message)$('#renderLog').textContent=o.message.slice(-170)});
  ff.on('progress',o=>progress(40+Math.min(1,o.progress)*55,'Кодирую MP4…','FFmpeg WebAssembly выполняет реальный рендер.'));
  try{
    // Keep the core and WASM on stable same-origin URLs. Blob URLs can fail
    // inside the FFmpeg worker on mobile browsers / WebView.
    const [coreResponse,wasmResponse]=await Promise.all([
      fetch(coreUrl,{cache:'no-store'}),
      fetch(wasmUrl,{cache:'no-store'})
    ]);
    if(!coreResponse.ok)throw new Error('HTTP '+coreResponse.status+' при загрузке ffmpeg-core.js');
    if(!wasmResponse.ok)throw new Error('HTTP '+wasmResponse.status+' при загрузке ffmpeg-core.wasm');
    const [coreBlob,wasmBlob]=await Promise.all([coreResponse.blob(),wasmResponse.blob()]);
    if(!coreBlob.size||!wasmBlob.size)throw new Error('Файл движка пустой.');
    if(!/javascript|ecmascript|text\/plain|octet-stream/i.test(coreResponse.headers.get('content-type')||'') && coreBlob.size<1024)
      throw new Error('Вместо JS-движка получен подозрительно маленький ответ.');
    if(wasmBlob.size<1024*1024)throw new Error('WASM-движок слишком мал или вместо него загружена HTML-страница.');
    await ff.load({coreURL:coreUrl,wasmURL:wasmUrl});
    loaded=true;
  }catch(e){
    const reason=e?.message||String(e)||'неизвестная ошибка';
    throw new Error('Не удалось загрузить FFmpeg. JS: '+coreUrl+'; WASM: '+wasmUrl+'. '+reason+' Проверь доступность файлов и обнови страницу.');
  }
}

async function exportKineticTitle({text,width,height,duration,fps=15,writeFrame}){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D недоступен для титров.');
 const words=String(text||'NOVEX').replace(/\s+/g,' ').trim().slice(0,120).split(' ');
 const fontSize=Math.max(28,Math.round(height*.075));ctx.font='800 '+fontSize+'px Arial, sans-serif';
 const lines=[];let line='';
 for(const word of words){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width>width*.84&&line){lines.push(line);line=word;}else line=candidate;}
 if(line)lines.push(line);const visible=lines.slice(0,3),lineHeight=fontSize*1.15;
 const frames=Math.max(1,Math.min(90,Math.ceil(duration*fps)));
 for(let i=0;i<frames;i++){
  const t=i/fps,fade=Math.min(1,t/.28,Math.max(0,(duration-t)/.28));
  const spring=1-.16*Math.exp(-10*t)*Math.cos(13*t);
  ctx.clearRect(0,0,width,height);ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,fade));
  ctx.translate(width/2,height*.48);ctx.scale(spring,spring);ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='800 '+fontSize+'px Arial, sans-serif';ctx.lineJoin='round';ctx.lineWidth=Math.max(3,fontSize*.09);
  ctx.strokeStyle='rgba(5,7,18,.9)';ctx.fillStyle='#ffffff';ctx.shadowColor='rgba(76,220,255,.85)';ctx.shadowBlur=fontSize*.55;
  const y0=-(visible.length-1)*lineHeight/2+Math.sin(Math.min(1,t/.3)*Math.PI/2)*height*.035;
  visible.forEach((line,j)=>{const y=y0+j*lineHeight;ctx.strokeText(line,0,y);ctx.fillText(line,0,y);});
  ctx.restore();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось создать кадр титра.')),'image/png'));
  await writeFrame(i,new Uint8Array(await blob.arrayBuffer()));
 }
}

$('#renderBtn').onclick=async()=>{if(S.busy)return;if(!S.plan){toast('Сначала собери монтажный план.','warn');return;}S.busy=true;const b=$('#renderBtn');busy(b,true,'Рендеринг…');$('#renderStatus').textContent='РЕНДЕРИНГ';$('#renderStatus').className='render-status is-running';$('#exportResult').classList.add('hidden');try{progress(2,'Загружаю движок…','FFmpeg WebAssembly.');await ffReady();const p=S.plan,r=p.range,W=p.aspect==='9:16'?Math.round(p.resolution*9/16/2)*2:p.aspect==='1:1'?p.resolution:Math.round(p.resolution*16/9/2)*2,H=p.aspect==='16:9'?Math.round(p.resolution*9/16/2)*2:p.resolution;const entries=[];
if(S.source){
 const sourceExt=(S.source.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'');
 const sourceInput='source-video.'+sourceExt;
 progress(5,'Подготавливаю исходное видео…',S.source.name+' · сохраняю кадры в выбранном формате');
 await ff.writeFile(sourceInput,await fetchFile(S.source));
 const sourceArgs=['-i',sourceInput,'-vf',`tpad=stop_mode=clone:stop_duration=${r.duration},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`,'-an','-c:v','libx264','-preset','ultrafast','-crf','25','-t',String(r.duration),'-y','silent.mp4'];
 if(await ff.exec(sourceArgs)!==0)throw Error('Не удалось подготовить исходное видео. Попробуй MP4/H.264 или более короткий файл.');
}else{
for(let i=0;i<p.timeline.length;i++){const s=p.timeline[i],f='ref'+i+'.mp4',part='part'+i+'.mp4';progress(5+30*i/p.timeline.length,'Подготавливаю фрагменты…',(i+1)+' / '+p.timeline.length+' · '+s.ref.file.name);if(!s.ref._ff) {s.ref._ff='source'+S.refs.indexOf(s.ref)+'.mp4';await ff.writeFile(s.ref._ff,await fetchFile(s.ref.file));}const start=Math.max(0,s.ref.duration?((s.start%Math.max(1,s.ref.duration*.35))):0),dur=Math.max(.1,s.end-s.start);const res=await ff.exec(['-ss',String(start),'-i',s.ref._ff,'-t',String(dur),'-vf',`scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,setsar=1,format=yuv420p`,'-an','-c:v','libx264','-preset','ultrafast','-crf','25','-y',part]);if(res!==0)throw Error('Ошибка кодирования фрагмента '+(i+1));entries.push("file '"+part+"'");}await ff.writeFile('concat.txt',new TextEncoder().encode(entries.join('\n')));progress(38,'Собираю монтаж…','Объединяю '+entries.length+' клипов.');if(await ff.exec(['-f','concat','-safe','0','-i','concat.txt','-c','copy','-y','silent.mp4'])!==0)throw Error('Не удалось соединить клипы.');

}
const threeDEdit=(S.edits||[]).find(e=>e.type==='add_3d_title');
if(threeDEdit){
 if(!motion3d)start3DPreview(threeDEdit.text||'NOVEX');
 if(!motion3d)throw Error('Не удалось создать 3D-сцену для экспорта.');
 const fps=30,frames=Math.max(1,Math.min(Math.ceil(Math.min(threeDEdit.duration||2.8,r.duration)*fps),180));
 progress(40,'Рендерю 3D-слой…',frames+' прозрачных кадров в разрешении '+W+'×'+H);
 const restore=await motion3d.exportFrames({width:W,height:H,frames,fps,start:Math.max(0,threeDEdit.start||0),duration:Math.min(threeDEdit.duration||2.8,r.duration),writeFrame:async(i,bytes)=>ff.writeFile('3d_'+String(i).padStart(4,'0')+'.png',bytes)});
 const overlayStart=Math.max(0,Number(threeDEdit.start)||0),overlayEnd=Math.min(r.duration,overlayStart+(threeDEdit.duration||2.8));
 const overlayArgs=['-i','silent.mp4','-itsoffset',String(overlayStart),'-framerate',String(fps),'-start_number','0','-i','3d_%04d.png','-filter_complex',"[0:v][1:v]overlay=0:0:enable='between(t,"+overlayStart.toFixed(3)+","+overlayEnd.toFixed(3)+")':eof_action=pass:shortest=0,format=yuv420p[v]",'-map','[v]','-an','-c:v','libx264','-preset','ultrafast','-crf','25','-t',String(r.duration),'-y','composite.mp4'];
 if(await ff.exec(overlayArgs)!==0)throw Error('Не удалось наложить 3D-слой на видео.');
 const composite=await ff.readFile('composite.mp4');await ff.writeFile('silent.mp4',composite);
 for(let i=0;i<frames;i++)try{await ff.deleteFile('3d_'+String(i).padStart(4,'0')+'.png')}catch{}
 restore();
}
const titleEdits=(S.edits||[]).filter(e=>e.type==='add_kinetic_title'&&String(e.text||'').trim());
for(let ti=0;ti<titleEdits.length;ti++){
 const edit=titleEdits[ti],overlayStart=Math.max(0,Number(edit.start)||0);
 const titleDuration=Math.min(Math.max(.5,Number(edit.duration)||2),Math.max(.1,r.duration-overlayStart));
 if(overlayStart>=r.duration)continue;
 const fps=15,frames=Math.max(1,Math.min(90,Math.ceil(titleDuration*fps)));
 progress(40,'Рендерю кинетические титры…',(ti+1)+' / '+titleEdits.length+' · '+String(edit.text).slice(0,48));
 await exportKineticTitle({text:edit.text,width:W,height:H,duration:titleDuration,fps,writeFrame:async(i,bytes)=>ff.writeFile('title_'+String(i).padStart(4,'0')+'.png',bytes)});
 const titleArgs=['-i','silent.mp4','-itsoffset',String(overlayStart),'-framerate',String(fps),'-start_number','0','-i','title_%04d.png','-filter_complex',"[0:v][1:v]overlay=0:0:enable='between(t,"+overlayStart.toFixed(3)+","+(overlayStart+titleDuration).toFixed(3)+")':eof_action=pass:shortest=0,format=yuv420p[v]",'-map','[v]','-an','-c:v','libx264','-preset','ultrafast','-crf','25','-t',String(r.duration),'-y','title-composite.mp4'];
 if(await ff.exec(titleArgs)!==0)throw Error('Не удалось наложить кинетические титры.');
 await ff.writeFile('silent.mp4',await ff.readFile('title-composite.mp4'));
 for(let i=0;i<frames;i++)try{await ff.deleteFile('title_'+String(i).padStart(4,'0')+'.png')}catch{}
}
const ext=(S.track.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'');await ff.writeFile('music.'+ext,await fetchFile(S.track));const args=['-i','silent.mp4','-ss',String(r.start),'-t',String(r.duration),'-i','music.'+ext];const lyrics=p.lines.map((l,i)=>(i+1)+'\n'+srt(Math.max(0,l.start-r.start))+' --> '+srt(Math.max(.1,l.end-r.start))+'\n'+l.text).join('\n\n');let vf='null';if(lyrics&&$('#burnLyrics').checked){await ff.writeFile('lyrics.srt',new TextEncoder().encode(lyrics));vf="subtitles=lyrics.srt:force_style='FontSize="+Math.max(18,Math.round(H/38))+",Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV="+Math.round(H*.08)+"'";}const gradeEdit=(S.edits||[]).some(e=>e.type==='grade');if(gradeEdit)vf=(vf==='null'?'':vf+',')+'eq=brightness=0.035:saturation=1.22';
progress(42,'Добавляю музыку и титры…','Свожу дорожки и готовлю MP4.');args.push('-vf',vf,'-map','0:v:0','-map','1:a:0','-t',String(r.duration),'-c:v','libx264','-preset','ultrafast','-crf',p.resolution>720?'22':'26','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-y','export.mp4');if(await ff.exec(args)!==0)throw Error('Не удалось финализировать MP4. Попробуй более короткий отрывок или 480p.');progress(97,'Проверяю результат…','Читаю созданный MP4.');const data=await ff.readFile('export.mp4'),blob=new Blob([data.buffer],{type:'video/mp4'});if(blob.size<1000)throw Error('Файл MP4 пуст или некорректен.');if(S.output)URL.revokeObjectURL(S.output);S.output=URL.createObjectURL(blob);S.outputName='NOVEX_'+new Date().toISOString().replace(/[:.]/g,'-')+'.mp4';const v=$('#previewVideo');v.src=S.output;v.hidden=false;$('#previewStage .preview-placeholder').hidden=true;$('#previewStage').classList.add('has-preview');$('#exportMeta').textContent='MP4 · H.264/AAC · '+size(blob.size)+' · '+W+'×'+H;$('#exportResult').classList.remove('hidden');$('#renderStatus').textContent='ГОТОВО';$('#renderStatus').className='render-status is-done';progress(100,'Экспорт готов','MP4 создан. Нажми «Скачать MP4».');toast('MP4 готов: '+size(blob.size),'success');}catch(e){console.error(e);$('#renderStatus').textContent='ОШИБКА';$('#renderStatus').className='render-status has-error';progress(0,'Рендер не завершён',e?.message||String(e)||'Неизвестная ошибка FFmpeg');toast(e?.message||String(e)||'Неизвестная ошибка FFmpeg','error')}finally{S.busy=false;busy(b,false);}};

// Natural-language motion commands: validated project patches, never eval/model code execution.
const EDIT_PRESETS={
  '3d':{type:'add_3d_title',label:'3D-логотип',text:'NOVEX',start:0,duration:2.8,style:{geometry:'extruded-text',material:'chrome',camera:'slow-orbit',lighting:'cinematic-rim',depth:1}},
  'titles':{type:'add_kinetic_title',label:'Кинетический текст',text:'',start:0,duration:2,style:{entrance:'spring-up',exit:'fade-out',easing:'back-out'}},
  'subtitles':{type:'add_subtitles',label:'Субтитры',start:0,duration:0,style:{position:'safe-bottom',highlight:'active-word'}}
};
let motion3d=null;
function start3DPreview(label='NOVEX'){
 const canvas=$('#motion3dCanvas');
 if(!canvas)return;
 try{
  if(!motion3d)motion3d=createLogoScene(canvas);
  motion3d.setText(label);
  motion3d.play();
  $('#motion3dStatus').textContent='Воспроизведение 3D-сцены';
  $('#motion3dPlay').textContent='Ⅱ Пауза 3D-превью';
 }catch(e){$('#motion3dStatus').textContent='WebGL недоступен: '+(e?.message||e);toast('3D-превью не запустилось: '+(e?.message||e),'error');}
}
$('#motion3dPlay').onclick=()=>{
 if(!motion3d){start3DPreview();return;}
 if(motion3d.isPlaying()){motion3d.pause();$('#motion3dStatus').textContent='Пауза';$('#motion3dPlay').textContent='▶ Продолжить 3D-превью';}
 else{motion3d.play();$('#motion3dStatus').textContent='Воспроизведение 3D-сцены';$('#motion3dPlay').textContent='Ⅱ Пауза 3D-превью';}
};
function commandToPatch(raw){
  const q=raw.trim().toLowerCase();
  if(!q)throw Error('Напиши, что нужно изменить.');
  if(/\b(отмен|undo|верни предыдущ|откат)\b/.test(q))return {type:'undo',label:'Отменить последнюю правку'};
  if(/\b(3d|3д|объ[её]мн|тр[её]хмер|камера (?:облет|облёт|вращ)|экструд)/.test(q)){const quoted=raw.match(/[«"]([^»"]{1,32})[»"]/);const named=raw.match(/(?:логотип|слово)\s+([\p{L}\p{N}_-]{2,24})/iu);return {...EDIT_PRESETS['3d'],text:(quoted?.[1]||named?.[1]||'NOVEX').trim()};}
  if(/субтитр|подсвечивай слово|караоке/.test(q))return {...EDIT_PRESETS.subtitles};
  if(/титр|текст|надпис|типограф|букв/.test(q)){const quoted=raw.match(/[«"]([^»"]{1,120})[»"]/);const named=raw.match(/(?:текст|надпись)\s*[:—-]\s*(.{1,120})$/iu);return {...EDIT_PRESETS.titles,text:(quoted?.[1]||named?.[1]||'NOVEX').trim()};}
  if(/ярче|цвет|свет|свечение|glow|неон/.test(q))return {type:'grade',label:'Свет и цвет',style:{look:'neon-glow'}};
  if(/быстр|динамич|под бит|ритм/.test(q))return {type:'motion_timing',label:'Динамика и ритм',style:{pace:'faster',beatSync:true}};
  if(/плавн|переход|камера|зум|приближ/.test(q))return {type:'camera_motion',label:'Движение камеры',style:{move:/зум|приближ/.test(q)?'dolly-in':'smooth-transition',easing:'cinematic-ease'}};
  throw Error('Пока не распознал тип правки. Попробуй: «добавь 3D-логотип», «сделай кинетические титры», «добавь субтитры», «сделай неоновое свечение» или «сделай переход плавнее».');
}
function renderDirectorPlan(){
 const box=$('#directorPlan');if(!box)return;
 box.classList.toggle('hidden',!S.edits.length);
 box.innerHTML=S.edits.map((p,i)=>'<div class="director-edit"><span class="director-edit-number">'+(i+1)+'</span><div><b>'+esc(p.label)+'</b><small>'+esc(p.description||p.summary||'Правка добавлена в план проекта')+'</small></div><button type="button" class="director-remove" data-edit-index="'+i+'" aria-label="Удалить правку">×</button></div>').join('');
 box.querySelectorAll('[data-edit-index]').forEach(b=>b.onclick=()=>{S.editHistory.push(S.edits.map(x=>({...x})));S.edits.splice(Number(b.dataset.editIndex),1);renderDirectorPlan();});
}
function applyDirectorCommand(raw){
 const patch=commandToPatch(raw);
 if(patch.type==='undo'){
  if(!S.editHistory.length)throw Error('Пока нечего отменять.');
  S.edits=S.editHistory.pop();renderDirectorPlan();$('#directorStatus').textContent='Последняя правка отменена';return;
 }
 if(!S.plan&&!S.refs.length)throw Error('Сначала добавь референс, затем можно планировать правки.');
 S.editHistory.push(S.edits.map(x=>({...x})));
 patch.id='edit-'+Date.now()+'-'+S.edits.length;
 patch.description=patch.type==='add_3d_title'?'Текст: '+patch.text+' · экструзия · хром · облёт камеры':patch.type==='add_kinetic_title'?'Анимированный текст: '+(patch.text||'из команды')+' · пружинящее появление':patch.type==='add_subtitles'?'Субтитры в безопасной нижней зоне':patch.label;
 S.edits.push(patch);if(patch.type==='add_3d_title')start3DPreview(patch.text||'NOVEX');renderDirectorPlan();$('#directorStatus').textContent='План обновлён · '+S.edits.length+' прав.';
 if(S.plan)S.plan.edits=S.edits.map(x=>({...x}));
}
$('#applyEditCommand').onclick=()=>{try{applyDirectorCommand($('#editCommand').value);$('#directorPlan').classList.remove('hidden');toast('Команда разобрана и добавлена в план правок.','success')}catch(e){toast(e.message,'warn');$('#directorStatus').textContent=e.message}};
$('[data-command]').forEach(b=>b.onclick=()=>{const k=b.dataset.command;if(k==='undo'){try{applyDirectorCommand('отмени последнюю правку')}catch(e){toast(e.message,'warn')}return;}$('#editCommand').value=({'3d':'Добавь в начале объёмный 3D-логотип NOVEX с хромом и медленным вращением камеры.',titles:'Добавь кинетические титры с пружинящим появлением.',subtitles:'Добавь субтитры в безопасной нижней зоне и подсвечивай активное слово.'})[k];if(k==='3d')start3DPreview('NOVEX');});

function srt(t){const ms=Math.round(Math.max(0,t)*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),z=ms%1000;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(z).padStart(3,'0')}
$('#downloadBtn').onclick=async()=>{if(!S.output)return;const a=document.createElement('a');a.href=S.output;a.download=S.outputName;a.click();toast('Скачивание MP4 запрошено.','success');};
$('#playPreview').onclick=()=>{const v=$('#previewVideo');if(v.hidden){if(!S.refs[0])return toast('Сначала добавь видео.','warn');v.src=S.refs[0].url;v.hidden=false;$('#previewStage .preview-placeholder').hidden=true;$('#previewStage').classList.add('has-preview')}if(v.paused){v.play().catch(()=>{});$('#playPreview').textContent='Ⅱ'}else{v.pause();$('#playPreview').textContent='▶'}};
function fitPreviewStage(){const v=$('#previewVideo'),stage=$('#previewStage');if(!stage)return;const ratio=v.videoWidth>0&&v.videoHeight>0?v.videoWidth/v.videoHeight:Number(stage.style.getPropertyValue('--preview-ratio'))||9/16;const maxHeight=Math.min(520,Math.max(180,window.innerHeight*.64));const available=stage.parentElement?.clientWidth||520;const width=Math.max(1,Math.min(available,920,maxHeight*ratio));stage.style.width=width+'px';stage.style.setProperty('--preview-ratio',ratio);stage.style.aspectRatio=ratio+' / 1';stage.classList.toggle('preview-landscape',ratio>1.15);stage.classList.toggle('preview-square',ratio>=.85&&ratio<=1.15);stage.classList.toggle('preview-portrait',ratio<.85);}
$('#previewVideo').onloadedmetadata=fitPreviewStage;window.addEventListener('resize',fitPreviewStage);
$('#previewVideo').ontimeupdate=()=>{const v=$('#previewVideo');$('#previewClock').textContent=clock(v.currentTime)+' / '+clock(v.duration);$('#previewSeekFill').style.width=(v.currentTime/(v.duration||1)*100)+'%';const t=$('#previewTime');if(t)t.textContent=clock(v.currentTime);};
$('#previewVideo').onplay=()=>{$('#playPreview').textContent='Ⅱ';};
$('#previewVideo').onpause=()=>{$('#playPreview').textContent='▶';};
$('#previewVideo').onended=()=>{$('#playPreview').textContent='▶';};
$('.preview-track').onclick=e=>{const v=$('#previewVideo');if(!v.duration)return;const r=e.currentTarget.getBoundingClientRect();v.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*v.duration;};

function reset(){if(S.busy)return toast('Дождись завершения рендера.','warn');S.refs.forEach(x=>URL.revokeObjectURL(x.url));if(S.trackUrl)URL.revokeObjectURL(S.trackUrl);if(S.sourceUrl)URL.revokeObjectURL(S.sourceUrl);if(S.output)URL.revokeObjectURL(S.output);Object.assign(S,{refs:[],track:null,trackUrl:null,source:null,sourceUrl:null,duration:0,bpm:null,analysis:[],plan:null,output:null,edits:[],editHistory:[]});$('#editCommand').value='';$('#directorStatus').textContent='Пока нет правок';renderDirectorPlan();['referenceInput','trackInput','sourceVideoInput'].forEach(x=>$('#'+x).value='');$('#lyrics').value='';$('#sourceTranscript').value='';$('#trackName').textContent='Загрузи трек';$('#trackMeta').textContent='Для анализа ритма и длительности';$('#sourceVideoName').textContent='Добавить видео-источник';$('#sourceTranscriptWrap').classList.add('hidden');$('#previewVideo').hidden=true;$('#previewVideo').removeAttribute('src');$('#previewStage').classList.remove('has-preview');$('#previewStage .preview-placeholder').hidden=false;$('#planSummary').innerHTML='';$('#timelineTracks').innerHTML='';$('#exportResult').classList.add('hidden');$('#renderProgressWrap').classList.add('hidden');refList();signals([]);step(1);view('studio');toast('Новый проект готов.');}
$('#newProjectTop').onclick=reset;$('#newProjectProjects').onclick=reset;$('#backToMaterials').onclick=()=>step(1);$('#backToAnalysis').onclick=()=>step(1);$('#backToDirection').onclick=()=>step(2);
function openProject(p){const d=p.project_data||{};const refs=d.referenceNames||[];const matched=refs.map(n=>S.refs.find(x=>x.file.name===n));const trackOk=!!S.track&&S.track.name===d.trackName;if(!matched.length||matched.some(x=>!x)||!trackOk){toast('Чтобы открыть этот план, сначала добавь в студию исходные видео и аудиотрек с теми же именами файлов. Медиафайлы не хранятся в облаке.','warn');return;}const timeline=(d.timeline||[]).map(x=>({start:Number(x.start)||0,end:Number(x.end)||0,ref:S.refs.find(y=>y.file.name===x.referenceName)})).filter(x=>x.ref);if(!timeline.length){toast('В сохранённом проекте нет доступной монтажной шкалы.','warn');return;}S.plan={range:d.range||{start:0,duration:Math.max(...timeline.map(x=>x.end),1)},mode:d.mode||'inspired',aspect:d.aspect||'16:9',resolution:Number(d.resolution)||720,lines:d.lyrics||[],timeline};showPlan(S.plan);step(3);view('studio');$('#renderStatus').textContent='ГОТОВ К РЕНДЕРУ';$('#renderStatus').className='render-status';toast('Монтажный план открыт. Проверь его перед рендером.','success');}
function view(n){$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+n));$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===n));$('#sidebar').classList.remove('open');if(n==='library')library();if(n==='projects'){const grid=$('#projectsGrid');grid.innerHTML=S.projects.length?S.projects.map((p,i)=>'<article class="project-card"><div class="project-preview"><span>N.</span><small>'+esc(p.date)+'</small></div><div class="project-details"><b>'+esc(p.name)+'</b><small>'+esc(p.summary)+'</small><button class="btn btn-secondary btn-sm project-open" data-project-index="'+i+'">Открыть план</button></div></article>').join(''):'<div class="empty-card"><b>Проектов пока нет</b><p>Создай план монтажа, чтобы увидеть проект здесь.</p></div>';grid.querySelectorAll('[data-project-index]').forEach(b=>b.onclick=()=>openProject(S.projects[Number(b.dataset.projectIndex)]));}}
$('.nav-item').forEach(x=>x.onclick=()=>view(x.dataset.view));
$('#cloudAccountBtn').onclick=openCloudDialog;
$('#cloudClose').onclick=()=>$('#cloudDialog').classList.add('hidden');
$('#cloudDialog').onclick=e=>{if(e.target.id==='cloudDialog')$('#cloudDialog').classList.add('hidden')};
$('#cloudForm').onsubmit=async e=>{e.preventDefault();if(cloudUser){cloudStatus('Ты уже вошёл.','success');return}if(!cloudConfigured){cloudStatus('Облако не настроено. Создай Supabase project, выполни backend/supabase-schema.sql и добавь VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY в GitHub Actions Variables.', 'error');return}const b=$('#cloudLogin');busy(b,true,'Входим…');try{const result=await cloudAuth('login',$('#cloudEmail').value.trim(),$('#cloudPassword').value);cloudUser=result.user;$('#cloudAccountLabel').textContent=cloudUser?.email||'Аккаунт';cloudStatus('Вход выполнен. Загружаю проекты…','success');await refreshCloudProjects();$('#cloudLogout').hidden=false;$('#cloudSignup').hidden=true;$('#cloudEmailLink').hidden=true;$('#cloudSupportWrap').classList.remove('hidden');b.hidden=true;}catch(err){cloudStatus(err.message||'Не удалось войти.','error')}finally{busy(b,false)}};
$('#cloudEmailLink').onclick=async()=>{const email=$('#cloudEmail').value.trim();if(!$('#cloudEmail').checkValidity()){ $('#cloudEmail').reportValidity(); return; }if(!cloudConfigured){cloudStatus('Сначала настрой Supabase и SMTP Brevo по инструкции backend/BREVO-SETUP.md.','error');return;}const b=$('#cloudEmailLink');busy(b,true,'Отправляем ссылку…');try{await cloudEmailLink(email);cloudStatus('Если аккаунт существует, ссылка для входа отправлена на почту. Проверь папку «Спам».','success');}catch(err){cloudStatus(err.message||'Не удалось отправить ссылку.','error')}finally{busy(b,false)}};
$('#cloudSupportSend').onclick=async()=>{if(!cloudUser){cloudStatus('Сначала войди в аккаунт.','error');return;}const subject=$('#cloudSupportSubject').value.trim(),message=$('#cloudSupportMessage').value.trim();if(subject.length<3||subject.length>120||message.length<10||message.length>5000){cloudStatus('Укажи тему (3–120 символов) и сообщение (10–5000 символов).','error');return;}const b=$('#cloudSupportSend');busy(b,true,'Отправляем…');try{await cloudSendSupportMessage(subject,message);$('#cloudSupportSubject').value='';$('#cloudSupportMessage').value='';cloudStatus('Сообщение отправлено в поддержку NOVEX.','success');}catch(err){cloudStatus(err.message||'Не удалось отправить сообщение. Проверь настройку Brevo.','error')}finally{busy(b,false)}};
$('#cloudSignup').onclick=async()=>{if(!$('#cloudForm').reportValidity())return;if(!cloudConfigured){cloudStatus('Сначала настрой Supabase в GitHub Actions Variables.','error');return}const b=$('#cloudSignup');busy(b,true,'Создаём…');try{const result=await cloudAuth('signup',$('#cloudEmail').value.trim(),$('#cloudPassword').value);cloudUser=result.user;if(result.needsConfirmation){cloudStatus('Аккаунт создан. Проверь почту и подтверди адрес, затем войди.','success');cloudUser=null;}else{cloudStatus('Аккаунт создан и выполнен вход.','success');$('#cloudAccountLabel').textContent=cloudUser?.email||'Аккаунт';$('#cloudLogout').hidden=false;$('#cloudSignup').hidden=true;$('#cloudLogin').hidden=true;$('#cloudEmailLink').hidden=true;$('#cloudSupportWrap').classList.remove('hidden');await refreshCloudProjects();}}catch(err){cloudStatus(err.message||'Не удалось создать аккаунт.','error')}finally{busy(b,false)}};
$('#cloudLogout').onclick=async()=>{try{await cloudAuth('logout');cloudUser=null;$('#cloudAccountLabel').textContent='Облако';S.projects=[];stats();cloudStatus('Ты вышел из аккаунта.','success');$('#cloudLogout').hidden=true;$('#cloudSignup').hidden=false;$('#cloudLogin').hidden=false;$('#cloudEmailLink').hidden=false;$('#cloudSupportWrap').classList.add('hidden');}catch(err){cloudStatus(err.message,'error')}};
if(cloudConfigured){cloudSession().then(({user})=>{cloudUser=user;if(user){$('#cloudAccountLabel').textContent=user.email||'Аккаунт';refreshCloudProjects();}}).catch(()=>{});}
$('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('open');
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))addEventListener('load',()=>navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js').catch(()=>{}));
refList();signals([]);stats();

/* NOVEX Buddy: local, privacy-first product help (no files leave the device). */
const helperKnowledge=[
 {keys:['начать','старт','проект','как начать'],answer:'Начни с «Материалы»: добавь 1–3 видео в «Референсы анимации», загрузи музыкальный файл и при желании вставь текст. Нажми «Анализировать материалы», выбери режим/формат, затем «Собрать план» и «Собрать MP4». Для первого теста используй короткий трек и один небольшой MP4.'},
 {keys:['референс','посмотреть','просмотр','видео'],answer:'После загрузки у каждого референса есть мини-превью и кнопка «Смотреть видео». Нажми её — ролик откроется в LIVE CANVAS; можно поставить на паузу и перемотать встроенными контролами. Для анализа файл должен быть видео: MP4, MOV или WEBM.'},
 {keys:['трек','музык','аудио','слушать','прослушать','звук'],answer:'После выбора аудиофайла под карточкой «Музыкальный трек» появится встроенный аудиоплеер. В нём можно слушать, ставить на паузу и перематывать трек. Для анализа и экспорта нужен аудиофайл MP3/WAV/M4A/AAC; видео вместо трека не подходит.'},
 {keys:['ffmpeg','wasm','рендер','ошибка','0%','экспорт'],answer:'Если FFmpeg не стартует: 1) обнови страницу; 2) проверь, что сеть не блокирует /NOVEX/ffmpeg/ffmpeg-core.js и ffmpeg-core.wasm; 3) попробуй короткий фрагмент и 480p/720p; 4) на телефоне закрой другие тяжёлые вкладки. Если ошибка повторяется, пришли точный текст ошибки и устройство. Сам факт успешной сборки ещё не доказывает, что рендер проверен на каждом устройстве.'},
 {keys:['текст','лирик','субтитр','слова'],answer:'Вставь текст в поле «Текст трека». NOVEX делит его на короткие строки равномерно по выбранному фрагменту. Это тестовые таймкоды, не распознавание речи — обязательно проверь совпадение на слух. Для проверки можно вставить любой короткий текст.'},
 {keys:['bpm','темп','анализ'],answer:'«Анализировать материалы» выбирает несколько кадров каждого референса и оценивает смены сцен/яркость, а для музыки оценивает BPM и энергию. Это быстрые эвристики, а не профессиональная покадровая реконструкция; результаты могут отличаться от ручной оценки.'},
 {keys:['приват','облако','файл','безопас','загрузка'],answer:'Видео и аудио обрабатываются локально в браузере через FFmpeg WASM. Встроенный Buddy отвечает по справке приложения и не читает содержимое твоих файлов. Облачные проекты хранят данные монтажного плана, а не сами медиафайлы.'},
 {keys:['план','монтаж','формат','вертикал','разреш'],answer:'На шаге «Режиссура» выбери степень следования референсу, весь трек или фрагмент, формат 9:16 / 1:1 / 16:9 и разрешение. Затем «Собрать план» показывает шкалу VIDEO/AUDIO/TEXT. После проверки нажми «Собрать MP4».'}
];
function helperReply(question){
 const q=question.toLocaleLowerCase('ru-RU');
 const found=helperKnowledge.find(item=>item.keys.some(k=>q.includes(k)));
 if(found)return found.answer;
 if(/привет|йо|здравств|хай/.test(q))return 'Йо! ✦ Спроси про загрузку материалов, прослушивание трека, просмотр референсов, анализ или экспорт. Можешь также нажать быстрые вопросы сверху.';
 if(/что умеешь|помощ|команд/.test(q))return 'Я знаю основные шаги NOVEX, требования к форматам, локальный анализ, текстовые титры и типовые проблемы FFmpeg. Я пока не подключён к облачной языковой модели и не могу менять проект за тебя, но подскажу следующий шаг.';
 return 'Пока не нашёл точного ответа в локальной справке. Попробуй уточнить: «как начать проект», «как прослушать трек», «как посмотреть референс» или «ошибка FFmpeg». Если это баг — пришли точный текст ошибки, этап и модель устройства.';
}
function helperMessage(text,kind){
 const box=$('#helperMessages'),node=document.createElement('div');node.className='helper-bubble '+kind;
 const p=document.createElement('p');p.textContent=text;node.append(p);box.append(node);box.scrollTop=box.scrollHeight;
}
$('#helperFab').onclick=()=>{$('#helperPanel').classList.toggle('hidden');if(!$('#helperPanel').classList.contains('hidden'))$('#helperInput').focus()};
$('#helperClose').onclick=()=>$('#helperPanel').classList.add('hidden');
$('#helperForm').onsubmit=e=>{e.preventDefault();const input=$('#helperInput'),q=input.value.trim();if(!q)return;helperMessage(q,'user');helperMessage(helperReply(q),'bot');input.value='';};
$('#helperMessages').addEventListener('click',e=>{const b=e.target.closest('[data-helper-q]');if(!b)return;const q=b.dataset.helperQ;helperMessage(q,'user');helperMessage(helperReply(q),'bot');});
