const FIELD=/^[A-Za-z][A-Za-z0-9_]{0,63}$/,ID=/^[A-Za-z0-9_-]{3,128}$/;
const blocked=new Set(['__proto__','constructor','prototype']);
export class IntegrationSettingsUnavailable extends Error{constructor(status){super('Shared integration settings are unavailable');this.name='IntegrationSettingsUnavailable';if(status)this.status=status;}}
/** Server-only: the token and returned credentials must never enter browser code. */
export function createIntegrationSettingsClient({issuer,token,fetcher=globalThis.fetch,timeoutMs=10000}){
  if(typeof window!=='undefined')throw new Error('Integration settings are server-only');
  let origin;try{origin=new URL(issuer);}catch{throw new Error('An HTTPS Access issuer is required');}
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash)throw new Error('An HTTPS Access issuer is required');
  if(typeof token!=='string'||!/^aci_[A-Za-z0-9_-]{43}$/.test(token)||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw new Error('A valid application settings token and bounded timeout are required');
  const endpoint=issuer.replace(/\/$/,'')+'/api/integrations/config';
  return{async read(integrationId){
    if(integrationId!==undefined&&(typeof integrationId!=='string'||!ID.test(integrationId)))throw new Error('Invalid integration identifier');
    const url=new URL(endpoint);if(integrationId)url.searchParams.set('integration',integrationId);
    let response;try{response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+token,accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});}catch{throw new IntegrationSettingsUnavailable();}
    if(!response.ok){await response.body?.cancel().catch(()=>{});throw new IntegrationSettingsUnavailable(response.status);}
    try{
      if(Number(response.headers.get('content-length')||0)>1048576)throw Error();const reader=response.body?.getReader();if(!reader)throw Error();const chunks=[];let bytes=0;
      try{for(;;){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1048576)throw Error();chunks.push(value);}}catch{await reader.cancel().catch(()=>{});throw Error();}
      const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
      if(result.version!==1||!Array.isArray(result.integrations)||result.integrations.length<1||result.integrations.length>20)throw Error();const seen=new Set();
      for(const item of result.integrations){if(!item||typeof item.id!=='string'||!ID.test(item.id)||seen.has(item.id)||typeof item.name!=='string'||item.name.length>120||typeof item.kind!=='string'||item.kind.length>64||typeof item.revision!=='string'||!item.revision.length||item.revision.length>128||!item.settings||typeof item.settings!=='object'||Array.isArray(item.settings)||(integrationId&&item.id!==integrationId))throw Error();seen.add(item.id);const entries=Object.entries(item.settings);if(entries.length>32||entries.some(([key,value])=>!FIELD.test(key)||blocked.has(key)||!['string','number','boolean'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value))))throw Error();}
      return result;
    }catch{throw new IntegrationSettingsUnavailable();}
  }};
}
export async function integrationSettingsFromEnv(env=process.env,options={}){
  const file=env.CORMIER_ACCESS_INTEGRATION_TOKEN_FILE,direct=env.CORMIER_ACCESS_INTEGRATION_TOKEN;if(!file&&!direct)return undefined;
  let token;try{token=file?(await(await import('node:fs/promises')).readFile(file,'utf8')).trim():direct.trim();}catch{throw new IntegrationSettingsUnavailable();}
  return createIntegrationSettingsClient({issuer:env.CORMIER_ACCESS_AUTHORITY||env.ACCESS_ISSUER,token,...options});
}
