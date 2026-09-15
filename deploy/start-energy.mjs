import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {scanOpportunities} from '../lib/opportunities/service.mjs';
const code=path.resolve(import.meta.dirname,'..');
const root=process.env.CAREER_OPS_ROOT||path.join(code,'user');
fs.mkdirSync(path.join(root,'config'),{recursive:true});fs.mkdirSync(path.join(root,'modes'),{recursive:true});
for(const [src,dest] of [['profile.yml','config/profile.yml'],['portals.yml','portals.yml'],['profile.md','modes/_profile.md']]){
 const target=path.join(root,dest);
 if(!fs.existsSync(target))fs.copyFileSync(path.join(code,'examples/energy',src),target,fs.constants.COPYFILE_EXCL);
}
process.env.CAREER_OPS_ROOT=root;
process.env.CAREER_OPS_CODE_ROOT=code;
process.env.CAREER_OPS_PERSONAL_WEB='true';
const domain=process.env.RAILWAY_PUBLIC_DOMAIN||process.env.RENDER_EXTERNAL_HOSTNAME;
if(domain)process.env.CAREER_OPS_WEB_ALLOWED_HOSTS=domain;
if(domain&&!process.env.CAREER_OPS_WEB_PASSWORD)throw new Error('Configurer CAREER_OPS_WEB_PASSWORD avant la mise en ligne');
let scanning=false;
const scan=async()=>{if(scanning)return;scanning=true;try{const d=await scanOpportunities(root);console.log('Collecte :',d.lastRun?.status);}catch(e){console.error('Collecte indisponible :',e.message);}finally{scanning=false;}};
const server=spawn(process.execPath,[path.join(code,'web/node_modules/next/dist/bin/next'),'start','--hostname','0.0.0.0','--port',process.env.PORT||'3000'],{cwd:path.join(code,'web'),env:process.env,stdio:'inherit'});
const timer=setInterval(scan,60*60*1000);void scan();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(timer);server.kill(signal);});
server.on('exit',code=>{clearInterval(timer);process.exit(code||0);});
