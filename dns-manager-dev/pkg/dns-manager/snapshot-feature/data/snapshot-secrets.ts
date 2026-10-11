import { secretReferences } from '../config/snapshot-secrets.mjs';
export async function captureRelevantSecrets(current:any, preserved:any[]=[]){
  const references=secretReferences(current.routeManifests||[]);
  if(references.length||preserved.length)throw new Error('The authenticated Secret-read adapter is not connected. Capture without Secrets or configure the live backend.');
  return current;
}
