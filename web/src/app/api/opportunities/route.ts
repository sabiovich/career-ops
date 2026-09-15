import { opportunityCommand } from '@/lib/core/opportunities';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET() {
 try {return Response.json(await opportunityCommand(['list']));}
 catch {return Response.json({error:'Lecture impossible. Vérifiez la configuration et le fichier des offres.'},{status:500});}
}
export async function POST() {
 try {return Response.json(await opportunityCommand(['scan']));}
 catch {return Response.json({error:'Actualisation impossible. Les offres déjà enregistrées sont conservées.'},{status:503});}
}
export async function PATCH(req:Request) {
 try {
  const body=await req.json();
  if(typeof body.id!=='string'||!/^[a-f0-9]{20}$/.test(body.id)||!['Nouveau','À analyser','Intéressant','À postuler','Candidature envoyée','Entretien','Refus','Archivé'].includes(body.status))return Response.json({error:'Offre ou statut invalide'},{status:400});
  return Response.json(await opportunityCommand(['status',body.id,body.status]));
 }catch{return Response.json({error:'Le statut n’a pas été enregistré.'},{status:400});}
}
