import {createHash,timingSafeEqual} from 'node:crypto';
import {isLoopbackHost} from './origin-guard.mjs';
const hash=s=>createHash('sha256').update(s).digest();
export function checkPersonalAccess({authorization,host,password,enabled=false}) {
 if(!enabled)return {ok:true};
 if(!password)return isLoopbackHost(host)?{ok:true}:{ok:false,status:503,reason:'Accès privé non configuré.'};
 let decoded='';
 try {if(authorization?.startsWith('Basic '))decoded=Buffer.from(authorization.slice(6),'base64').toString('utf8');}catch{}
 return timingSafeEqual(hash(decoded),hash(`career-ops:${password}`))?{ok:true}:{ok:false,status:401,reason:'Connexion requise.'};
}
