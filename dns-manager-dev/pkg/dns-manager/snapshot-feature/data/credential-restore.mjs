const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
export const credentialNames=['dns-manager-engine-admin','dns-windows-bridge-credential'];
const states=['ReviewUnconfirmed','ReviewNotFound','Unconfirmed','Prepared','Applying','AwaitingDependencies','Interrupted','ReadyToContinue','Applied'];
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const namesValid=names=>Array.isArray(names)&&names.length>0&&names.length<=2&&new Set(names).size===names.length&&names.every(n=>credentialNames.includes(n));
const blocked=()=>new Error('Check or reconcile the original credential restore before continuing.');
function metadata(value){
 if(!uuid(value?.id)||!uuid(value.snapshotId)||!namesValid(value.names)||!states.includes(value.status))throw blocked();
 return {id:value.id,snapshotId:value.snapshotId,names:[...value.names].sort(),status:value.status,dependencyConfirmed:value.dependencyConfirmed===true,
  items:(value.items||[]).filter(i=>value.names.includes(i.name)).map(i=>({name:i.name,changed:i.changed===true,create:i.create===true,status:typeof i.status==='string'&&/^[A-Za-z]+$/.test(i.status)?i.status:'Pending'}))};
}
// Persist only the original operation reference and redacted progress. This
// journal must be writable before a submission; passwords never enter it.
export function credentialRestoreClient({storage,key,request,onProgress=()=>{}}){
 function read(){const text=storage.getItem(key);if(!text)return null;try{return metadata(JSON.parse(text));}catch{throw new Error('The saved credential restore reference is invalid. Keep it for recovery; do not start another operation.');}}
 function save(value){const safe=metadata(value);storage.setItem(key,JSON.stringify(safe));onProgress(safe);return safe;}
 async function send(action,transaction,password){
  const id=transaction.id;save({...transaction,status:action==='prepare'?'ReviewUnconfirmed':action==='apply'?'Applying':'Unconfirmed'});
  let response,body;try{response=await request(action==='prepare'?'/api/credential-recovery/prepare':`/api/credential-recovery/${id}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='prepare'?{id,snapshotId:transaction.snapshotId,names:transaction.names,password}:action==='status'?{}:{password}),signal:AbortSignal.timeout(120000)});body=await response.json();}catch{throw blocked();}
  if(body?.receipt){const raw=body.receipt,receipt=metadata(raw);if(read()?.id!==id||receipt.id!==id||receipt.snapshotId!==transaction.snapshotId||!same(receipt.names,transaction.names)||!/^user-[a-z0-9-]+$/.test(raw.userId||'')||!Array.isArray(raw.items)||raw.items.length!==receipt.names.length||new Set(raw.items.map(i=>i.name)).size!==receipt.names.length||raw.items.some(i=>!receipt.names.includes(i.name)||typeof i.changed!=='boolean'||typeof i.create!=='boolean')||receipt.status==='Applied'&&(!receipt.dependencyConfirmed||receipt.items.some(i=>i.status!=='Applied')))throw blocked();save(receipt);}
  else if(action==='status'&&response.status===404&&['ReviewUnconfirmed','ReviewNotFound'].includes(transaction.status))save({...transaction,status:'ReviewNotFound'});
  if(!response.ok||!body?.receipt){const message={401:'Sign in to Rancher again.',403:'Your Rancher permissions do not allow this credential restore.',404:'The original review was not found. Retry its original review when available.',422:'The encrypted backup password or credential binding could not be verified.',507:'Credential recovery storage is full.'}[response.status];throw new Error(message||blocked().message);}
  return read();
 }
 return {read,
  async review({snapshotId,names,password}){
   if(!uuid(snapshotId)||!namesValid(names))throw new Error('Select only installed DNS credentials from an encrypted server backup.');
   const original=read();let transaction;
   if(original&&original.status!=='Applied'){
    if(original.snapshotId!==snapshotId||!same(original.names,names)||!['ReviewUnconfirmed','ReviewNotFound'].includes(original.status))throw blocked();transaction=original;
   }else transaction={id:crypto.randomUUID(),snapshotId,names,status:'ReviewUnconfirmed'};
   return send('prepare',transaction,password);
  },
  async action(action,password='',expected){
   const transaction=read();if(!transaction||!['status','apply','reconcile'].includes(action))throw blocked();
   if(!expected||transaction.id!==expected.id||transaction.snapshotId!==expected.snapshotId||!same(transaction.names,expected.names))throw blocked();
   if(action==='apply'&&!['Prepared','ReadyToContinue'].includes(transaction.status))throw blocked();
   return send(action,transaction,password);
  }
 };
}
