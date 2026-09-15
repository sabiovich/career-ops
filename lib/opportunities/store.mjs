import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { withPipelineLock } from '../../pipeline-lock.mjs';
export const statuses=['Nouveau','À analyser','Intéressant','À postuler','Candidature envoyée','Entretien','Refus','Archivé'];
export const storePath = root => path.join(root,'data','opportunities.md');
export function readStore(root) {
 let text;
 try{text=fs.readFileSync(storePath(root),'utf8');}catch(e){if(e.code==='ENOENT')return {schema:1,jobs:[],lastRun:null};throw e;}
 const match=text.match(/```json\n([\s\S]*?)\n```/);
 if(!match)throw new Error('Fichier opportunities.md invalide : données conservées, réparation nécessaire');
 const data=JSON.parse(match[1]);
 if(data.schema!==1||!Array.isArray(data.jobs))throw new Error('Schéma des opportunités invalide');
 return data;
}
export async function updateStore(root,fn) {
 const file=storePath(root);
 return withPipelineLock(file,async()=>{
  const data=await fn(readStore(root));
  const text='# Opportunités — Career-Ops\n\nDonnées canoniques de la présélection, indépendantes du tracker de candidatures.\nLes descriptions et preuves restent archivées ici.\n\n```json\n'+JSON.stringify(data,null,2)+'\n```\n';
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+randomUUID();
  try {fs.writeFileSync(tmp,text,{mode:0o600});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
  return data;
 });
}
export async function setOpportunityStatus(root,id,status) {
 if(!statuses.includes(status))throw new Error('Statut invalide');
 return updateStore(root,data=>{
  const job=data.jobs.find(j=>j.id===id);if(!job)throw new Error('Offre inconnue');
  job.status=status;return data;
 });
}
