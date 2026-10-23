import { FFmpeg } from '@ffmpeg/ffmpeg';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import './style.css';
import { createMotionDirector } from './motion-director.js';
import { createLogoScene } from './motion3d.js';
import { cloud, cloudConfigured, cloudSession, cloudAuth, cloudListProjects, cloudSaveProject, cloudEmailLink, cloudPasswordReset, cloudUpdatePassword, cloudSendSupportMessage, cloudVerifyEmailCode } from './cloud.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S={refs:[],track:null,trackUrl:null,source:null,sourceUrl:null,sourceMeta:null,duration:0,bpm:null,envelope:[],analysis:[],plan:null,output:null,outputName:'NOVEX.mp4',projects:[],busy:false,edits:[],editHistory:[]};
const ff=new FFmpeg();let loaded=false,timer;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=n=>{n=Math.max(0,Math.floor(n||0));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.round(n/1024)+' KB';
function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error||new Error('Не удалось прочитать MP4 для сохранения.'));
    reader.onload=()=>{const result=String(reader.result||'');const comma=result.indexOf(',');if(comma<0)reject(new Error('Не удалось подготовить MP4 к сохранению.'));else resolve(result.slice(comma+1));};
    reader.readAsDataURL(blob);
  });
}
const radio=n=>document.querySelector('input[name="'+n+'"]:checked')?.value;
let cloudUser = null;
const LOCAL_PROJECTS_KEY='novex.localProjects.v1';
const MEDIA_DB_NAME='novex.projectMedia.v1';
const MEDIA_STORE='assets';
function openMediaDb(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('IndexedDB недоступен в этом браузере.'));return;}
  const request=indexedDB.open(MEDIA_DB_NAME,1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(MEDIA_STORE)){const store=db.createObjectStore(MEDIA_STORE,{keyPath:'key'});store.createIndex('projectId','projectId',{unique:false});}};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Не удалось открыть хранилище медиа.'));
 });
}
async function saveProjectMedia(project){
 const db=await openMediaDb();
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(MEDIA_STORE,'readwrite'),store=tx.objectStore(MEDIA_STORE),id=String(project.id);
   store.delete(id+':track');store.delete(id+':source');
   for(let i=0;i<15;i++)store.delete(id+':reference:'+i);
   S.refs.forEach((ref,index)=>store.put({key:id+':reference:'+index,projectId:id,role:'reference',index,name:ref.file.name,type:ref.file.type||'video/mp4',lastModified:ref.file.lastModified||0,blob:ref.file}));
   if(S.track)store.put({key:id+':track',projectId:id,role:'track',index:0,name:S.track.name,type:S.track.type||'audio/mpeg',lastModified:S.track.lastModified||0,blob:S.track});
   if(S.source)store.put({key:id+':source',projectId:id,role:'source',index:0,name:S.source.name,type:S.source.type||'video/mp4',lastModified:S.source.lastModified||0,blob:S.source});
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Не удалось сохранить медиа проекта.'));tx.onabort=()=>reject(tx.error||new Error('Сохранение медиа отменено.'));
  });
 }finally{db.close();}
}
async function readProjectMedia(projectId){
 const db=await openMediaDb();
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readonly'),request=tx.objectStore(MEDIA_STORE).index('projectId').getAll(String(projectId));request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error||new Error('Не удалось прочитать сохранённые медиа.'));});}
 finally{db.close();}
}
function fileFromStored(item){return new File([item.blob],item.name,{type:item.type||item.blob.type||'application/octet-stream',lastModified:item.lastModified||Date.now()});}
async function restoreProjectMedia(project,referenceNames){
 let rows;try{rows=await readProjectMedia(project.id);}catch(e){toast('Не удалось прочитать медиа проекта: '+e.message,'warn');return false;}
 const d=project.project_data||{},oldRefs=S.refs,storedRefs=rows.filter(x=>x.role==='reference').sort((a,b)=>a.index-b.index);
 const restoredRefs=[];
 for(let i=0;i<referenceNames.length;i++){
  const name=referenceNames[i],existing=oldRefs.find(x=>x.file.name===name),stored=storedRefs.find(x=>x.index===i&&x.name===name);
  if(stored){try{restoredRefs.push(await probe(fileFromStored(stored)));continue;}catch(e){toast('Не удалось восстановить видео '+name+': '+e.message,'warn');return false;}}
  if(existing){restoredRefs.push(existing);continue;}
  toast('Медиа «'+name+'» больше не найдено. Выбери этот файл заново.','warn');return false;
 }
 let restoredTrack=S.track?.name===d.trackName?S.track:null;
 const storedTrack=rows.find(x=>x.role==='track'&&x.name===d.trackName);
 if(storedTrack){restoredTrack=fileFromStored(storedTrack);}
 if(!restoredTrack){toast('Аудиотрек «'+(d.trackName||'')+'» не найден. Выбери его заново.','warn');return false;}
 let trackUrl=S.track?.name===d.trackName?S.trackUrl:null,duration=S.duration;
 if(storedTrack||!trackUrl){
  trackUrl=URL.createObjectURL(restoredTrack);
  const audio=document.createElement('audio');audio.preload='metadata';audio.src=trackUrl;
  try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>finish(new Error('Истекло время чтения сохранённого аудио.')),15000);const finish=err=>{clearTimeout(timeout);audio.onloadedmetadata=null;audio.onerror=null;err?reject(err):resolve();};audio.onloadedmetadata=()=>finish();audio.onerror=()=>finish(new Error('Не удалось открыть сохранённый аудиотрек.'));audio.load();});duration=Number.isFinite(audio.duration)?audio.duration:0;}
  catch(e){URL.revokeObjectURL(trackUrl);toast(e.message,'warn');return false;}
  finally{audio.removeAttribute('src');audio.load();}
 }
 let restoredSource=S.source?.name===d.sourceName?S.source:null,sourceUrl=S.sourceUrl,sourceMeta=S.sourceMeta;
 if(d.sourceName){
  const storedSource=rows.find(x=>x.role==='source'&&x.name===d.sourceName);
  if(storedSource){try{const probed=await probe(fileFromStored(storedSource));restoredSource=probed.file;sourceUrl=probed.url;sourceMeta={duration:probed.duration,w:probed.w,h:probed.h};}catch(e){toast('Не удалось восстановить видео-источник: '+e.message,'warn');return false;}}
  if(!restoredSource){toast('Видео-источник «'+d.sourceName+'» не найден. Выбери его заново.','warn');return false;}
 }
 oldRefs.forEach(x=>{if(!restoredRefs.includes(x))URL.revokeObjectURL(x.url);});
 S.refs=restoredRefs;S.track=restoredTrack;S.trackUrl=trackUrl;S.duration=duration;S.source=restoredSource;S.sourceUrl=sourceUrl;S.sourceMeta=sourceMeta;
 refList();
 const au=$('#trackAudio');au.src=trackUrl;au.volume=1;au.hidden=false;au.load();$('#audioExportControls').hidden=false;syncSourceAudioControls();
 $('#trackName').textContent=restoredTrack.name;$('#trackMeta').textContent=clock(duration)+' · '+size(restoredTrack.size);$('#fullDurationLabel').textContent='Вся длительность · '+clock(duration);
 if(restoredSource){$('#sourceVideoName').textContent=restoredSource.name;$('#sourceTranscriptWrap').classList.remove('hidden');const preview=$('#sourceAudioPreview');preview.src=sourceUrl;preview.hidden=false;preview.load();syncSourceAudioControls();}
 return true;
}
function loadLocalProjects(){
  try {
    const rows=JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY)||'[]');
    if(!Array.isArray(rows))return [];
    return rows.filter(p=>p&&typeof p==='object'&&typeof p.name==='string'&&p.project_data&&typeof p.project_data==='object').slice(0,15).map(p=>({...p,cloud:false}));
  } catch { return []; }
}
function persistLocalProjects(){
  try { localStorage.setItem(LOCAL_PROJECTS_KEY,JSON.stringify(S.projects.filter(p=>!p.cloud).slice(0,15))); }
  catch { toast('Не удалось сохранить список проектов на этом устройстве. Освободи место в хранилище браузера.','warn'); }
}
S.projects=loadLocalProjects();
async function refreshCloudProjects(){
  if(!cloudUser || !cloudConfigured) return;
  try {
    const rows = await cloudListProjects();
    const local=loadLocalProjects();
    const remote=rows.map(p => ({id:p.id,name:p.name,date:new Date(p.updated_at||p.created_at).toLocaleString('ru-RU'),summary:p.summary,cloud:true,project_data:p.project_data}));
    const remoteKeys=new Set(remote.map(p=>p.name+'|'+p.summary));
    S.projects=[...remote,...local.filter(p=>!remoteKeys.has(p.name+'|'+p.summary))].slice(0,30);
    stats();
    if($('#view-projects').classList.contains('active')) view('projects');
  } catch (e) { toast('Не удалось загрузить облачные проекты: '+e.message,'error'); }
}
function cloudStatus(message,type=''){const el=$('#cloudStatus');if(el){el.textContent=message;el.className='cloud-status '+type;}}
function cloudErrorMessage(err,action='auth'){const raw=String(err?.message||err||'').trim(),m=raw.toLowerCase();if(m.includes('email signups are disabled')||m.includes('signups not allowed for this instance'))return 'Регистрация по электронной почте отключена в настройках Supabase Auth. Нужно включить Email provider и разрешить регистрации.';if(m.includes('user already registered'))return 'Аккаунт с этой почтой уже существует. Попробуй войти или восстановить пароль.';if(m.includes('invalid login credentials'))return 'Неверная почта или пароль. Проверь данные или воспользуйся восстановлением пароля.';if(m.includes('email address not authorized')||m.includes('pre-authorized addresses'))return 'Supabase сейчас не может отправить письмо на этот адрес через почтовый сервер по умолчанию. Настрой пользовательский SMTP в Supabase по backend/BREVO-SETUP.md.';if(m.includes('email rate limit exceeded')||m.includes('over_email_send_rate_limit'))return 'Supabase временно ограничил отправку писем. Подожди и попробуй снова.';if(m.includes('error sending confirmation email')||m.includes('smtp')||m.includes('email provider'))return 'Supabase не смог отправить письмо. Проверь SMTP и подтверждённый адрес отправителя в настройках проекта.';if(m.includes('redirect_to')||m.includes('redirect url')||m.includes('not allowed'))return 'Supabase отклонил адрес возврата. Добавь URL сайта NOVEX и адрес приложения в Auth → URL Configuration → Redirect URLs.';if(m.includes('failed to fetch')||m.includes('networkerror')||m.includes('network request failed'))return 'Нет соединения с Supabase. Проверь интернет и URL проекта.';if(m.includes('password should be at least')||m.includes('password is too short'))return 'Пароль не соответствует минимальной длине, заданной в Supabase.';return raw||({signup:'Не удалось создать аккаунт.',login:'Не удалось войти.',email:'Не удалось отправить письмо.',password:'Не удалось обновить пароль.'}[action]||'Операция не выполнена.');}
function recoveryMode(){return new URLSearchParams(location.search).get('type')==='recovery'||location.hash.includes('type=recovery')} function openCloudDialog(){const recovery=recoveryMode();$('#cloudDialog').classList.remove('hidden');$('#cloudPassword').value='';cloudStatus(recovery?'Проверь новый пароль и сохрани его.':cloudConfigured?'Введи данные своего аккаунта NOVEX.':'Облако пока не настроено: добавь переменные Supabase в GitHub Actions.',cloudConfigured||recovery?'':'error');$('#cloudCredentials').classList.toggle('hidden',recovery);$('#cloudRecoveryWrap').classList.toggle('hidden',!recovery);$('#cloudLogout').hidden=!cloudUser;$('#cloudSignup').hidden=!!cloudUser;$('#cloudForm').querySelector('#cloudLogin').hidden=!!cloudUser;$('#cloudEmailLink').hidden=!!cloudUser;$('#cloudResetPassword').hidden=!!cloudUser;$('#cloudSupportWrap').classList.toggle('hidden',!cloudUser||recovery);$('#cloudEmail').value=cloudUser?.email||'';}
function toast(m,type=''){const e=$('#toast');e.textContent=m;e.className='toast show '+type;clearTimeout(timer);timer=setTimeout(()=>e.className='toast',4000);}
function busy(b,v,label){b.disabled=v;if(v){b.dataset.old=b.innerHTML;b.innerHTML='<span class="spinner"></span> '+esc(label);}else{b.innerHTML=b.dataset.old||b.innerHTML;delete b.dataset.old;}}
function step(n){['materialsPanel','directionPanel','renderPanel'].forEach((id,i)=>$('#'+id).classList.toggle('hidden',i!==n-1));$$('[data-step-indicator]').forEach(e=>{e.classList.toggle('active',+e.dataset.stepIndicator===n);e.classList.toggle('done',+e.dataset.stepIndicator<n)});$$('.progress-step').forEach(e=>{e.classList.toggle('active',+e.dataset.step===n);e.classList.toggle('done',+e.dataset.step<n)});$('#progressTrack').style.width=((n-1)*50)+'%';}
function stats(){$('#statRefs').textContent=S.refs.length;$('#statDuration').textContent=S.track?clock(S.duration):'—';$('#statBpm').textContent=S.bpm?Math.round(S.bpm)+' BPM':'—';$('#projectCount').textContent=S.projects.length;}
function library(){let a=[...S.refs.map(x=>({t:'Референс',n:x.file.name,m:clock(x.duration)+' · '+size(x.file.size)})),...(S.track?[{t:'Аудио',n:S.track.name,m:clock(S.duration)+' · '+size(S.track.size)}]:[]),...(S.source?[{t:'Источник',n:S.source.name,m:size(S.source.size)}]:[])];$('#libraryGrid').innerHTML=a.length?a.map(x=>'<div class="library-item"><span class="library-type">'+esc(x.t)+'</span><b>'+esc(x.n)+'</b><small>'+esc(x.m)+'</small></div>').join(''):'<div class="empty-card"><b>Медиатека пуста</b><p>Добавь файлы в студии.</p></div>';}
function signals(a){$('#analysisSignals').innerHTML=a.length?a.map(x=>'<div class="signal-row"><span class="signal-dot '+(x.ok?'good':'')+'"></span><div><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small></div><span class="signal-value">'+esc(x.value)+'</span></div>').join(''):'<div class="signal-empty">После анализа появятся параметры материалов.</div>';}
function playReferenceAt(index,autoplay=true,fade=true){const list=S.refs;if(!list.length)return;const v=$('#previewVideo');index=((index%list.length)+list.length)%list.length;const item=list[index],switchToken=String((Number(v.dataset.previewSwitch)||0)+1);v.dataset.previewSwitch=switchToken;v.dataset.referencePlaylist='true';v.dataset.referenceIndex=String(index);v.dataset.referencePreview=item.url;v.muted=true;v.hidden=false;$('#previewStage .preview-placeholder').hidden=true;$('#previewStage').classList.add('has-preview');const switchSource=()=>{if(v.dataset.previewSwitch!==switchToken||v.dataset.referencePlaylist!=='true')return;v.pause();const fail=()=>{if(v.dataset.previewSwitch!==switchToken||v.dataset.referencePreview!==item.url)return;v.removeEventListener('loadeddata',reveal);v.removeEventListener('error',fail);v.pause();v.classList.remove('preview-fade-out');v.hidden=true;v.removeAttribute('src');v.load();delete v.dataset.referencePlaylist;delete v.dataset.referencePreview;$('#previewStage').classList.remove('has-preview');$('#previewStage .preview-placeholder').hidden=false;$('#playPreview').textContent='▶';$('#previewClock').textContent='00:00 / 00:00';$('#previewSeekFill').style.width='0%';toast('Не удалось открыть видео '+item.file.name+'. Попробуй другой файл.','error');};const reveal=()=>{v.removeEventListener('error',fail);if(v.dataset.previewSwitch!==switchToken||v.dataset.referencePreview!==item.url)return;fitPreviewStage();requestAnimationFrame(()=>{if(v.dataset.previewSwitch===switchToken)v.classList.remove('preview-fade-out');});if(autoplay)v.play().catch(()=>{});};v.addEventListener('error',fail,{once:true});v.addEventListener('loadeddata',reveal,{once:true});v.src=item.url;v.load();};if(fade){v.classList.add('preview-fade-out');setTimeout(switchSource,220);}else{v.classList.remove('preview-fade-out');switchSource();}$('#playPreview').textContent=autoplay?'Ⅱ':'▶';}
function refList(){const box=$('#referenceList');box.innerHTML='';S.refs.forEach((x,index)=>{const d=document.createElement('div');d.className='media-item media-item-rich';d.innerHTML='<button class="ref-preview" type="button" aria-label="Посмотреть '+esc(x.file.name)+'"><video src="'+x.url+'" muted playsinline preload="metadata"></video><span>▶</span></button><div class="media-copy"><b title="'+esc(x.file.name)+'">'+esc(x.file.name)+'</b><small>'+clock(x.duration)+' · '+x.w+'×'+x.h+' · '+size(x.file.size)+'</small><div class="mini-tags"><span>'+(x.a?'✓ Проанализирован':'Референс '+(index+1))+'</span></div><button class="text-button ref-open" type="button">Смотреть видео ↗</button></div><button class="remove-btn" aria-label="Удалить">×</button>';d.querySelector('.ref-preview').onclick=d.querySelector('.ref-open').onclick=()=>playReferenceAt(S.refs.findIndex(y=>y.id===x.id),true,false);d.querySelector('.remove-btn').onclick=()=>{const v=$('#previewVideo'),activePlaylist=v.dataset.referencePlaylist==='true',removedActive=activePlaylist&&v.dataset.referencePreview===x.url;URL.revokeObjectURL(x.url);S.refs=S.refs.filter(y=>y!==x);if(activePlaylist){if(!S.refs.length){v.pause();v.removeAttribute('src');v.load();delete v.dataset.referencePlaylist;delete v.dataset.referenceIndex;delete v.dataset.referencePreview;v.hidden=true;$('#previewStage').classList.remove('has-preview');$('#previewStage .preview-placeholder').hidden=false;$('#playPreview').textContent='▶';$('#previewClock').textContent='00:00 / 00:00';$('#previewSeekFill').style.width='0%';}else if(removedActive){delete v.dataset.referencePreview;playReferenceAt(0,true,false);}else{v.dataset.referenceIndex=String(S.refs.findIndex(y=>y.url===v.dataset.referencePreview));}}refList();stats();};box.append(d);});$('#referenceDrop').classList.toggle('has-files',S.refs.length>0);
  if(S.refs.length&&!S.output){
    const preview=$('#previewVideo');
    if(!preview.dataset.referencePreview||!S.refs.some(x=>x.url===preview.dataset.referencePreview)){
      playReferenceAt(0,true,false);
    }
  }
  stats();library();
}
async function probe(file){const u=URL.createObjectURL(file),v=document.createElement('video');v.preload='metadata';v.muted=true;v.src=u;try{await new Promise((resolve,reject)=>{const finish=err=>{clearTimeout(timer);v.onloadedmetadata=null;v.onerror=null;err?reject(err):resolve()};const timer=setTimeout(()=>finish(new Error('Истекло время чтения '+file.name)),15000);v.onloadedmetadata=()=>finish();v.onerror=()=>finish(new Error('Невозможно прочитать '+file.name));});return {id:crypto.randomUUID?.()||String(Math.random()),file,url:u,duration:Number.isFinite(v.duration)?v.duration:0,w:v.videoWidth,h:v.videoHeight,color:['#553b86','#246779','#77552d','#6b3554'][S.refs.length%4]};}catch(e){v.removeAttribute('src');v.load();URL.revokeObjectURL(u);throw e;}}
async function addRefs(files){for(const f of [...files])if(f.type.startsWith('video/')||/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)){try{S.refs.push(await probe(f));}catch(e){toast(e.message,'error');}}refList();if(files.length)toast('Референсы добавлены.');}
$('#referenceInput').onchange=e=>addRefs(e.target.files);
const drop=$('#referenceDrop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag-over')};drop.ondragleave=()=>drop.classList.remove('drag-over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag-over');addRefs(e.dataTransfer.files)};
$('#trackInput').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 const nextUrl=URL.createObjectURL(f),candidate=document.createElement('audio');candidate.preload='metadata';candidate.src=nextUrl;
 try{
  await new Promise((resolve,reject)=>{const finish=err=>{clearTimeout(timer);candidate.onloadedmetadata=null;candidate.onerror=null;err?reject(err):resolve()};const timer=setTimeout(()=>finish(new Error('Истекло время чтения аудиофайла. Попробуй MP3 или WAV.')),15000);candidate.onloadedmetadata=()=>finish();candidate.onerror=()=>finish(new Error('Не удалось прочитать аудиофайл. Попробуй MP3 или WAV.'));candidate.load();});
 }catch(err){
  candidate.removeAttribute('src');candidate.load();URL.revokeObjectURL(nextUrl);e.target.value='';
  toast(err.message,'error');return;
 }
 const au=$('#trackAudio'),duration=Number.isFinite(candidate.duration)?candidate.duration:0;
 candidate.removeAttribute('src');candidate.load();
 au.pause();if(S.trackUrl)URL.revokeObjectURL(S.trackUrl);
 S.track=f;S.trackUrl=nextUrl;S.duration=duration;
 au.src=nextUrl;au.volume=1;au.hidden=false;au.load();$('#audioExportControls').hidden=false;syncSourceAudioControls();
 $('#trackName').textContent=f.name;$('#trackMeta').textContent=clock(S.duration)+' · '+size(f.size);
 $('#fullDurationLabel').textContent='Вся длительность · '+clock(S.duration);
 e.target.value='';stats();library();toast('Трек загружен.');
};
$('#sourceVideoInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const p=await probe(f),audioPreview=$('#sourceAudioPreview');audioPreview.pause();audioPreview.removeAttribute('src');audioPreview.load();if(S.sourceUrl)URL.revokeObjectURL(S.sourceUrl);S.source=f;S.sourceUrl=p.url;S.sourceMeta={duration:p.duration,w:p.w,h:p.h};$('#sourceVideoName').textContent=f.name;$('#sourceVideoMeta').textContent=clock(p.duration)+' · '+p.w+'×'+p.h;$('#sourceTranscriptWrap').classList.remove('hidden');syncSourceAudioControls();audioPreview.src=p.url;audioPreview.volume=1;audioPreview.hidden=false;audioPreview.load();$('#sourceAudioStatus').textContent='Можно выбрать звук этого видео как единственную аудиодорожку MP4.';library();}catch(err){toast(err.message,'error')}};
$('#sourceAudioPreview').onloadedmetadata=()=>{$('#sourceAudioStatus').textContent='Оригинальный звук · '+clock($('#sourceAudioPreview').duration)+' · можно прослушать отдельно.';};
$('#sourceAudioPreview').onerror=()=>{$('#sourceAudioStatus').textContent='Браузер не смог воспроизвести дорожку. При выборе этого источника экспорт проверит наличие звука.';};
function syncSourceAudioControls(){const available=!!S.source;const sourceMode=$('input[name="audioMode"][value="source"]');if(sourceMode)sourceMode.disabled=!available;if(!available&&radio('audioMode')==='source')$('input[name="audioMode"][value="music"]').checked=true;$('#sourceAudioPreview').volume=1;$('#trackAudio').volume=1;}
$('#useSourceVideo').onchange=syncSourceAudioControls;
function bpmEstimate(buf){const x=buf.getChannelData(0),sr=buf.sampleRate,ws=Math.floor(sr*.01),env=[];for(let i=0;i+ws<x.length;i+=ws){let a=0;for(let j=i;j<i+ws;j+=4)a+=x[j]*x[j];env.push(Math.sqrt(a/(ws/4)));}const d=env.map((v,i)=>i?Math.max(0,v-env[i-1]):0),avg=d.reduce((a,b)=>a+b,0)/d.length;let best={s:-1,b:0};for(let b=65;b<=180;b+=.5){const lag=Math.round(6000/b);let s=0;for(let i=lag;i<d.length;i++)s+=(d[i]-avg)*(d[i-lag]-avg);if(s>best.s)best={s,b};}return best.b||null;}
function audioEnvelope(buf){const x=buf.getChannelData(0),sr=buf.sampleRate,ws=Math.max(1,Math.floor(sr*.05)),env=[];for(let i=0;i<x.length;i+=ws){let sum=0,n=0;for(let j=i;j<Math.min(x.length,i+ws);j+=4){sum+=x[j]*x[j];n++}env.push(Math.sqrt(sum/Math.max(1,n)));}return env;}
function bestMusicWindow(duration){const env=S.envelope;if(!env.length||!S.duration)return 0;const frame=.05,win=Math.max(1,Math.min(env.length,Math.round(duration/frame))),hop=Math.max(1,Math.round(1/frame));let max=0,scoreBest=-Infinity;const vals=env.filter(Number.isFinite).sort((a,b)=>a-b),q=vals[Math.floor(vals.length*.85)]||1;for(let i=0;i+win<=env.length;i+=hop){let sum=0,peak=0,changes=0,prev=env[i]||0;for(let j=i;j<i+win;j++){const v=env[j]||0;sum+=Math.min(v/q,2);peak+=v*v;if(j>i){changes+=Math.abs(v-prev);prev=v;}}const mean=sum/win,variance=Math.sqrt(peak/win),motion=changes/win;const score=mean*.55+(variance/q)*.25+(motion/q)*.20;if(score>scoreBest){scoreBest=score;max=i*frame;}}return Math.max(0,Math.min(max,S.duration-duration));}
async function analyzeFrames(x){const v=document.createElement('video');v.muted=true;v.preload='metadata';v.src=x.url;await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=()=>j(Error('не удалось декодировать видео'))});const c=document.createElement('canvas');c.width=48;c.height=27;const g=c.getContext('2d',{willReadFrequently:true});let prev=null,cuts=0,light=0;const scenePoints=[];const count=Math.min(12,Math.max(4,Math.ceil(x.duration/5)));for(let k=0;k<count;k++){const time=x.duration*(k+.5)/count;v.currentTime=time;await new Promise(r=>{let done=false;const finish=()=>{if(!done){done=true;r()}};v.onseeked=finish;setTimeout(finish,1600)});try{g.drawImage(v,0,0,48,27);const p=g.getImageData(0,0,48,27).data,ar=[];let l=0;for(let i=0;i<p.length;i+=4){const z=Math.round((.2126*p[i]+.7152*p[i+1]+.0722*p[i+2])/16);ar.push(z);l+=z*16}light+=l/(48*27);if(prev){let diff=0;for(let i=0;i<ar.length;i++)diff+=Math.abs(ar[i]-prev[i]);if(diff/ar.length>3.5){cuts++;scenePoints.push(Math.max(0,Math.min(Math.max(0,x.duration-0.2),time)))}}prev=ar}catch{}}return {frames:count,cuts,scenePoints:[...new Set(scenePoints)],brightness:Math.round(light/count),orientation:x.w>x.h?'Горизонтальный':x.w===x.h?'Квадратный':'Вертикальный'};}
$('#analyzeBtn').onclick=async()=>{if((!S.refs.length&&!(S.source&&$('#useSourceVideo').checked))||!S.track){toast('Добавь музыкальный трек и референс или включи видео-источник.','warn');return;}const b=$('#analyzeBtn');busy(b,true,'Анализируем…');const a=[];try{if(S.source&&$('#useSourceVideo').checked){try{const x={file:S.source,url:S.sourceUrl,duration:Number(S.sourceMeta?.duration)||S.duration,w:Number(S.sourceMeta?.w)||0,h:Number(S.sourceMeta?.h)||0};x.a=await analyzeFrames(x);a.push({title:'Видео-источник · '+x.file.name,detail:x.a.frames+' выборочных кадров · '+x.a.orientation+' · яркость '+x.a.brightness+'/255',value:x.a.cuts+' смен',ok:true});}catch(err){a.push({title:'Видео-источник · '+S.source.name,detail:err.message,value:'Ошибка',ok:false})}}else if(S.refs.length)await Promise.all(S.refs.map(async x=>{try{x.a=await analyzeFrames(x);a.push({title:x.file.name,detail:x.a.frames+' выборочных кадров · '+x.a.orientation+' · яркость '+x.a.brightness+'/255',value:x.a.cuts+' смен',ok:true});}catch(err){a.push({title:x.file.name,detail:err.message,value:'Ошибка',ok:false})}}));const ctx=new (window.AudioContext||window.webkitAudioContext)();try{const audio=await ctx.decodeAudioData((await S.track.arrayBuffer()).slice(0));S.duration=audio.duration;S.bpm=bpmEstimate(audio);S.envelope=audioEnvelope(audio);a.push({title:'Музыкальный анализ',detail:'Web Audio · '+audio.sampleRate+' Hz · '+clock(audio.duration)+' · оценка энергии и атак',value:Math.round(S.bpm||0)+' BPM',ok:true});}finally{await ctx.close()}a.push({title:'Текст',detail:$('#lyrics').value.trim()?$('#lyrics').value.trim().split(/\s+/).length+' слов · требуется сверить таймкоды':'Не добавлен — титры можно отключить',value:$('#lyrics').value.trim()?'Есть':'Нет',ok:true});S.analysis=a;signals(a);refList();step(2);toast('Анализ завершён. Это выборочная эвристика, не точная реконструкция движения.');}catch(err){toast('Анализ не завершён: '+err.message,'error')}finally{busy(b,false)}};
$$('input[name="durationMode"]').forEach(x=>x.onchange=()=>{$('#clipControls').classList.toggle('hidden',radio('durationMode')!=='clip');$$('.choice-card').forEach(c=>{const i=c.querySelector('input');if(i?.name==='durationMode')c.classList.toggle('selected',i.checked)});});
$$('input[name="styleMode"]').forEach(x=>x.onchange=()=>$$('.choice-card').forEach(c=>{const i=c.querySelector('input');if(i?.name==='styleMode')c.classList.toggle('selected',i.checked)}));
function lyricLines(){const texts=[];const lyrics=$('#lyrics').value.trim();if(lyrics&&$('#burnLyrics').checked)texts.push(lyrics);const transcript=$('#sourceTranscript').value.trim();if(transcript&&$('#useSourceTranscript').checked)texts.push(transcript);const words=texts.join(' ').replace(/\r/g,'').split(/\s+/).filter(Boolean),lines=[];for(let i=0;i<words.length;i+=5)lines.push(words.slice(i,i+5).join(' '));const range=renderRange();return lines.map((t,i)=>({text:t,start:range.start+range.duration*i/Math.max(1,lines.length),end:range.start+range.duration*(i+1)/Math.max(1,lines.length)}));}
function renderRange(){if(radio('durationMode')==='clip'){let s=Math.max(0,Number($('#clipStart').value)||0);s=Math.min(s,Math.max(0,S.duration-1));return {start:s,duration:Math.max(1,Math.min(Number($('#clipDuration').value)||25,S.duration-s))};}return {start:0,duration:S.duration};}
$('#syncLyrics').onclick=()=>{if(!S.track||!$('#lyrics').value.trim()){toast('Сначала добавь трек и текст.','warn');return}const count=Math.ceil($('#lyrics').value.trim().split(/\s+/).length/5);toast('Текст разделён ориентировочно на '+count+' строки; это не ASR и таймкоды не являются точными.');};
$('#suggestClip').onclick=()=>{if(!S.duration){toast('Сначала загрузи и проанализируй трек.','warn');return}const d=Math.min(30,Math.max(20,Math.round(S.duration*.18)));const start=bestMusicWindow(d);$('#clipStart').value=start.toFixed(1);$('#clipDuration').value=d;toast('Выбран музыкально выразительный фрагмент по энергии и атакам. Смысл припева и слова автоматически не распознаны — проверь прослушиванием.');};
function makePlan(){if(!S.track)throw Error('Сначала добавь музыкальный трек.');if((radio('audioMode')||'music')==='source'&&!S.source)throw Error('Выбран звук видео-источника, но видео не добавлено.');if($('#useSourceTranscript').checked&&!$('#sourceTranscript').value.trim())throw Error('Включена опция текста источника, но поле пустое. Вставь текст или отключи эту опцию.');if(!S.refs.length&&!(S.source&&$('#useSourceVideo').checked))throw Error('Добавь референс или включи видео-источник переключателем «Использовать видео-источник вместо референсов».');const range=renderRange();if(range.duration<.2||range.start>=S.duration)throw Error('Проверь диапазон трека.');const mode=radio('styleMode')||'inspired',beat=!!$('#beatCut').checked,lines=lyricLines(),period=S.bpm?60/S.bpm:1.8,paceBoost=(S.edits||[]).some(e=>e.type==='motion_timing')?.72:1,shot=Math.max(.8,Math.min(5,(beat?period*(mode==='faithful'?4:mode==='original'?1:2):3.4)*paceBoost));const useSourceVideo=!!(S.source&&$('#useSourceVideo').checked);let refOrder=useSourceVideo?[]:[...S.refs];if(mode==='original'){const hash=s=>[...s].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);refOrder.sort((a,b)=>hash(a.file.name)-hash(b.file.name));}const timeline=[],uses=new Map();let t=0,i=0;if(!refOrder.length&&useSourceVideo)timeline.push({start:0,end:range.duration,ref:null,sourceStart:0,sourceDuration:range.duration,sourceLabel:S.source.name});while(t<range.duration&&i<120&&refOrder.length){const ref=mode==='faithful'?S.refs[Math.min(S.refs.length-1,Math.floor(t/range.duration*S.refs.length))]:refOrder[i%refOrder.length];const end=Math.min(range.duration,t+shot),clipDuration=end-t,occurrence=uses.get(ref)||0;uses.set(ref,occurrence+1);const totalOccurrences=Math.max(1,Math.ceil((range.duration/shot)/refOrder.length));const sourceDuration=Math.max(0,Number(ref.duration)||0);const scenePoints=Array.isArray(ref.a?.scenePoints)?ref.a.scenePoints:[];const sceneTime=scenePoints.length?scenePoints[occurrence%scenePoints.length]:null;const sourceStart=sourceDuration>clipDuration?Math.max(0,Math.min(sourceDuration-clipDuration,sceneTime==null?(sourceDuration-clipDuration)*(occurrence/Math.max(1,totalOccurrences-1)):sceneTime-clipDuration*.15)):0;timeline.push({start:t,end,ref,sourceStart,sourceDuration:clipDuration});t=end;i++;}return {range,mode,lines,timeline,aspect:radio('aspect')||'16:9',resolution:Number(radio('resolution'))||720};}
function showPlan(p){$('#planSummary').innerHTML='<div class="summary-grid"><div><small>РЕЖИМ</small><b>'+({faithful:'Почти 1:1',inspired:'По мотивам',original:'Своя идея'}[p.mode])+'</b></div><div><small>ФРАГМЕНТ</small><b>'+clock(p.range.start)+'–'+clock(p.range.start+p.range.duration)+'</b></div><div><small>БЛОКИ</small><b>'+p.timeline.length+'</b></div><div><small>ФОРМАТ</small><b>'+p.aspect+' · '+p.resolution+'p</b></div></div><p class="micro-note">Режим влияет на порядок и среднюю длительность планов. Это не обещает покадровую копию референсов.</p>';const ruler=$('#timelineRuler');ruler.innerHTML='';for(let i=0;i<=5;i++){const s=document.createElement('span');s.textContent=clock(p.range.duration*i/5);s.style.left=i*20+'%';ruler.append(s)}const tracks=$('#timelineTracks');tracks.innerHTML='';const row=document.createElement('div');row.className='timeline-track';row.innerHTML='<b>VIDEO</b><div class="clips"></div>';p.timeline.forEach((s,i)=>{const d=document.createElement('div');d.className='timeline-clip clip-'+(i%5);d.style.left=s.start/p.range.duration*100+'%';d.style.width=(s.end-s.start)/p.range.duration*100+'%';const clipName=s.ref?.file?.name||s.sourceLabel||S.source?.name||'Исходное видео';d.title=clipName;d.innerHTML='<span>'+esc((i+1)+'. '+clipName)+'</span>';row.querySelector('.clips').append(d)});tracks.append(row);const au=document.createElement('div');au.className='timeline-track';au.innerHTML='<b>AUDIO</b><div class="audio-clip" style="width:100%"><span>♫ '+esc(S.track.name)+'</span></div>';tracks.append(au);const tx=document.createElement('div');tx.className='timeline-track';tx.innerHTML='<b>TEXT</b><div class="clips"></div>';p.lines.forEach(l=>{const d=document.createElement('div');d.className='timeline-clip text-clip';d.style.left=Math.max(0,l.start-p.range.start)/p.range.duration*100+'%';d.style.width=Math.max(.02,(l.end-l.start)/p.range.duration*100)+'%';d.title=l.text;d.innerHTML='<span>'+esc(l.text)+'</span>';tx.querySelector('.clips').append(d)});tracks.append(tx);}
$('#planBtn').onclick=()=>{try{S.plan=makePlan();showPlan(S.plan);$('#renderProgressWrap').classList.add('hidden');$('#exportResult').classList.add('hidden');step(3);$('#renderStatus').textContent='ГОТОВ К РЕНДЕРУ';toast('Монтажный план сформирован.');const project={id:Date.now(),name:S.track.name.replace(/\.[^.]+$/,''),date:new Date().toLocaleString('ru-RU'),summary:S.refs.length+' референсов · '+clock(S.plan.range.duration)+' · '+S.plan.aspect,project_data:{range:S.plan.range,mode:S.plan.mode,aspect:S.plan.aspect,resolution:S.plan.resolution,referenceNames:S.refs.map(x=>x.file.name),sourceName:S.source?.name||null,useSourceVideo:!!(S.source&&$('#useSourceVideo').checked),audioMode:radio('audioMode')||'music',trackName:S.track.name,timeline:S.plan.timeline.map(x=>({start:x.start,end:x.end,sourceStart:x.sourceStart||0,referenceName:x.ref?.file?.name||x.sourceLabel||S.source?.name||'Исходное видео',sourceLabel:x.sourceLabel||S.source?.name||null})),lyrics:S.plan.lines}};S.projects.unshift(project);S.projects=S.projects.slice(0,15);persistLocalProjects();stats();saveProjectMedia(project).then(()=>toast('Проект и исходные медиа сохранены на устройстве.','success')).catch(e=>toast('План сохранён, но медиа не удалось сохранить: '+e.message+' Выбирай исходные файлы повторно после перезагрузки.','warn'));if(cloudUser){cloudSaveProject(project).then(()=>{toast('Монтажный план сохранён в облако.','success');refreshCloudProjects()}).catch(e=>toast('План создан, но облачное сохранение не удалось: '+e.message,'warn'));}}catch(e){toast(e.message,'error')}};
function progress(n,title,log){const pct=Math.max(0,Math.min(100,Number(n)||0));$('#renderProgressWrap').classList.remove('hidden');$('#renderStage').textContent=title;$('#renderPercent').textContent=Math.round(pct)+'% готово';$('#renderRemaining').textContent=Math.round(100-pct)+'% осталось';$('#renderBar').style.width=pct+'%';$('#renderLog').textContent=log;}
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
    // FFmpeg 0.12 loads its core as an ES module inside a worker. Convert the
    // same-origin responses to explicit MIME-typed blob URLs to avoid WebView
    // module-import failures caused by Pages MIME/CORS handling.
    const coreSourceUrl=URL.createObjectURL(coreBlob),wasmSourceUrl=URL.createObjectURL(wasmBlob);
    let moduleUrls;
    try{
      moduleUrls=await Promise.allSettled([
        toBlobURL(coreSourceUrl,'text/javascript'),
        toBlobURL(wasmSourceUrl,'application/wasm')
      ]);
    }finally{
      // These intermediate URLs are only fetch sources for toBlobURL. The
      // typed module URLs returned below are the ones FFmpeg needs to load.
      URL.revokeObjectURL(coreSourceUrl);
      URL.revokeObjectURL(wasmSourceUrl);
    }
    const failedModule=moduleUrls.find(x=>x.status==='rejected');
    if(failedModule)throw failedModule.reason;
    const [coreModuleUrl,wasmModuleUrl]=moduleUrls.map(x=>x.value);
    try{
      await ff.load({coreURL:coreModuleUrl,wasmURL:wasmModuleUrl});
      loaded=true;
    }finally{
      // FFmpeg has fetched/initialized both resources once load resolves.
      // Release the typed URLs too, even if initialization fails.
      URL.revokeObjectURL(coreModuleUrl);
      URL.revokeObjectURL(wasmModuleUrl);
    }
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
 const engine=createMotionDirector({duration,fps});
 engine.track('opacity',{start:0,duration:.28,from:0,to:1,ease:'power2Out'});
 engine.track('opacity',{start:Math.max(0,duration-.28),duration:.28,from:1,to:0,ease:'power2In'});
 engine.track('scale',{start:0,duration:.42,from:.82,to:1,ease:'backOut'});
 engine.track('rise',{start:0,duration:.3,from:height*.035,to:0,ease:'power2Out'});
 engine.hook('frame',({time})=>({lineProgress:visible.map((_,j)=>Math.max(0,Math.min(1,(time-j*.06)/.28)))}));
 for(let i=0;i<frames;i++){
  const t=i/fps,state=engine.sampleAt(t),fade=state.opacity??1,spring=state.scale??1;
  ctx.clearRect(0,0,width,height);ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,fade));
  ctx.translate(width/2,height*.48+(state.rise??0));ctx.scale(spring,spring);ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='800 '+fontSize+'px Arial, sans-serif';ctx.lineJoin='round';ctx.lineWidth=Math.max(3,fontSize*.09);
  ctx.strokeStyle='rgba(5,7,18,.9)';ctx.fillStyle='#ffffff';ctx.shadowColor='rgba(76,220,255,.85)';ctx.shadowBlur=fontSize*.55;
  const y0=-(visible.length-1)*lineHeight/2+Math.sin(Math.min(1,t/.3)*Math.PI/2)*height*.035;
  visible.forEach((line,j)=>{const p=state.lineProgress?.[j]??1,y=y0+j*lineHeight+(1-p)*fontSize*.45;ctx.globalAlpha=Math.max(0,Math.min(1,fade*p));ctx.strokeText(line,0,y);ctx.fillText(line,0,y);});
  ctx.restore();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось создать кадр титра.')),'image/png'));
  await writeFrame(i,new Uint8Array(await blob.arrayBuffer()));
 }
}

async function cleanupRenderArtifacts(){
 try{
  const entries=await ff.listDir('/');
  for(const entry of entries){
   if(entry.isDir)continue;
   const name=entry.name||'';
   if(!/^(?:silent|export|composite|title-composite|graphic-composite|concat|lyrics|music|motion-sfx|source-video|source[0-9]+|part[0-9]+|ref[0-9]+|x[0-9]+|3d_[0-9]+|title_[0-9]+|graphic_[0-9]+)(?:\.[a-z0-9]+)?$/i.test(name))continue;
   try{await ff.deleteFile(name)}catch{}
  }
 }catch{}
 finally{S.refs.forEach(ref=>{delete ref._ff;});}
}

function clearPreviousExportPreview(){
 if(!S.output)return;
 const previous=S.output;S.output=null;URL.revokeObjectURL(previous);
 const v=$('#previewVideo');
 if(v.src!==previous)return;
 v.pause();v.removeAttribute('src');v.load();v.hidden=true;
 delete v.dataset.referencePlaylist;delete v.dataset.referenceIndex;
 $('#previewStage').classList.remove('has-preview');
 $('#previewStage .preview-placeholder').hidden=false;
 $('#playPreview').textContent='▶';
}

async function validateExportMedia(blob,W,H,duration){
 let probeLog='';
 const capture=({message=''})=>{probeLog+=message+'\n';};
 ff.on('log',capture);
 try{await ff.exec(['-hide_banner','-i','export.mp4']);}catch{}
 finally{ff.off('log',capture);}
 if(!/\bVideo:\s/i.test(probeLog)||!/\bAudio:\s/i.test(probeLog))
  throw Error('MP4 не прошёл проверку потоков: ожидаются и видео, и аудио. '+probeLog.slice(-360));
 const url=URL.createObjectURL(blob),video=document.createElement('video');
 video.preload='metadata';video.muted=true;video.playsInline=true;
 try{
  await new Promise((resolve,reject)=>{
   let timer,settled=false;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);video.removeEventListener('loadedmetadata',loaded);video.removeEventListener('error',failed);error?reject(error):resolve();};
   const loaded=()=>{
    if(video.videoWidth!==W||video.videoHeight!==H){finish(new Error('Размеры MP4 не совпали с настройкой: ожидалось '+W+'×'+H+', получено '+video.videoWidth+'×'+video.videoHeight+'.'));return;}
    if(!Number.isFinite(video.duration)||Math.abs(video.duration-duration)>Math.max(1,duration*.03)){finish(new Error('Длительность MP4 не совпала с монтажным планом: ожидалось '+duration.toFixed(2)+' с, получено '+(Number.isFinite(video.duration)?video.duration.toFixed(2):'неизвестно')+' с.'));return;}
    finish();
   };
   const failed=()=>finish(new Error('Браузер не смог прочитать метаданные созданного MP4.'));
   timer=setTimeout(()=>finish(new Error('Проверка метаданных MP4 превысила 30 секунд.')),30000);
   video.addEventListener('loadedmetadata',loaded);
   video.addEventListener('error',failed);
   video.src=url;video.load();
  });
 }finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

async function exportMotionGraphic({graphic='ring',width,height,duration,fps=30,color='#6ce7ff',writeFrame}){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D недоступен для графических акцентов.');
 const frames=Math.max(1,Math.min(180,Math.ceil(duration*fps))),minSide=Math.min(width,height);
 const timeline=createMotionDirector({duration,fps});
 timeline.track('progress',{start:0,duration:Math.min(.48,duration),from:0,to:1,ease:'expoOut'});
 timeline.track('opacity',{start:0,duration:.08,from:0,to:1,ease:'power2Out'});
 timeline.track('opacity',{start:Math.max(0,duration-.24),duration:.24,from:1,to:0,ease:'power2In'});
 for(let i=0;i<frames;i++){
  const t=i/fps,state=timeline.sampleAt(t),p=Math.max(0,Math.min(1,state.progress??1));
  ctx.clearRect(0,0,width,height);ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,state.opacity??1));
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.max(3,minSide*.006);ctx.lineCap='round';ctx.lineJoin='round';
  if(graphic==='underline'){
   const x1=width*.17,x2=x1+(width*.66*p),y=height*.57;
   ctx.beginPath();ctx.moveTo(x1,y);
   for(let x=x1+12;x<x2;x+=12)ctx.lineTo(x,y+Math.sin((x-x1)/18)*minSide*.006);
   ctx.lineTo(x2,y);ctx.stroke();
  }else if(graphic==='arrow'){
   const x1=width*.24,y1=height*.64,x2=x1+width*.48*p,y2=height*.38;
   ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(width*.42,height*.61,x2,y2);ctx.stroke();
   const angle=Math.atan2(y2-height*.61,x2-width*.42),head=minSide*.035;
   ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(angle-.48),y2-head*Math.sin(angle-.48));ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(angle+.48),y2-head*Math.sin(angle+.48));ctx.stroke();
  }else if(graphic==='burst'){
   const cx=width*.5,cy=height*.48,r0=minSide*.08,r1=r0+minSide*.24*p;
   for(let k=0;k<12;k++){const a=k*Math.PI/6;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);ctx.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.stroke();}
  }else{
   const cx=width*.5,cy=height*.48,r=minSide*(graphic==='circle'?.22:.09+.19*p);
   ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
   if(graphic==='ring'){ctx.beginPath();ctx.arc(cx,cy,r+minSide*.035,0,Math.PI*2);ctx.stroke();}
  }
  ctx.restore();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось получить PNG графического акцента.')),'image/png'));
  await writeFrame(i,new Uint8Array(await blob.arrayBuffer()));
 }
}

$('#renderBtn').onclick=async()=>{if(S.busy)return;if(!S.plan){toast('Сначала собери монтажный план.','warn');return;}clearPreviousExportPreview();S.busy=true;const b=$('#renderBtn');busy(b,true,'Рендеринг…');$('#renderStatus').textContent='РЕНДЕРИНГ';$('#renderStatus').className='render-status is-running';$('#exportResult').classList.add('hidden');try{progress(2,'Загружаю движок…','FFmpeg WebAssembly.');await ffReady();const p=S.plan,r=p.range,baseSize=Math.max(2,Math.round(p.resolution/2)*2),W=p.aspect==='9:16'?Math.max(2,Math.round(baseSize*9/16/2)*2):p.aspect==='1:1'?baseSize:Math.max(2,Math.round(baseSize*16/9/2)*2),H=baseSize;let sourceAudioInput=null,sourceAudioSeek=0;const motionTransitionCues=[];
if(S.source&&$('#useSourceVideo').checked){
 const sourceExt=(S.source.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'');
 const sourceInput='source-video.'+sourceExt;sourceAudioInput=sourceInput;
 progress(5,'Подготавливаю исходное видео…',S.source.name+' · сохраняю кадры в выбранном формате');
 await ff.writeFile(sourceInput,await fetchFile(S.source));
 const sourceDuration=Number(S.sourceMeta?.duration)||r.duration;const sourceSeek=Math.max(0,Math.min(r.start,Math.max(0,sourceDuration-0.1)));sourceAudioSeek=sourceSeek;const sourceArgs=['-ss',String(sourceSeek),'-i',sourceInput,'-vf',`tpad=stop_mode=clone:stop_duration=${r.duration},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`,'-an','-c:v','libx264','-preset','ultrafast','-crf','25','-t',String(r.duration),'-y','silent.mp4'];
 if(await ff.exec(sourceArgs)!==0)throw Error('Не удалось подготовить исходное видео. Попробуй MP4/H.264 или более короткий файл.');
}else{
const segmentDurations=[];
for(let i=0;i<p.timeline.length;i++){
 const s=p.timeline[i],part='part'+i+'.mp4';
 const start=Math.max(0,Number(s.sourceStart)||0),dur=Math.max(.1,s.end-s.start);
 segmentDurations.push(dur);
 progress(5+30*i/Math.max(1,p.timeline.length),'Подготавливаю фрагменты…',(i+1)+' / '+p.timeline.length+' · '+s.ref.file.name);
 if(!s.ref._ff){s.ref._ff='source'+S.refs.indexOf(s.ref)+'.mp4';await ff.writeFile(s.ref._ff,await fetchFile(s.ref.file));}
 const res=await ff.exec(['-ss',String(start),'-i',s.ref._ff,'-t',String(dur),'-vf',`tpad=stop_mode=clone:stop_duration=${dur},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},zoompan=z='min(1.025+on*0.0003,1.06)':x='iw/2-(iw/zoom/2)+sin(on/18+${i})*iw*0.005':y='ih/2-(ih/zoom/2)+cos(on/24+${i})*ih*0.005':d=1:s=${W}x${H}:fps=30,setsar=1,format=yuv420p`,'-an','-c:v','libx264','-preset','ultrafast','-crf','25','-y',part]);
 if(res!==0)throw Error('Ошибка кодирования фрагмента '+(i+1));
}
if(!segmentDurations.length)throw Error('Добавь хотя бы один видеофрагмент в монтажный план.');
progress(38,'Собираю монтаж…',segmentDurations.length>1?'Плавно соединяю '+segmentDurations.length+' клипов.':'Подготавливаю один видеоклип.');
if(segmentDurations.length===1){
 if(await ff.exec(['-i','part0.mp4','-c','copy','-y','silent.mp4'])!==0)throw Error('Не удалось подготовить видеоклип.');
}else{
 const transition=Math.max(1/30,Math.floor(Math.min(.35,...segmentDurations.map(d=>d*.45))*30)/30);
 const overlapTotal=transition*(segmentDurations.length-1);
 const padding=Math.max(0,r.duration-(segmentDurations.reduce((sum,d)=>sum+d,0)-overlapTotal));
 const args=[];
 for(let i=0;i<segmentDurations.length;i++)args.push('-i','part'+i+'.mp4');
 const filters=[];
 for(let i=0;i<segmentDurations.length;i++)filters.push('['+i+':v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v'+i+']');
 let current='v0',elapsed=segmentDurations[0];
 for(let i=1;i<segmentDurations.length;i++){
  const next='x'+i,offset=Math.max(0,elapsed-transition*(i-1)-transition);
  motionTransitionCues.push(offset);
  filters.push('['+current+'][v'+i+']xfade=transition=fade:duration='+transition.toFixed(6)+':offset='+offset.toFixed(6)+'['+next+']');
  current=next;elapsed+=segmentDurations[i];
 }
 filters.push('['+current+']tpad=stop_mode=clone:stop_duration='+padding.toFixed(6)+',format=yuv420p[outv]');
 args.push('-filter_complex',filters.join(';'),'-map','[outv]','-an','-c:v','libx264','-preset','ultrafast','-crf','25','-t',String(r.duration),'-y','silent.mp4');
 if(await ff.exec(args)!==0)throw Error('Не удалось собрать плавные переходы между клипами. Попробуй более короткие фрагменты.');
}
}
const threeDEdit=(S.edits||[]).find(e=>e.type==='add_3d_title');
if(threeDEdit){
 if(!motion3d)start3DPreview(threeDEdit.text||'NOVEX',threeDEdit.style||{});
 if(!motion3d)throw Error('Не удалось создать 3D-сцену для экспорта.');
 motion3d.setText(threeDEdit.text||'NOVEX');
 motion3d.setOptions(threeDEdit.style||{});
 const fps=Math.max(1,Math.min(Math.ceil(Math.min(threeDEdit.duration||2.8,r.duration)*fps),180));
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
const graphicEdits=(S.edits||[]).filter(e=>e.type==='add_motion_graphic');
for(let gi=0;gi<graphicEdits.length;gi++){
 const edit=graphicEdits[gi],overlayStart=Math.max(0,Number(edit.start)||0);
 if(overlayStart>=r.duration)continue;
 const graphicDuration=Math.min(Math.max(.25,Number(edit.duration)||1.2),Math.max(.1,r.duration-overlayStart)),fps=30,frames=Math.max(1,Math.min(180,Math.ceil(graphicDuration*fps)));
 progress(41,'Рендерю графические акценты…',(gi+1)+' / '+graphicEdits.length+' · '+String(edit.graphic||'ring'));
 await exportMotionGraphic({graphic:edit.graphic||'ring',width:W,height:H,duration:graphicDuration,fps,color:edit.color||'#6ce7ff',writeFrame:async(i,bytes)=>ff.writeFile('graphic_'+String(i).padStart(4,'0')+'.png',bytes)});
 const graphicArgs=['-i','silent.mp4','-itsoffset',String(overlayStart),'-framerate',String(fps),'-start_number','0','-i','graphic_%04d.png','-filter_complex',"[0:v][1:v]overlay=0:0:enable='between(t,"+overlayStart.toFixed(3)+","+(overlayStart+graphicDuration).toFixed(3)+")':eof_action=pass:shortest=0,format=yuv420p[v]",'-map','[v]','-an','-c:v','libx264','-preset','ultrafast','-crf','24','-t',String(r.duration),'-y','graphic-composite.mp4'];
 if(await ff.exec(graphicArgs)!==0)throw Error('Не удалось наложить графический акцент.');
 await ff.writeFile('silent.mp4',await ff.readFile('graphic-composite.mp4'));
 for(let i=0;i<frames;i++)try{await ff.deleteFile('graphic_'+String(i).padStart(4,'0')+'.png')}catch{}
}
const motionAudio=createMotionDirector({duration:r.duration,fps:30});
const cueAt=start=>Math.max(0,Number(start||0)-r.start);
if(threeDEdit)motionAudio.hit(cueAt(threeDEdit.start),'l');
for(const edit of titleEdits)if(cueAt(edit.start)<r.duration)motionAudio.sfx('pop',cueAt(edit.start),{gain:-7,duration:.14});
for(const edit of graphicEdits)if(cueAt(edit.start)<r.duration)motionAudio.sfx(edit.graphic==='ring'?'whoosh':'tick',cueAt(edit.start),{gain:-8,duration:.18});
for(const at of motionTransitionCues)motionAudio.sfx('whoosh',at,{gain:-9,duration:.28});
const motionAudioCues=motionAudio.compile().audio;
if(motionAudioCues.length){
 await ff.writeFile('motion-sfx.wav',motionAudio.synthesizeAudio({sampleRate:24000,masterGain:.24}));
}
const audioMode=radio('audioMode')||'music';
if(audioMode==='source'&&!S.source)throw Error('Добавь видео-источник, чтобы использовать его звук.');
const args=['-i','silent.mp4'];
if(audioMode==='source'){
 if(!sourceAudioInput){
  const sourceExt=(S.source.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'');
  sourceAudioInput='source-video.'+sourceExt;
  await ff.writeFile(sourceAudioInput,await fetchFile(S.source));
  const sourceDuration=Number(S.sourceMeta?.duration)||r.duration;
  sourceAudioSeek=Math.max(0,Math.min(r.start,Math.max(0,sourceDuration-.1)));
 }
 let probeLog='';
 const capture=({message=''})=>{probeLog+=message+'\n';};
 ff.on('log',capture);
 try{await ff.exec(['-hide_banner','-i',sourceAudioInput]);}catch{}finally{ff.off('log',capture);}
 if(!/\bAudio:\s/i.test(probeLog))throw Error('В выбранном видео-источнике нет доступной аудиодорожки. Выбери музыкальный трек или другое видео.');
 args.push('-ss',String(sourceAudioSeek),'-t',String(r.duration),'-i',sourceAudioInput);
}else{
 const ext=(S.track.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'');
 await ff.writeFile('music.'+ext,await fetchFile(S.track));
 args.push('-ss',String(r.start),'-t',String(r.duration),'-i','music.'+ext);
}
let baseAudioInput=1;
if(motionAudioCues.length){args.push('-i','motion-sfx.wav');}
const lyrics=p.lines.map((l,i)=>(i+1)+'\n'+srt(Math.max(0,l.start-r.start))+' --> '+srt(Math.max(.1,l.end-r.start))+'\n'+l.text).join('\n\n');const subtitlesEdit=(S.edits||[]).some(e=>e.type==='add_subtitles');let vf='null';if(lyrics&&($('#burnLyrics').checked||$('#useSourceTranscript').checked||subtitlesEdit)){await ff.writeFile('lyrics.srt',new TextEncoder().encode(lyrics));vf="subtitles=lyrics.srt:force_style='FontSize="+Math.max(18,Math.round(H/38))+",Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV="+Math.round(H*.08)+"'";}const gradeEdit=(S.edits||[]).some(e=>e.type==='grade');if(gradeEdit)vf=(vf==='null'?'':vf+',')+'eq=brightness=0.035:saturation=1.22';const cameraEdit=(S.edits||[]).some(e=>e.type==='camera_motion');if(cameraEdit&&S.source)vf=(vf==='null'?'':vf+',')+`scale=${Math.round(W*1.06)}:${Math.round(H*1.06)},crop=${W}:${H}:x='(iw-ow)/2+sin(t*1.4)*iw*0.006':y='(ih-oh)/2+cos(t*1.1)*ih*0.006'`;if(subtitlesEdit&&!p.lines.length)throw Error('Добавление субтитров требует текста в поле «Текст трека». Это приложение не выдаёт равномерную разбивку за распознавание речи.');
progress(42,audioMode==='source'?'Использую звук видео-источника…':'Добавляю музыкальный трек…',motionAudioCues.length?'К выбранной дорожке добавляются только автоматические звуковые акценты анимаций.':audioMode==='source'?'В MP4 будет звук видео-источника.':'В MP4 будет музыкальный трек.');args.push('-vf',vf,'-map','0:v:0');
if(motionAudioCues.length){
 args.push('-filter_complex','[1:a:0]aresample=48000,apad=pad_dur='+String(r.duration)+',atrim=duration='+String(r.duration)+'[base];[2:a:0]aresample=48000,volume=0.7[sfx];[base][sfx]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[aout]','-map','[aout]');
}else args.push('-map','1:a:0','-af','aresample=48000,apad=pad_dur='+String(r.duration)+',atrim=duration='+String(r.duration)+',alimiter=limit=0.95');args.push('-t',String(r.duration),'-c:v','libx264','-preset','ultrafast','-crf',p.resolution>720?'22':'26','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-y','export.mp4');if(await ff.exec(args)!==0)throw Error('Не удалось финализировать MP4. Попробуй более короткий отрывок или 480p.');progress(97,'Проверяю результат…','Читаю созданный MP4.');const data=await ff.readFile('export.mp4');if(!data||data.length<1000)throw Error('Файл MP4 пуст или некорректен.');progress(98,'Проверяю контейнер MP4…','Проверяю сигнатуру, аудио/видеопотоки, разрешение и длительность.');const mp4Head=Array.from(data.slice(4,8),x=>String.fromCharCode(x)).join('');if(mp4Head!=='ftyp')throw Error('Экспорт не прошёл проверку MP4: отсутствует заголовок ftyp.');const blob=new Blob([data],{type:'video/mp4'});await validateExportMedia(blob,W,H,r.duration);if(S.output)URL.revokeObjectURL(S.output);S.output=URL.createObjectURL(blob);S.outputName='NOVEX_'+new Date().toISOString().replace(/[:.]/g,'-')+'.mp4';const v=$('#previewVideo');delete v.dataset.referencePlaylist;delete v.dataset.referenceIndex;v.classList.remove('preview-fade-out');v.src=S.output;v.hidden=false;$('#previewStage .preview-placeholder').hidden=true;$('#previewStage').classList.add('has-preview');fitPreviewStage();$('#exportMeta').textContent='MP4 · H.264/AAC · '+size(blob.size)+' · '+W+'×'+H;$('#exportResult').classList.remove('hidden');$('#renderStatus').textContent='ГОТОВО';$('#renderStatus').className='render-status is-done';progress(100,'Экспорт готов','MP4 создан. Нажми «Скачать MP4».');toast('MP4 готов: '+size(blob.size),'success');}catch(e){console.error(e);$('#renderStatus').textContent='ОШИБКА';$('#renderStatus').className='render-status has-error';progress(0,'Рендер не завершён',e?.message||String(e)||'Неизвестная ошибка FFmpeg');toast(e?.message||String(e)||'Неизвестная ошибка FFmpeg','error')}finally{await cleanupRenderArtifacts();S.busy=false;busy(b,false);}};

// Natural-language motion commands: validated project patches, never eval/model code execution.
const EDIT_PRESETS={
  '3d':{type:'add_3d_title',label:'3D-логотип',text:'NOVEX',start:0,duration:2.8,style:{geometry:'extruded-text',material:'chrome',camera:'slow-orbit',effect:'cinematic-particles',lighting:'cinematic-rim',depth:1}},
  'titles':{type:'add_kinetic_title',label:'Кинетический текст',text:'',start:0,duration:2,style:{entrance:'spring-up',exit:'fade-out',easing:'back-out'}},
  'subtitles':{type:'add_subtitles',label:'Субтитры',start:0,duration:0,style:{position:'safe-bottom',highlight:'active-word'}},
  'graphic':{type:'add_motion_graphic',label:'Графический акцент',graphic:'ring',start:0,duration:1.2,color:'#6ce7ff',style:{entrance:'draw-on',exit:'fade-out',easing:'expo-out'}}
};
let motion3d=null;
function start3DPreview(label='NOVEX',options={}){
 const canvas=$('#motion3dCanvas');
 if(!canvas)return;
 try{
  if(!motion3d)motion3d=createLogoScene(canvas);
  motion3d.setText(label);
  motion3d.setOptions(options);
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
  if(/\b(3d|3д|объ[её]мн|тр[её]хмер|камера|экструд|частиц|энергетическ|светов(?:ые|ых) луч)/.test(q)){const quoted=raw.match(/[«"]([^»"]{1,32})[»"]/);const named=raw.match(/(?:логотип|слово)\s+([\p{L}\p{N}_-]{2,24})/iu);const camera=/обл[её]т|orbit|облет камеры/.test(q)?'orbit':/наезд|приближ|dolly.?in/.test(q)?'dolly-in':/отъезд|dolly.?out/.test(q)?'dolly-out':/рывок камеры|whip.?pan/.test(q)?'whip-pan':'slow-orbit';const effect=/кольц|портал|энергетическ/.test(q)?'energy-rings':/светов(?:ые|ых) луч|скоростные луч/.test(q)?'light-streaks':/без эффект|убери эффект/.test(q)?'none':'cinematic-particles';return {...EDIT_PRESETS['3d'],text:(quoted?.[1]||named?.[1]||'NOVEX').trim(),style:{...EDIT_PRESETS['3d'].style,camera,effect}};}
  if(/кольц|обвод|подчерк|стрелк|вспыш|лучи|графическ/.test(q)){const graphic=/подчерк/.test(q)?'underline':/стрелк/.test(q)?'arrow':/вспыш|лучи/.test(q)?'burst':/обвод/.test(q)?'circle':'ring';return {...EDIT_PRESETS.graphic,graphic,label:({underline:'Волновое подчёркивание',arrow:'Анимированная стрелка',burst:'Вспышка и лучи',circle:'Обводка',ring:'Кольцевой акцент'})[graphic]};}
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
 if(patch.type==='camera_motion'&&!S.source)throw Error('Движение камеры сейчас доступно только для загруженного исходного видео. Для монтажа одних референсов команда не применяется — загрузи исходник или выбери другую правку.');
 if(patch.type==='undo'){
  if(!S.editHistory.length)throw Error('Пока нечего отменять.');
  S.edits=S.editHistory.pop();renderDirectorPlan();$('#directorStatus').textContent='Последняя правка отменена';return;
 }
 if(!S.plan&&!S.refs.length&&!S.source)throw Error('Сначала добавь исходное видео или референс, затем можно планировать правки.');
 S.editHistory.push(S.edits.map(x=>({...x})));
 patch.id='edit-'+Date.now()+'-'+S.edits.length;
 patch.description=patch.type==='add_3d_title'?'Текст: '+patch.text+' · экструзия · хром · облёт камеры':patch.type==='add_kinetic_title'?'Анимированный текст: '+(patch.text||'из команды')+' · пружинящее появление':patch.type==='add_subtitles'?'Субтитры в безопасной нижней зоне':patch.type==='add_motion_graphic'?'Графика: '+patch.graphic+' · '+patch.duration+' с':patch.label;
 S.edits.push(patch);if(patch.type==='add_3d_title')start3DPreview(patch.text||'NOVEX',patch.style||{});if(patch.type==='add_subtitles')$('#burnLyrics').checked=true;renderDirectorPlan();$('#directorStatus').textContent='План обновлён · '+S.edits.length+' прав.';
 if(S.plan){S.plan=makePlan();S.plan.edits=S.edits.map(x=>({...x}));showPlan(S.plan);}
}
$('#applyEditCommand').onclick=()=>{try{applyDirectorCommand($('#editCommand').value);$('#directorPlan').classList.remove('hidden');toast('Команда разобрана и добавлена в план правок.','success')}catch(e){toast(e.message,'warn');$('#directorStatus').textContent=e.message}};
$('[data-command]').forEach(b=>b.onclick=()=>{const k=b.dataset.command;if(k==='undo'){try{applyDirectorCommand('отмени последнюю правку')}catch(e){toast(e.message,'warn')}return;}$('#editCommand').value=({'3d':'Добавь в начале объёмный 3D-логотип NOVEX с хромом и медленным вращением камеры.',orbit:'Добавь 3D-логотип NOVEX с полным облётом камеры и частицами.',rings:'Добавь 3D-логотип NOVEX с энергетическими кольцами и кинематографическим светом.',streaks:'Добавь 3D-логотип NOVEX со световыми лучами и быстрым движением камеры.',titles:'Добавь кинетические титры с пружинящим появлением.',subtitles:'Добавь субтитры в безопасной нижней зоне и подсвечивай активное слово.',graphic:'Добавь графический акцент-кольцо с плавным появлением.'})[k];if(k==='3d'||k==='orbit'||k==='rings'||k==='streaks')start3DPreview('NOVEX',k==='orbit'?{camera:'orbit',effect:'cinematic-particles'}:k==='rings'?{camera:'slow-orbit',effect:'energy-rings'}:k==='streaks'?{camera:'whip-pan',effect:'light-streaks'}:{});});

function srt(t){const ms=Math.round(Math.max(0,t)*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),z=ms%1000;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(z).padStart(3,'0')}
$('#downloadBtn').onclick=async()=>{
  if(!S.output)return;
  if(Capacitor.isNativePlatform()){
    const button=$('#downloadBtn');
    const filename=String(S.outputName||'NOVEX.mp4').replace(/[\\/:*?"<>|]/g,'_');
    busy(button,true,'Сохраняем…');
    try{
      const blob=await (await fetch(S.output)).blob();
      if(blob.size>120*1024*1024)throw new Error('Файл больше 120 МБ. Чтобы безопасно сохранить его на Android, уменьши длительность или разрешение экспорта.');
      const data=await blobToBase64(blob);
      const saved=await Filesystem.writeFile({path:'NOVEX/'+filename,data,directory:Directory.Documents,recursive:true});
      try{
        await Share.share({title:'NOVEX Motion Studio',text:'Готовый MP4: '+filename,url:saved.uri,dialogTitle:'Сохранить или поделиться видео'});
        toast('MP4 сохранён в Documents/NOVEX.','success');
      }catch(error){
        toast('MP4 сохранён в Documents/NOVEX, но системное меню отправки не открылось: '+(error?.message||error),'warn');
      }
    }catch(error){toast('Не удалось сохранить MP4 на устройстве: '+(error?.message||error),'error');}
    finally{busy(button,false);}
    return;
  }
  const a=document.createElement('a');a.href=S.output;a.download=S.outputName;a.click();toast('Скачивание MP4 запрошено.','success');
};
$('#playPreview').onclick=()=>{const v=$('#previewVideo');if(v.hidden){if(!S.output&&S.refs.length){playReferenceAt(0,true,false);return;}const previewUrl=S.output||((S.source&&$('#useSourceVideo').checked)?S.sourceUrl:S.refs[0]?.url);if(!previewUrl)return toast('Сначала добавь исходное видео или референс.','warn');v.src=previewUrl;v.hidden=false;$('#previewStage .preview-placeholder').hidden=true;$('#previewStage').classList.add('has-preview');fitPreviewStage()}if(v.paused){v.play().catch(()=>{});$('#playPreview').textContent='Ⅱ'}else{v.pause();$('#playPreview').textContent='▶'}};
function fitPreviewStage(){const v=$('#previewVideo'),stage=$('#previewStage');if(!stage)return;const ratio=v.videoWidth>0&&v.videoHeight>0?v.videoWidth/v.videoHeight:Number(stage.style.getPropertyValue('--preview-ratio'))||9/16;const maxHeight=Math.min(520,Math.max(180,window.innerHeight*.64));const parentWidth=stage.parentElement?.clientWidth||520;const available=Math.max(1,Math.min(parentWidth,stage.parentElement?.getBoundingClientRect().width||parentWidth));const width=Math.max(1,Math.min(available,920,maxHeight*ratio));stage.style.width='min('+width+'px, 100%)';stage.style.maxWidth='100%';stage.style.setProperty('--preview-ratio',String(ratio));stage.style.aspectRatio=ratio+' / 1';stage.classList.toggle('preview-landscape',ratio>1.15);stage.classList.toggle('preview-square',ratio>=.85&&ratio<=1.15);stage.classList.toggle('preview-portrait',ratio<.85);}
$('#previewVideo').onloadedmetadata=fitPreviewStage;window.addEventListener('resize',fitPreviewStage);
$('#previewVideo').ontimeupdate=()=>{const v=$('#previewVideo');$('#previewClock').textContent=clock(v.currentTime)+' / '+clock(v.duration);$('#previewSeekFill').style.width=(v.currentTime/(v.duration||1)*100)+'%';const t=$('#previewTime');if(t)t.textContent=clock(v.currentTime);};
$('#previewVideo').onplay=()=>{$('#playPreview').textContent='Ⅱ';};
$('#previewVideo').onpause=()=>{$('#playPreview').textContent='▶';};
$('#previewVideo').onended=()=>{const v=$('#previewVideo');if(v.dataset.referencePlaylist==='true'&&S.refs.length>1){const current=Number(v.dataset.referenceIndex)||0;playReferenceAt(current+1,true,true);return;}$('#playPreview').textContent='▶';};
$('.preview-track').onclick=e=>{const v=$('#previewVideo');if(!v.duration)return;const r=e.currentTarget.getBoundingClientRect();v.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*v.duration;};

function reset(){if(S.busy)return toast('Дождись завершения рендера.','warn');const au=$('#trackAudio'),sourceAudio=$('#sourceAudioPreview');au.pause();au.removeAttribute('src');au.load();au.hidden=true;sourceAudio.pause();sourceAudio.removeAttribute('src');sourceAudio.load();sourceAudio.hidden=true;S.refs.forEach(x=>URL.revokeObjectURL(x.url));if(S.trackUrl)URL.revokeObjectURL(S.trackUrl);if(S.sourceUrl)URL.revokeObjectURL(S.sourceUrl);if(S.output)URL.revokeObjectURL(S.output);Object.assign(S,{refs:[],track:null,trackUrl:null,source:null,sourceUrl:null,sourceMeta:null,duration:0,bpm:null,analysis:[],plan:null,output:null,edits:[],editHistory:[]});$('#editCommand').value='';$('#audioExportControls').hidden=true;$('#useSourceVideo').checked=false;$('input[name="audioMode"][value="music"]').checked=true;syncSourceAudioControls();$('#sourceAudioStatus').textContent='Можно прослушать исходный звук видео, если в нём есть аудиодорожка.';$('#directorStatus').textContent='Пока нет правок';renderDirectorPlan();['referenceInput','trackInput','sourceVideoInput'].forEach(x=>$('#'+x).value='');$('#lyrics').value='';$('#sourceTranscript').value='';$('#trackName').textContent='Загрузи трек';$('#trackMeta').textContent='Для анализа ритма и длительности';$('#sourceVideoName').textContent='Добавить видео-источник';$('#sourceTranscriptWrap').classList.add('hidden');$('#previewVideo').hidden=true;$('#previewVideo').removeAttribute('src');$('#previewStage').classList.remove('has-preview');$('#previewStage .preview-placeholder').hidden=false;$('#planSummary').innerHTML='';$('#timelineTracks').innerHTML='';$('#exportResult').classList.add('hidden');$('#renderProgressWrap').classList.add('hidden');refList();signals([]);step(1);view('studio');toast('Новый проект готов.');}
$('#newProjectTop').onclick=reset;$('#newProjectProjects').onclick=reset;$('#backToMaterials').onclick=()=>step(1);$('#backToAnalysis').onclick=()=>step(1);$('#backToDirection').onclick=()=>step(2);
async function openProject(p){const d=p.project_data||{};const refs=d.referenceNames||[];let matched=refs.map(n=>S.refs.find(x=>x.file.name===n));let trackOk=!!S.track&&S.track.name===d.trackName;let sourceOk=!!d.sourceName&&!!S.source&&S.source.name===d.sourceName;if(matched.some(x=>!x)||(!matched.length&&!sourceOk)||!trackOk||(d.sourceName&&!sourceOk)){const restored=await restoreProjectMedia(p,refs);if(!restored)return;matched=refs.map(n=>S.refs.find(x=>x.file.name===n));trackOk=!!S.track&&S.track.name===d.trackName;sourceOk=!!d.sourceName&&!!S.source&&S.source.name===d.sourceName;if(matched.some(x=>!x)||(!matched.length&&!sourceOk)||!trackOk||(d.sourceName&&!sourceOk)){toast('Не удалось восстановить все материалы проекта.','warn');return;}}$('#useSourceVideo').checked=typeof d.useSourceVideo==='boolean'?d.useSourceVideo:(!refs.length&&!!d.sourceName);const savedMode=d.audioMode==='source'||d.audioMode==='original'||d.audioMode==='mix'?'source':'music';const savedAudioMode=$('input[name="audioMode"][value="'+savedMode+'"]');if(savedAudioMode)savedAudioMode.checked=true;syncSourceAudioControls();const timeline=(d.timeline||[]).map(x=>({start:Number(x.start)||0,end:Number(x.end)||0,ref:x.referenceName?S.refs.find(y=>y.file.name===x.referenceName):null,sourceStart:Number(x.sourceStart)||0,sourceDuration:Math.max(0,(Number(x.end)||0)-(Number(x.start)||0)),sourceLabel:d.sourceName||S.source?.name})).filter(x=>x.ref||sourceOk);if(!timeline.length){toast('В сохранённом проекте нет доступной монтажной шкалы.','warn');return;}S.plan={range:d.range||{start:0,duration:Math.max(...timeline.map(x=>x.end),1)},mode:d.mode||'inspired',aspect:d.aspect||'16:9',resolution:Number(d.resolution)||720,lines:d.lyrics||[],timeline};showPlan(S.plan);step(3);view('studio');$('#renderStatus').textContent='ГОТОВ К РЕНДЕРУ';$('#renderStatus').className='render-status';toast('Монтажный план открыт. Проверь его перед рендером.','success');}
function view(n){$$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+n));$$('.nav-item').forEach(x=>{const current=x.dataset.view===n;x.classList.toggle('active',current);if(current)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});$('#sidebar').classList.remove('open');$('#mobileMenu').setAttribute('aria-expanded','false');if(n==='library')library();if(n==='projects'){const grid=$('#projectsGrid');grid.innerHTML=S.projects.length?S.projects.map((p,i)=>'<article class="project-card"><div class="project-preview"><span>N.</span><small>'+esc(p.date)+'</small></div><div class="project-details"><b>'+esc(p.name)+'</b><small>'+esc(p.summary)+'</small><button class="btn btn-secondary btn-sm project-open" data-project-index="'+i+'">Открыть план</button></div></article>').join(''):'<div class="empty-card"><b>Проектов пока нет</b><p>Создай план монтажа, чтобы увидеть проект здесь.</p></div>';grid.querySelectorAll('[data-project-index]').forEach(b=>b.onclick=()=>openProject(S.projects[Number(b.dataset.projectIndex)]));}}
$$('.nav-item').forEach(x=>x.onclick=()=>view(x.dataset.view));
$('#cloudAccountBtn').onclick=openCloudDialog;
$('#cloudClose').onclick=()=>$('#cloudDialog').classList.add('hidden');
$('#cloudDialog').onclick=e=>{if(e.target.id==='cloudDialog')$('#cloudDialog').classList.add('hidden')};
$('#cloudForm').onsubmit=async e=>{e.preventDefault();if(cloudUser){cloudStatus('Ты уже вошёл.','success');return}if(!cloudConfigured){cloudStatus('Облако не настроено. Создай Supabase project, выполни backend/supabase-schema.sql и добавь VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY в GitHub Actions Variables.', 'error');return}const b=$('#cloudLogin');busy(b,true,'Входим…');try{const result=await cloudAuth('login',$('#cloudEmail').value.trim(),$('#cloudPassword').value);cloudUser=result.user;$('#cloudAccountLabel').textContent=cloudUser?.email||'Аккаунт';cloudStatus('Вход выполнен. Загружаю проекты…','success');await refreshCloudProjects();$('#cloudLogout').hidden=false;$('#cloudSignup').hidden=true;$('#cloudEmailLink').hidden=true;$('#cloudResetPassword').hidden=true;$('#cloudSupportWrap').classList.remove('hidden');b.hidden=true;}catch(err){cloudStatus(cloudErrorMessage(err,'login'),'error')}finally{busy(b,false)}};
$('#cloudEmailLink').onclick=async()=>{const email=$('#cloudEmail').value.trim();if(!$('#cloudEmail').checkValidity()){ $('#cloudEmail').reportValidity(); return; }if(!cloudConfigured){cloudStatus('Сначала настрой Supabase и SMTP по инструкции backend/BREVO-SETUP.md.','error');return;}const b=$('#cloudEmailLink');busy(b,true,'Отправляем код…');try{await cloudEmailLink(email);$('#cloudOtpEmail').value=email;$('#cloudOtpWrap').classList.remove('hidden');$('#cloudCredentials').classList.add('hidden');$('#cloudOtpCode').value='';$('#cloudOtpCode').focus();cloudStatus('Код отправлен на почту. Введи код из письма ниже. Если письмо не пришло, проверь «Спам» и настройки шаблона Email OTP в Supabase.','success');}catch(err){cloudStatus(cloudErrorMessage(err,'email'),'error')}finally{busy(b,false)}};
$('#cloudOtpBack').onclick=()=>{$('#cloudOtpWrap').classList.add('hidden');$('#cloudCredentials').classList.remove('hidden');cloudStatus('Можно войти с паролем или запросить новый код.');};
$('#cloudOtpVerify').onclick=async()=>{const email=$('#cloudOtpEmail').value.trim(),token=$('#cloudOtpCode').value.trim();if(!email||!token){cloudStatus('Введи почту и код из письма.','error');return;}const b=$('#cloudOtpVerify');busy(b,true,'Проверяем код…');try{const result=await cloudVerifyEmailCode(email,token);cloudUser=result.user;$('#cloudAccountLabel').textContent=cloudUser?.email||'Аккаунт';$('#cloudOtpWrap').classList.add('hidden');$('#cloudCredentials').classList.remove('hidden');$('#cloudLogout').hidden=false;$('#cloudSignup').hidden=true;$('#cloudLogin').hidden=true;$('#cloudEmailLink').hidden=true;$('#cloudResetPassword').hidden=true;$('#cloudSupportWrap').classList.remove('hidden');cloudStatus('Код подтверждён. Вход выполнен. Загружаю проекты…','success');await refreshCloudProjects();}catch(err){cloudStatus(cloudErrorMessage(err,'login')||'Код недействителен или истёк. Запроси новый код.','error')}finally{busy(b,false)}};
$('#cloudRecoverySave').onclick=async()=>{const p=$('#cloudRecoveryPassword').value,confirm=$('#cloudRecoveryConfirm').value;if(p.length<8){cloudStatus('Пароль должен содержать минимум 8 символов.','error');return;}if(p!==confirm){cloudStatus('Пароли не совпадают.','error');return;}if(!cloudConfigured){cloudStatus('Облако не настроено.','error');return;}const b=$('#cloudRecoverySave');busy(b,true,'Сохраняем…');try{await cloudUpdatePassword(p);$('#cloudRecoveryPassword').value='';$('#cloudRecoveryConfirm').value='';cloudStatus('Пароль обновлён. Теперь можно пользоваться NOVEX.','success');$('#cloudRecoveryWrap').classList.add('hidden');$('#cloudCredentials').classList.remove('hidden');$('#cloudPassword').value='';history.replaceState({},document.title,location.pathname);}catch(err){cloudStatus(cloudErrorMessage(err,'password'),'error')}finally{busy(b,false)}};$('#cloudResetPassword').onclick=async()=>{const email=$('#cloudEmail').value.trim();if(!$('#cloudEmail').checkValidity()){ $('#cloudEmail').reportValidity(); return; }if(!cloudConfigured){cloudStatus('Сброс пароля недоступен: сначала настрой Supabase и URL перенаправления.','error');return;}const b=$('#cloudResetPassword');busy(b,true,'Отправляем…');try{await cloudPasswordReset(email);cloudStatus('Если адрес зарегистрирован, письмо для сброса пароля отправлено. Проверь входящие и папку «Спам».','success');}catch(err){cloudStatus(cloudErrorMessage(err,'email'),'error')}finally{busy(b,false)}};$('#cloudSupportSend').onclick=async()=>{if(!cloudUser){cloudStatus('Сначала войди в аккаунт.','error');return;}const subject=$('#cloudSupportSubject').value.trim(),message=$('#cloudSupportMessage').value.trim();if(subject.length<3||subject.length>120||message.length<10||message.length>5000){cloudStatus('Укажи тему (3–120 символов) и сообщение (10–5000 символов).','error');return;}const b=$('#cloudSupportSend');busy(b,true,'Отправляем…');try{await cloudSendSupportMessage(subject,message);$('#cloudSupportSubject').value='';$('#cloudSupportMessage').value='';cloudStatus('Сообщение отправлено в поддержку NOVEX.','success');}catch(err){cloudStatus(err.message||'Не удалось отправить сообщение. Проверь настройку Brevo.','error')}finally{busy(b,false)}};
$('#cloudSignup').onclick=async()=>{if(!$('#cloudForm').reportValidity())return;if(!cloudConfigured){cloudStatus('Сначала настрой Supabase в GitHub Actions Variables.','error');return}const b=$('#cloudSignup');busy(b,true,'Создаём…');try{const result=await cloudAuth('signup',$('#cloudEmail').value.trim(),$('#cloudPassword').value);cloudUser=result.user;if(result.alreadyRegistered){cloudUser=null;cloudStatus('Аккаунт с этой почтой уже существует. Попробуй войти или восстановить пароль.','error');}else if(result.needsConfirmation){cloudStatus('Аккаунт создан. Проверь почту и подтверди адрес, затем войди.','success');cloudUser=null;}else{cloudStatus('Аккаунт создан и выполнен вход.','success');$('#cloudAccountLabel').textContent=cloudUser?.email||'Аккаунт';$('#cloudLogout').hidden=false;$('#cloudSignup').hidden=true;$('#cloudLogin').hidden=true;$('#cloudEmailLink').hidden=true;$('#cloudSupportWrap').classList.remove('hidden');await refreshCloudProjects();}}catch(err){cloudStatus(cloudErrorMessage(err,'signup'),'error')}finally{busy(b,false)}};
$('#cloudLogout').onclick=async()=>{try{await cloudAuth('logout');cloudUser=null;$('#cloudAccountLabel').textContent='Профиль';S.projects=loadLocalProjects();stats();if($('#view-projects').classList.contains('active'))view('projects');cloudStatus('Ты вышел из аккаунта.','success');$('#cloudLogout').hidden=true;$('#cloudSignup').hidden=false;$('#cloudLogin').hidden=false;$('#cloudEmailLink').hidden=false;$('#cloudResetPassword').hidden=false;$('#cloudSupportWrap').classList.add('hidden');}catch(err){cloudStatus(err.message,'error')}};
if(cloudConfigured){cloudSession().then(({user})=>{cloudUser=user;if(user){$('#cloudAccountLabel').textContent=user.email||'Аккаунт';refreshCloudProjects();}if(recoveryMode())openCloudDialog();}).catch(()=>{if(recoveryMode())openCloudDialog()});}else if(recoveryMode())openCloudDialog();
$('#mobileMenu').onclick=()=>{const open=$('#sidebar').classList.toggle('open');$('#mobileMenu').setAttribute('aria-expanded',String(open));};
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#sidebar').classList.contains('open')){$('#sidebar').classList.remove('open');$('#mobileMenu').setAttribute('aria-expanded','false');$('#mobileMenu').focus();}});
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
