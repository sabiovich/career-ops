import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import {pass,fail,ROOT} from './helpers.mjs';
import {locate} from '../lib/opportunities/geo.mjs';
import {analyze,category,employer} from '../lib/opportunities/analyze.mjs';
import {deduplicate,duplicates} from '../lib/opportunities/dedup.mjs';
import {validateSemantic} from '../lib/opportunities/semantic.mjs';
import {scanOpportunities,listOpportunities} from '../lib/opportunities/service.mjs';
import {readStore,setOpportunityStatus} from '../lib/opportunities/store.mjs';
import provider,{parseSmartRecruitersResponse} from '../providers/smartrecruiters.mjs';
const config=yaml.load(fs.readFileSync(path.join(ROOT,'examples/energy/profile.yml'),'utf8')).opportunities;
const now=Date.parse('2026-09-15T12:00:00Z');
const description='Au sein de notre site industriel, vous pilotez les projets de performance énergétique. Vous analysez les consommations et les indicateurs énergie pour nos installations. Vous optimisez les utilités : vapeur, froid, air comprimé. Vous proposez des plans de comptage ISO 50001. Vous déployez des projets de récupération de chaleur et des actions de réduction des consommations. Vous travaillez avec notre équipe interne méthodes et amélioration continue. Formation et autonomie sur les projets de performance industrielle.';
const job={title:'Ingénieur performance énergétique',company:'Veolia',location:'Paris 15e, France',city:'Paris',country:'fr',url:'https://jobs.example.org/1',description,postedAt:'2026-09-12',source:'A',availability:'listed'};
async function check(name,fn){try{await fn();pass('opportunities: '+name);}catch(e){fail('opportunities: '+name+' — '+e.message);}}
for(const [city,dep] of [['Paris 15e','75'],['Nanterre','92'],['Saint-Denis','93'],['Créteil','94'],['L’Haÿ-les-Roses','94'],['Issy-les-Moulineaux','92'],['Villeneuve-la-Garenne','92'],['La Défense','92']]) await check(city,()=>assert.equal(locate({location:city}).department,dep));
for(const location of ['Paris, Texas','Paris, Canada','Île-de-France','Grand Paris','Paris region','Roissy CDG','Lyon 69003','Versailles 78000','Remote France','Paris 75000 / Lyon 69000'])await check('exclusion/ambiguïté '+location,()=>assert.equal(locate({location}).eligible,false));
await check('département explicite hors zone domine Paris',()=>assert.equal(locate({location:'Paris',department:'78'}).eligible,false));
await check('ville et code postal contradictoires',()=>assert.equal(locate({city:'Nanterre',postalCode:'75015'}).eligible,false));
await check('description siège Paris ne déplace pas le poste',()=>assert.equal(locate({location:'Lyon',description:'Notre siège est à Paris'}).eligible,false));
await check('employeur final',()=>assert.equal(employer(job,config).kind,'direct'));
for(const description of ['Nous sommes un cabinet de recrutement. Notre client industriel recherche un ingénieur énergie.','Notre société de conseil vous propose des missions chez nos clients.','Nous recrutons pour notre client, un industriel de l’énergie.'])await check('détection intermédiaire '+description.slice(0,30),()=>assert.equal(employer({...job,company:'Inconnu',description},config).kind,'intermediary'));
await check('conseil interne autorisé',()=>assert.equal(employer({...job,title:'Ingénieur expertise',description:'Notre équipe interne apporte du conseil à nos sites industriels pour leur efficacité énergétique.'},config).kind,'direct'));
await check('consultant multi-clients rejeté même employeur connu',()=>assert.equal(analyze({...job,title:'Ingénieur consultant',description:description+' Missions chez plusieurs clients.'},config,now).category,'REJETÉE'));
await check('un mot clients ne suffit pas',()=>assert.equal(employer({...job,description:description+' Vous répondez aux questions de nos clients sur nos installations.'},config).kind,'direct'));
await check('excellent score et somme',()=>{const a=analyze(job,config,now);assert.ok(a.score>=85);assert.equal(a.score,Object.values(a.parts).reduce((a,b)=>a+b,0));assert.equal(a.verdict,'POSTULER');});
await check('méthodes sans énergie dans le titre',()=>assert.ok(analyze({...job,title:'Ingénieur méthodes'},config,now).score>=85));
await check('boilerplate énergie séparé des missions',()=>assert.equal(analyze({...job,title:'Comptable',missionsDescription:'Comptabilité fournisseurs, rapprochements bancaires et clôtures mensuelles. '.repeat(5)},config,now).category,'REJETÉE'));
await check('commercial pur exclu',()=>assert.equal(analyze({...job,title:'Ingénieur commercial énergie'},config,now).category,'REJETÉE'));
await check('description vide plafonnée',()=>{const a=analyze({...job,description:''},config,now);assert.ok(a.score<=69);assert.equal(a.recommended,false);});
await check('employeur inconnu ne reçoit pas les 20 points',()=>{const a=analyze({...job,company:'Inconnu',description:description.replace(/notre site industriel|notre equipe interne|notre équipe interne|nos installations/g,'le périmètre')},config,now);assert.equal(a.employer.kind,'unknown');assert.equal(a.recommended,false);});
await check('rattachement inconnu même hybride',()=>{const a=analyze({...job,city:'',location:'Île-de-France',workMode:'Hybride'},config,now);assert.equal(a.recommended,false);});
await check('date inconnue non inventée',()=>{const a=analyze({...job,postedAt:null},config,now);assert.equal(a.days,null);assert.ok(a.alerts.includes('Date de publication inconnue'));});
await check('offre ancienne masquée',()=>assert.equal(analyze({...job,postedAt:'2025-01-01'},config,now).recommended,false));
await check('offre expirée rejetée',()=>assert.equal(analyze({...job,availability:'expired'},config,now).category,'REJETÉE'));
await check('page non confirmée pas recommandée',()=>assert.equal(analyze({...job,availability:'unconfirmed'},config,now).recommended,false));
await check('bornes catégories',()=>assert.deepEqual([54,55,69,70,84,85,100].map(v=>category(v)),['FAIBLE PERTINENCE','À ÉTUDIER','À ÉTUDIER','BONNE CIBLE','BONNE CIBLE','EXCELLENTE CIBLE','EXCELLENTE CIBLE']));
await check('URL tracking dédupliquée',()=>assert.equal(deduplicate([job,{...job,url:job.url+'?utm_source=board'}]).length,1));
await check('duplication multi-source et description',()=>assert.equal(deduplicate([job,{...job,url:'https://other.example.org/x',source:'B'}]).length,1));
await check('deux villes distinctes conservées',()=>assert.equal(deduplicate([job,{...job,city:'Nanterre',location:'Nanterre',url:'https://jobs.example.org/2'}]).length,2));
await check('réquisitions distinctes conservées',()=>assert.equal(duplicates({...job,requisitionId:'REF1'},{...job,url:'https://other.example.org/2',requisitionId:'REF2'}),false));
await check('description trop courte ne suffit pas',()=>assert.equal(deduplicate([{...job,description:'court'},{...job,description:'court',url:'https://other.example.org/2'}]).length,2));
await check('preuve IA inventée éliminée',()=>assert.equal(validateSemantic({relevant:true,employer:'direct',energyQuotes:['Preuve absente de l’offre'],employerQuotes:[]},job).relevant,false));
await check('preuve IA présente conservée',()=>assert.equal(validateSemantic({relevant:true,employer:'unknown',energyQuotes:['vous pilotez les projets de performance énergétique'],employerQuotes:[]},job).relevant,true));
await check('provider conserve métadonnées',()=>{const [j]=parseSmartRecruitersResponse({content:[{id:'1',name:'Énergie',releasedDate:'2026-09-12',refNumber:'REF1',location:{city:'Nanterre',country:'fr',hybrid:true},typeOfEmployment:{label:'CDI'}}]},'X');assert.equal(j.externalId,'1');assert.equal(j.workMode,'Hybride');assert.equal(j.contract,'CDI');assert.ok(j.postedAt);});
await check('enrichissement après géographie avant budget',async()=>{
 let detailCalls=0;
 const out=await provider.fetch({name:'X',careers_url:'https://careers.smartrecruiters.com/x',smartrecruiters:{fetchDetails:true,detailLimit:1,country:'fr'}},{shouldEnrich:j=>locate(j).eligible,fetchJson:async url=>{
  if(url.includes('?')){assert.ok(url.includes('country=fr'));return {content:[{id:'1',name:'Job',location:{city:'Lyon',country:'fr'}},{id:'2',name:'Job',location:{city:'Paris',country:'fr'}}]};}
  detailCalls++;assert.ok(url.endsWith('/2'));return {jobAd:{sections:{jobDescription:{text:description},companyDescription:{text:'Employeur'}}}};
 }});assert.equal(detailCalls,1);assert.ok(out[1].missionsDescription);assert.equal(out[0].description,undefined);
});
await check('collecte / persistance / statut / panne / refroidissement',async()=>{
 const root=fs.mkdtempSync(path.join(ROOT,'.tmp-opportunities-'));
 try{
 fs.mkdirSync(path.join(root,'config'));fs.copyFileSync(path.join(ROOT,'examples/energy/profile.yml'),path.join(root,'config/profile.yml'));fs.writeFileSync(path.join(root,'portals.yml'),'tracked_companies:\n  - name: Veolia\n    provider: stub\n');
 let calls=0;const providers=new Map([['stub',{id:'stub',fetch:async()=>{calls++;return [job];}}]]);
 const data=await scanOpportunities(root,{providers,now,force:true});assert.equal(data.jobs.length,1);assert.equal(data.jobs[0].analysis.verdict,'POSTULER');
 await setOpportunityStatus(root,data.jobs[0].id,'À postuler');
 await scanOpportunities(root,{providers,now:now+1000});assert.equal(calls,1);assert.equal(readStore(root).jobs[0].status,'À postuler');
 providers.get('stub').fetch=async()=>{throw Error('Source indisponible');};
 const failure=await scanOpportunities(root,{providers,now:now+2000,force:true});assert.equal(failure.jobs.length,1);assert.equal(failure.lastRun.status,'error');assert.equal(failure.jobs[0].status,'À postuler');
 await assert.rejects(setOpportunityStatus(root,data.jobs[0].id,'inventé'));
 fs.writeFileSync(path.join(root,'data/opportunities.md'),'Corrompu');assert.throws(()=>readStore(root));assert.throws(()=>listOpportunities(root));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
await check('expérience utilities seule ne rend pas les missions énergétiques',()=>{
 const text='Vous gérez les contrats de location et le portefeuille immobilier de notre groupe. Vous pilotez les négociations et les projets immobiliers internes. Une expérience dans le secteur utilities et energy management serait un atout pour votre candidature.';
 assert.equal(analyze({...job,title:'Senior Real Estate Manager',description:text},config,now).category,'REJETÉE');
});
await check('technicien assainissement hors cible ingénieur',()=>assert.equal(analyze({...job,title:'Technicien assainissement'},config,now).category,'REJETÉE'));
