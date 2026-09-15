import fs from 'node:fs';
import { asciiFold } from '../ascii-fold.mjs';
const reference = JSON.parse(fs.readFileSync(new URL('./communes.json', import.meta.url), 'utf8'));
const communes = reference.communes.map(c => ({...c, key: asciiFold(c.nom)})).sort((a,b) => b.key.length-a.key.length);
const departments = { 'paris':'75', 'hauts de seine':'92', 'seine saint denis':'93', 'val de marne':'94' };
const foreign = /\b(texas|united states|usa|canada|ontario|germany|german|belgium|belgique|london|united kingdom)\b/;
export function locate(job, allowed = ['75','92','93','94']) {
  const country = asciiFold(job.country || '');
  const text = asciiFold(job.location || job.city || '');
  const unknown = (reason) => ({city:job.city || job.location || '', department:null, eligible:false, certainty:'unknown', reason});
  if ((country && !['fr','fra','france'].includes(country)) || foreign.test(text)) return {...unknown('Pays hors cible'),certainty:'outside'};
  const postals = [...text.matchAll(/\b(\d{5})\b/g)].map(m=>m[1]);
  if(new Set(postals.map(p=>p.slice(0,2))).size>1) return unknown('Plusieurs lieux de rattachement : à préciser');
  const postal = String(job.postalCode || '').match(/^\d{5}$/)?.[0] || text.match(/\b(\d{5})\b/)?.[1];
  const explicit = String(job.department || '') || postal?.slice(0,2) || text.match(/\b(75|92|93|94)\b/)?.[1];
  if (explicit && !allowed.includes(explicit)) return {...unknown('Département hors cible'),department:explicit,certainty:'outside'};
  // Use the dedicated city first. Never infer a job site from its employer HQ or description.
  let haystack = ` ${asciiFold(job.city || job.location || '')} `;
  if (/\b(aeroport|airport|roissy|cdg|orly airport)\b/.test(text) && !explicit) return unknown('Site aéroportuaire à préciser');
  if (/\b(region parisienne|ile de france|grand paris|paris region|paris area)\b/.test(text) && !job.city && !explicit) return unknown('Île-de-France ne garantit pas Paris ou la petite couronne');
  let match = communes.find(c => haystack.includes(` ${c.key} `));
  if (!match && /\bparis(?:\s|$)/.test(haystack)) match = communes.find(c => c.code === '75056');
  if (!match && /\bla defense\b/.test(haystack)) return {city:'La Défense',department:'92',eligible:allowed.includes('92'),certainty:'confirmed',reason:'La Défense (92)'};
  if (match && explicit && match.codeDepartement !== explicit) return unknown('Ville et département contradictoires');
  const dep = explicit || match?.codeDepartement || Object.entries(departments).find(([name])=>haystack.includes(` ${name} `))?.[1];
  if (!dep) return unknown('Ville ou département non confirmé');
  return {city:match?.nom || job.city || job.location,department:dep,eligible:allowed.includes(dep),certainty:allowed.includes(dep)?'confirmed':'outside',reason:`${match?.nom || job.location} (${dep})`};
}
export const geoReference = {source:reference.source,retrievedAt:reference.retrievedAt,count:communes.length};
