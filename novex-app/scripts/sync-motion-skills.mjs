import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd(),cache=path.join(root,'.cache','motion-skills');
const sources=[
 {repo:'jakubkrehel/skills',branch:'main',requireSkill:true,include:['LICENSE','AGENTS.md','skills/better-interface/SKILL.md','skills/better-ui/SKILL.md','skills/better-accessibility/SKILL.md','skills/better-layout/SKILL.md','skills/better-typography/SKILL.md','skills/better-colors/SKILL.md','skills/better-writing/SKILL.md']},
 {repo:'kaankiziltug/logo-design-skill',branch:'main',requireSkill:false,include:['LICENSE','README.md','TRADEMARKS.md']}
];
const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
await mkdir(cache,{recursive:true});
const manifest={generatedAt:new Date().toISOString(),policy:'Markdown references only; downloaded repository code is never executed.',sources:[]};
for(const source of sources){
 console.log('Fetching approved reference repository '+source.repo);
 const [commitResponse,treeResponse]=await Promise.all([
  fetch('https://api.github.com/repos/'+source.repo+'/commits/'+source.branch,{headers}),
  fetch('https://api.github.com/repos/'+source.repo+'/git/trees/'+source.branch+'?recursive=1',{headers})
 ]);
 if(!commitResponse.ok)throw new Error('GitHub commit lookup failed for '+source.repo+': HTTP '+commitResponse.status);
 if(!treeResponse.ok)throw new Error('GitHub tree lookup failed for '+source.repo+': HTTP '+treeResponse.status);
 const commitData=await commitResponse.json(),treeData=await treeResponse.json();
 const available=new Set((treeData.tree||[]).filter(x=>x.type==='blob').map(x=>x.path));
 const name=source.repo.replace('/','--'),included=[];
 for(const rel of source.include){
  if(!available.has(rel))continue;
  const response=await fetch('https://raw.githubusercontent.com/'+source.repo+'/'+commitData.sha+'/'+rel);
  if(!response.ok)throw new Error('Failed to download '+source.repo+'/'+rel+': HTTP '+response.status);
  const body=await response.text();
  if(body.length>250000)throw new Error('Reference file unexpectedly large: '+rel);
  const target=path.join(cache,'references',name,rel);
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,body,'utf8');included.push(rel);
 }
 if(source.requireSkill&&!included.some(file=>file.endsWith('SKILL.md')))throw new Error('No selected SKILL.md files found in '+source.repo);
 manifest.sources.push({repo:source.repo,branch:source.branch,commit:commitData.sha,files:included});
 console.log(source.repo+': '+commitData.sha+' ('+included.length+' reference files)');
}
await writeFile(path.join(cache,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Motion skill cache ready: '+path.relative(root,cache));
