import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const cache=path.join(root,'.cache','motion-skills','references','engine-repositories');
const apiHeaders={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'NOVEX-Motion-Reference-Sync'};
export const DEFAULT_REPOSITORIES=[
  'motion-canvas/motion-canvas',
  'remotion-dev/remotion',
  'pmndrs/react-three-fiber'
];
const rawRepos=(process.env.NOVEX_ENGINE_REPOS||DEFAULT_REPOSITORIES.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
const repositories=[...new Set(rawRepos)];
if(!repositories.length||repositories.length>8)throw new Error('NOVEX_ENGINE_REPOS must contain between 1 and 8 approved repositories.');
const approved=new Set(DEFAULT_REPOSITORIES);
for(const repo of repositories){
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||!approved.has(repo)){
    throw new Error('Repository is not on the NOVEX engine-reference allowlist: '+repo);
  }
}
async function getJson(url){
  const response=await fetch(url,{headers:apiHeaders,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('GitHub API '+response.status+' for '+url);
  return response.json();
}
function chooseSourceFiles(tree){
  const excluded=/(^|\/)(test|tests|__tests__|fixtures|fixture|node_modules|dist|build|website|docs|examples|example|playground|\.github)(\/|$)/i;
  const relevant=/(animation|transition|timeline|keyframe|easing|renderer|camera|scene|sequence|audio|video|composit|motion|interpolat)/i;
  return tree.filter(item=>item.type==='blob'&&
    /\.(?:ts|tsx|js|mjs|md)$/.test(item.path)&&
    !excluded.test(item.path)&&relevant.test(item.path)&&
    !/(^|\/)(readme|changelog|contributing|code_of_conduct)\.md$/i.test(item.path))
    .sort((a,b)=>score(b.path)-score(a.path)||a.path.localeCompare(b.path))
    .slice(0,10);
}
function score(file){
  return (/animation|timeline|transition|keyframe|easing|interpolat/i.test(file)?4:0)+
    (/renderer|composit|scene|camera|sequence/i.test(file)?2:0)+
    (/\.(?:ts|tsx|js|mjs)$/.test(file)?1:0);
}
async function getText(url,max=65000){
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Reference download HTTP '+response.status+' for '+url);
  const body=await response.text();
  if(body.length>max)throw new Error('Reference file exceeds '+max+' characters: '+url);
  return body;
}
await mkdir(cache,{recursive:true});
const manifestPath=path.join(root,'.cache','motion-skills','engine-repositories.json');
const manifest={generatedAt:new Date().toISOString(),policy:'Reference-only source snapshots. Never execute downloaded code; retain repository, commit, path and license provenance.',repositories:[]};
for(const fullName of repositories){
  console.log('Inspecting engine reference '+fullName);
  const meta=await getJson('https://api.github.com/repos/'+fullName);
  if(meta.private||meta.archived)throw new Error('Repository must be public and active: '+fullName);
  const branch=meta.default_branch;
  const [commit,treeData]=await Promise.all([
    getJson('https://api.github.com/repos/'+fullName+'/commits/'+encodeURIComponent(branch)),
    getJson('https://api.github.com/repos/'+fullName+'/git/trees/'+encodeURIComponent(branch)+'?recursive=1')
  ]);
  if(treeData.truncated)console.warn('GitHub returned a truncated tree for '+fullName+'; selected references may be incomplete.');
  const tree=treeData.tree||[];
  const name=fullName.replace('/','--');
  const folder=path.join(cache,name);
  await mkdir(folder,{recursive:true});
  const selected=new Map();
  for(const pathName of ['README.md','LICENSE','LICENSE.md','LICENSE.txt']){
    if(tree.some(x=>x.type==='blob'&&x.path===pathName))selected.set(pathName,'required');
  }
  for(const item of chooseSourceFiles(tree))selected.set(item.path,'source');
  const files=[];
  for(const [rel,kind] of selected){
    const item=tree.find(x=>x.type==='blob'&&x.path===rel);
    if(!item||item.size>65000)continue;
    const url='https://raw.githubusercontent.com/'+fullName+'/'+commit.sha+'/'+rel;
    const body=await getText(url,65000);
    const target=path.join(folder,rel);
    await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,body,'utf8');
    files.push({path:rel,kind,bytes:Buffer.byteLength(body),url,sha:item.sha});
  }
  if(!files.some(f=>/^LICENSE(?:\.md|\.txt)?$/.test(f.path))){
    console.warn('No root LICENSE file found for '+fullName+'; inspect the upstream license before reusing code.');
  }
  manifest.repositories.push({
    repository:fullName,url:meta.html_url,description:meta.description||'',defaultBranch:branch,
    commit:commit.sha,commitUrl:commit.html_url,license:meta.license?.spdx_id||'NOASSERTION',
    licenseUrl:meta.license?.url||null,stars:meta.stargazers_count,files
  });
  console.log(fullName+': '+commit.sha+'; '+files.length+' bounded reference files; license '+(meta.license?.spdx_id||'unknown'));
}
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Engine reference cache updated: '+path.relative(root,manifestPath));
