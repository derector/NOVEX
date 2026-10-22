const CACHE='novex-shell-v2';
const SHELL=['/','/manifest.webmanifest','/novex.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  const isAppAsset=/\.(?:js|css|wasm)$/.test(url.pathname)||url.pathname.includes('/ffmpeg/');
  if(isAppAsset){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));
      return response;
    }).catch(()=>caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{
    if(response.ok&&request.destination!=='video')caches.open(CACHE).then(cache=>cache.put(request,response.clone()));
    return response;
  }).catch(()=>caches.match('/'))));
});