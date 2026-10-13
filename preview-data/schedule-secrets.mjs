import { mkdir, readFile, open, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import https from 'node:https';

const valid = name => /^[a-z0-9][a-z0-9-]{0,252}$/.test(name);
async function atomic(path, bytes) {
  const temp=`${path}.${randomUUID()}.tmp`, file=await open(temp,'wx',0o600);
  try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
  await rename(temp,path);
}
// A preview-only substitute. No credentials are saved in the mock inventory JSON.
export function previewSecretStore(directory, prefix) {
  const root=resolve(directory,'.credentials');let key;
  async function master(){if(key)return key;await mkdir(root,{recursive:true,mode:0o700});const path=resolve(root,'master.key');try{key=await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;const candidate=randomBytes(32);try{const file=await open(path,'wx',0o600);try{await file.writeFile(candidate);}finally{await file.close();}key=candidate;}catch(e){if(e.code!=='EEXIST')throw e;key=await readFile(path);}}if(key.length!==32)throw new Error('Preview secret store unavailable.');return key;}
  return {
    async put(password){const name=`${prefix}-${randomUUID()}`,nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await master(),nonce);const payload=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]);await atomic(resolve(root,name),Buffer.concat([nonce,cipher.getAuthTag(),payload]));return {provider:'preview',name};},
    async get(ref){if(ref?.provider!=='preview'||!valid(ref.name)||!ref.name.startsWith(prefix+'-'))throw new Error('Invalid password Secret reference.');const bytes=await readFile(resolve(root,ref.name)),cipher=createDecipheriv('aes-256-gcm',await master(),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');}
  };
}
export function kubernetesSecretStore({prefix, namespace, request, vaultName}) {
  if(!valid(prefix)||!valid(namespace))throw new Error('Snapshot Secret namespace is required.');
  const collection=`/api/v1/namespaces/${namespace}/secrets`;
  if(vaultName) {
    if(!valid(vaultName))throw new Error('Invalid snapshot password vault.');
    const path=`${collection}/${vaultName}`;
    return {
      async put(password) {
        const key=randomUUID();
        for(let attempt=0;attempt<3;attempt++) {
          const current=await request('GET',path);
          const next={apiVersion:'v1',kind:'Secret',type:'Opaque',metadata:{name:vaultName,namespace,resourceVersion:current.metadata.resourceVersion},data:{...current.data,[key]:Buffer.from(password).toString('base64')}};
          try {await request('PUT',path,next);return {provider:'kubernetes-vault',namespace,name:vaultName,key};}
          catch(error){if(error.status!==409 || attempt===2)throw error;}
        }
      },
      async get(ref) {
        if(ref?.provider!=='kubernetes-vault'||ref.namespace!==namespace||ref.name!==vaultName||!/^[0-9a-f-]{36}$/.test(ref.key || ''))throw new Error('Invalid password vault reference.');
        const secret=await request('GET',path);
        if(!secret.data?.[ref.key])throw new Error('Snapshot password version unavailable.');
        return Buffer.from(secret.data[ref.key],'base64').toString('utf8');
      }
    };
  }
  return {
    async put(password){const name=`${prefix}-${randomUUID()}`;await request('POST',collection,{apiVersion:'v1',kind:'Secret',metadata:{name,namespace,labels:{'app.kubernetes.io/managed-by':prefix}},type:'Opaque',immutable:true,data:{password:Buffer.from(password).toString('base64')}});return {provider:'kubernetes',namespace,name};},
    async get(ref){if(ref?.provider!=='kubernetes'||ref.namespace!==namespace||!valid(ref.name)||!ref.name.startsWith(prefix+'-'))throw new Error('Invalid password Secret reference.');const secret=await request('GET',`${collection}/${ref.name}`);if(secret.metadata?.labels?.['app.kubernetes.io/managed-by']!==prefix||!secret.data?.password)throw new Error('Snapshot password Secret unavailable.');return Buffer.from(secret.data.password,'base64').toString('utf8');}
  };
}
export function scheduleSecretStore(directory, prefix) {
  if(process.env.SNAPSHOT_PREVIEW_MOCK_DATA==='true')return previewSecretStore(directory,prefix);
  let client;
  async function initialize(){if(client)return client;const account=process.env.SNAPSHOT_SERVICE_ACCOUNT_DIR||'/var/run/secrets/kubernetes.io/serviceaccount';const namespace=process.env.SNAPSHOT_SECRET_NAMESPACE||(await readFile(resolve(account,'namespace'),'utf8')).trim();const ca=await readFile(resolve(account,'ca.crt'));const host=process.env.KUBERNETES_SERVICE_HOST;if(!host)throw new Error('Kubernetes password Secret storage is unavailable.');const port=Number(process.env.KUBERNETES_SERVICE_PORT_HTTPS||443);
    const request=async(method,path,body)=>{const token=(await readFile(resolve(account,'token'),'utf8')).trim();return new Promise((done,reject)=>{const req=https.request({hostname:host,port,path,method,ca,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})}},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.length>1024*1024)req.destroy(new Error('Secret response too large.'));});res.on('end',()=>{if(res.statusCode<200||res.statusCode>=300)return reject(Object.assign(new Error('Snapshot password Secret request failed.'),{status:res.statusCode}));try{done(JSON.parse(text));}catch{reject(new Error('Invalid Secret response.'));}});});req.setTimeout(10000,()=>req.destroy(new Error('Snapshot Secret request timed out.')));req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});};
    const vaultName=process.env.SNAPSHOT_PASSWORD_VAULT;
    if(!vaultName)throw new Error('Snapshot password vault is not configured.');
    return client=kubernetesSecretStore({prefix,namespace,request,vaultName});
  }
  const safely=async action=>{try{return await action(await initialize());}catch{throw Object.assign(new Error('Snapshot password Secret storage is unavailable. Check the backend namespace and service-account Secret permissions.'),{status:503});}};
  return {put:password=>safely(client=>client.put(password)),get:ref=>safely(client=>client.get(ref))};
}
