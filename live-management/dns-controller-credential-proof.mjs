// This proof uses a new login and admin profile check from the mounted password,
// independently of the controller's cached inventory session. Never emit a
// password, its digest, or a token in the reader-visible observations.
export async function controllerCredentialProof(api,replica,{now=()=>new Date().toISOString()}={}){
 try{const result=await api.verifyMountedPassword(replica);if(result?.authenticated!==true||result.replica!==replica)throw Error('Unconfirmed identity');const at=now();if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))throw Error('Unconfirmed time');return {credentialIdentityVerified:true,credentialVerifiedAt:at};}
 catch{return {credentialIdentityVerified:false,credentialVerifiedAt:null};}
}
export function confirmedControllerCredentials(observation,{after,now=Date.now(),maxAgeMs=90000}){
 const lower=Date.parse(after);if(!Number.isFinite(lower)||!Number.isFinite(now)||lower>now||!Number.isInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>120000||!observation||!Array.isArray(observation.replicas)||observation.replicas.length!==3)return false;
 const observed=Date.parse(observation.observedAt);if(!Number.isFinite(observed)||observed<lower||observed>now||now-observed>maxAgeMs)return false;
 return [0,1,2].every(id=>{const found=observation.replicas.filter(r=>r.id===id);if(found.length!==1)return false;const r=found[0],verified=Date.parse(r.credentialVerifiedAt);return r.reachable===true&&r.credentialIdentityVerified===true&&Number.isFinite(verified)&&verified>=lower&&verified<=observed&&now-verified<=maxAgeMs;});
}
