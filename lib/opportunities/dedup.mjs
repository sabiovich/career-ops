import { createHash } from 'node:crypto';
import { normalizeUrl } from '../../url-key.mjs';
import { asciiFold } from '../ascii-fold.mjs';
export const identity = job => createHash('sha256').update(normalizeUrl(job.url)).digest('hex').slice(0,20);
const key = x => asciiFold(x).replace(/\b(h f|f h|m f d|f m d|cdi|cdd)\b/g,'').replace(/\s+/g,' ').trim();
function similar(a,b) {
 const words=x=>new Set(key(x).split(' ').filter(w=>w.length>2));
 const x=words(a),y=words(b); if(x.size<30||y.size<30)return false;
 const overlap=[...x].filter(w=>y.has(w)).length;
 return overlap/(x.size+y.size-overlap)>=0.85;
}
export function duplicates(a,b) {
 if(normalizeUrl(a.url)===normalizeUrl(b.url))return true;
 if(!key(a.company)||key(a.company)!==key(b.company))return false;
 if(a.source===b.source&&a.externalId&&b.externalId) return a.externalId===b.externalId;
 if(a.requisitionId&&b.requisitionId&&a.requisitionId!==b.requisitionId)return false;
 return key(a.title)===key(b.title)&&key(a.city||a.location)===key(b.city||b.location)&&similar(a.description,b.description);
}
export function deduplicate(jobs) {
 const result=[];
 for(const input of jobs) {
  const job={...input,id:input.id||identity(input),alternatives:[...(input.alternatives||[])]};
  const match=result.find(j=>duplicates(j,job));
  if(!match){result.push(job);continue;}
  const urls=new Map([...match.alternatives,{url:job.url,source:job.source},...job.alternatives].map(x=>[x.url,x]));
  urls.delete(match.url);match.alternatives=[...urls.values()];
  if((job.description||'').length>(match.description||'').length){match.description=job.description;match.missionsDescription=job.missionsDescription;}
 }
 return result;
}
