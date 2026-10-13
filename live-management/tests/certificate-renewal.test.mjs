import test from 'node:test';import assert from 'node:assert/strict';
import {prepareCertificateRenewals,submitCertificateRenewals,reconcileCertificateRenewals} from '../certificate-renewal.mjs';
const certificate={apiVersion:'cert-manager.io/v1',kind:'Certificate',metadata:{name:'site',namespace:'demo',uid:'cert-uid',resourceVersion:'12',generation:1},spec:{secretName:'site-tls',dnsNames:['site.example.test'],issuerRef:{name:'issuer',kind:'ClusterIssuer'}},status:{revision:1,conditions:[{type:'Ready',status:'True'}]}};
const change={name:'Renew site',resources:[],configuration:{operation:'RequestCertificateRenewal',certificate:{name:'site',namespace:'demo'},reviewedUid:'cert-uid',secretName:'site-tls',dnsNames:['site.example.test'],issuer:{name:'issuer',kind:'ClusterIssuer'},observedRevision:1,requestedAt:new Date().toISOString()}};
test('renewal validates status permission before submission, preserves the Secret reference and verifies observed issuance',async()=>{
 let observed=structuredClone(certificate),calls=[];const call=async(path,init)=>{calls.push([path,init]);if(!init)return structuredClone(observed);const body=JSON.parse(init.body);assert.equal(body.spec.secretName,'site-tls');if(!path.includes('dryRun'))observed=body;return body;};
 const prepared=await prepareCertificateRenewals([change],call);assert.equal(calls.filter(([,init])=>init).length,1);assert.match(calls.at(-1)[0],/status\?dryRun=All$/);const result=await submitCertificateRenewals(prepared,call);assert.equal(result.applied[0].accepted,true);assert.equal(result.applied[0].readBack,true);assert.equal(observed.status.conditions.find(c=>c.type==='Issuing').reason,'ManuallyTriggered');assert.equal(observed.status.conditions.find(c=>c.type==='Ready').status,'True');
});
test('stale identity/revision, running issuance and denied status access prevent writes',async()=>{
 for(const current of [{...certificate,metadata:{...certificate.metadata,uid:'replaced'}},{...certificate,status:{...certificate.status,revision:2}},{...certificate,status:{...certificate.status,conditions:[{type:'Issuing',status:'True'}]}}]){let dryRuns=0;await assert.rejects(prepareCertificateRenewals([change],async(_path,init)=>{if(init)dryRuns++;return current;}));assert.equal(dryRuns,0);}
 let writes=0;await assert.rejects(prepareCertificateRenewals([change],async(path,init)=>{if(!init)return certificate;if(!path.includes('dryRun'))writes++;throw Object.assign(new Error('Forbidden'),{status:403});}),/Forbidden/);assert.equal(writes,0);
});
test('lost submission response is confirmed by the original request without replay; uncertain reads retain the attempted receipt',async()=>{
 const prepared=await prepareCertificateRenewals([change],async(_p,init)=>init?JSON.parse(init.body):certificate);let observed=certificate,writes=0;
 const result=await submitCertificateRenewals(prepared,async(_p,init)=>{if(init){writes++;observed=JSON.parse(init.body);throw new Error('Response lost');}return observed;});assert.equal(writes,1);assert.equal(result.applied[0].accepted,true);
 await assert.rejects(submitCertificateRenewals(prepared,async()=>{throw new Error('Unavailable');}),e=>e.applied.length===1&&e.applied[0].acceptanceUnknown&&!e.applied[0].accepted);
});
test('current Ready status is not a completed renewal; fresh revision, denial and replacement reconcile persisted process state',()=>{
 const now=Date.now(),receipt={operation:'Renew',accepted:true,identity:'Certificate/demo/site',uid:'cert-uid',observedRevision:1,requestedAt:new Date(now-1000).toISOString()},process={progress:50,receipt:{applied:[receipt]}},current={name:'site',namespace:'demo',uid:'cert-uid',revision:1,ready:'True',requests:[],orders:[],challenges:[]};
 reconcileCertificateRenewals([process],[current],now);assert.equal(process.progress,50);
 const restored=structuredClone(process);reconcileCertificateRenewals([restored],[{...current,revision:2}],now);assert.equal(restored.progress,100);assert.equal(restored.receipt.applied[0].renewedRevision,2);
 const denied=structuredClone(process);reconcileCertificateRenewals([denied],[{...current,requests:[{createdAt:new Date(now).toISOString(),conditions:[{type:'Denied',status:'True'}]}]}],now);assert.equal(denied.failed,true);
 const replaced=structuredClone(process);reconcileCertificateRenewals([replaced],[{...current,uid:'different'}],now);assert.equal(replaced.failed,true);
});
