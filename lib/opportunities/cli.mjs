import { getCareerOpsRoot } from '../../path-resolver.mjs';
import { listOpportunities, scanOpportunities, setOpportunityStatus } from './service.mjs';
const [command='list',id,status]=process.argv.slice(2);
try {
 const root=getCareerOpsRoot();
 let result;
 if(command==='list')result=listOpportunities(root);
 else if(command==='scan')result=await scanOpportunities(root,{force:id==='--force'});
 else if(command==='status'){await setOpportunityStatus(root,id,status);result={ok:true};}
 else throw new Error('Commande invalide');
 console.log(JSON.stringify(result));
}catch(e){console.error(e.message);process.exitCode=1;}
