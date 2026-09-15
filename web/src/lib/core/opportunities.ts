import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import * as yaml from 'js-yaml';
import { careerOpsRoot } from '@/lib/career-ops';
const run = promisify(execFile);
export function opportunitiesEnabled() {
 try {
  const profile = yaml.load(fs.readFileSync(path.join(careerOpsRoot(), 'config/profile.yml'), 'utf8')) as {opportunities?: {enabled?: boolean}};
  return profile?.opportunities?.enabled === true;
 } catch(error) { if((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
export async function opportunityCommand(args: string[]) {
 const script = path.join(/* turbopackIgnore: true */ process.env.CAREER_OPS_CODE_ROOT || path.resolve(process.cwd(), '..'), 'lib', 'opportunities', 'cli.mjs');
 const result = await run(process.execPath, [script,...args], {cwd:careerOpsRoot(), timeout:240000, maxBuffer:32*1024*1024, env:process.env});
 return JSON.parse(result.stdout);
}
