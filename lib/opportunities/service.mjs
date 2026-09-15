import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { loadProviders, resolveProvider } from '../../providers/_registry.mjs';
import { makeHttpCtx, fetchJsonWithRetry } from '../../providers/_http.mjs';
import { withPipelineLock } from '../../pipeline-lock.mjs';
import { getCareerOpsRoot } from '../../path-resolver.mjs';
import { analyze } from './analyze.mjs';
import { locate } from './geo.mjs';
import { deduplicate, identity } from './dedup.mjs';
import { readStore, updateStore, setOpportunityStatus } from './store.mjs';
import { semanticAnalysis, semanticKey } from './semantic.mjs';
export {setOpportunityStatus};
const reliableContext = () => { const base = makeHttpCtx(); return {...base, fetchJson:(url,opts={})=>fetchJsonWithRetry(base,url,{...opts,timeoutMs:25000},{retries:1,baseDelayMs:500})}; };
const codeRoot=path.resolve(import.meta.dirname,'../..');
function readYaml(file){const data=yaml.load(fs.readFileSync(file,'utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error(`Configuration invalide : ${path.basename(file)}`);return data;}
export function settings(root=getCareerOpsRoot()) {
 const config=readYaml(path.join(root,'config/profile.yml')).opportunities;
 if(!config?.enabled)throw new Error('Recherche ciblée non configurée');
 if(!Array.isArray(config.departments)||!config.departments.length)throw new Error('Départements non configurés');
 const w=config.weights;
 if(!w||['domain','missions','employer','location','quality'].some(k=>!Number.isFinite(w[k])||w[k]<0)||Object.values(w).reduce((a,b)=>a+b,0)!==100)throw new Error('Le barème doit totaliser 100 points');
 if(!Number.isFinite(config.maxAgeDays)||config.maxAgeDays<1||!Number.isFinite(config.refreshHours)||config.refreshHours<1)throw new Error('Délais de fraîcheur invalides');
 return config;
}
export function listOpportunities(root=getCareerOpsRoot(), now=Date.now()) {
 const config=settings(root),data=readStore(root);
 const jobs=data.jobs.map(j=>{const checked=Date.parse(j.lastVerifiedAt||'');const current={...j,availability:Number.isFinite(checked)&&now-checked>config.refreshHours*7200000?'unconfirmed':j.availability};return {...current,analysis:analyze(current,config,now)};});
 return {...data,jobs,aiAvailable:!!(config.aiEnabled&&process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL),departments:config.departments};
}
export async function scanOpportunities(root=getCareerOpsRoot(),{ctx=reliableContext(),providers:injected,force=false,now=Date.now(),semantic=semanticAnalysis}={}) {
 const config=settings(root);
 return withPipelineLock(path.join(root,'data','opportunities-scan'),async()=>{
  const old=readStore(root);
  if(!force&&old.lastRun?.status==='ok'&&old.lastRun?.finishedAt&&now-Date.parse(old.lastRun.finishedAt)<config.refreshHours*3600000)return listOpportunities(root,now);
  const portals=readYaml(process.env.CAREER_OPS_PORTALS||path.join(root,'portals.yml'));
  const entries=[...(portals.tracked_companies||[]),...(portals.job_boards||[])].filter(e=>e.enabled!==false);
  if(!entries.length)throw new Error('Aucune source configurée');
  const registry=injected||await loadProviders(path.join(codeRoot,'providers'));
  const collected=[],sources=[];let aiCalls=0;
  for(const entry of entries){
   const source=entry.name;
   try{
    const resolved=resolveProvider(entry,registry,{skipIds:['local-parser']});
    if(!resolved?.provider||resolved.error||resolved.provider.id==='local-parser')throw new Error(resolved?.error||'Provider public non disponible');
    const jobs=await resolved.provider.fetch(entry,{...ctx,shouldEnrich:j=>locate(j,config.departments).eligible});
    if(!Array.isArray(jobs))throw new Error('Réponse source invalide');
    let targetCount=0,described=0;
    for(const input of jobs){
     if(!input.title||!input.url||!/^https:\/\//.test(input.url))continue;
     const prior=old.jobs.find(j=>j.id===identity(input));
     // Preserve captures after removal; a failed detail lookup is not evidence of expiry.
     const job={...input,id:identity(input),source,provider:resolved.provider.id,fetchedAt:new Date(now).toISOString(),firstSeenAt:prior?.firstSeenAt||new Date(now).toISOString(),lastVerifiedAt:new Date(now).toISOString(),availability:'listed',status:prior?.status||'Nouveau'};
     if(locate(job,config.departments).eligible){
      targetCount++;
      if(job.description)described++;
      // Prior text is retained as an archive, explicitly marked if no new detail was available.
      if(!job.description&&prior?.description){job.description=prior.description;job.missionsDescription=prior.missionsDescription;job.availability='unconfirmed';}
      job.semantic=prior?.semantic?.key===semanticKey(job,config,process.env.OPENAI_MODEL)?prior.semantic:null;
      if(config.aiEnabled && !job.semantic && job.description && aiCalls<Math.min(50,config.aiLimit||15)){
       aiCalls++;
       try{job.semantic=await semantic(job,config);}catch{job.semantic=null;job.semanticError='Analyse IA indisponible : règles contextuelles utilisées';}
      }
      else if(!config.aiEnabled)job.semantic=null;
     }
     collected.push(job);
    }
    sources.push({name:source,status:'ok',fetched:jobs.length,inZone:targetCount,described,coverage:targetCount>described?'Descriptions partielles':'Collecte terminée'});
   }catch(error){sources.push({name:source,status:'error',message:error.message,fetched:0});}
  }
  const successful=new Set(sources.filter(s=>s.status==='ok').map(s=>s.name));
  const freshIds=new Set(collected.map(j=>j.id));
  const previous=old.jobs.filter(j=>!freshIds.has(j.id)).map(j=>({...j,availability:successful.has(j.source)?'unconfirmed':j.availability}));
  // Omitted from an API list may mean pagination/cap: never label expired based on absence alone.
  const jobs=deduplicate([...collected,...previous]);
  const lastRun={finishedAt:new Date(now).toISOString(),sources,aiCalls,status:successful.size===0?'error':successful.size<entries.length?'partial':'ok',total:collected.length};
  await updateStore(root,current=>({schema:1,lastRun,jobs:jobs.map(j=>({...j,status:current.jobs.find(p=>p.id===j.id)?.status||j.status,analysis:analyze(j,config,now),lastScoredAt:new Date(now).toISOString()}))}));
  return listOpportunities(root,now);
 });
}
