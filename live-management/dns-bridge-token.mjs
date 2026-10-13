import {createPublicKey,verify,constants} from 'node:crypto';
const denied=()=>Object.assign(new Error('The saved Windows bridge token is not signed and bound to the installed account.'),{code:'BRIDGE_TOKEN_REJECTED',status:422});
const decode=value=>{if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value)||value.length>16384)throw denied();const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)throw denied();return bytes;};
// Offline signature/identity preflight works even when the live Secret is
// missing. It does not replace API authentication after Secret restoration.
export function verifySavedBridgeToken(secret,{serviceAccount,jwks,now=Math.floor(Date.now()/1000)}={}){
 try{
  const account=serviceAccount?.metadata,annotations=secret?.metadata?.annotations;
  if(serviceAccount?.apiVersion!=='v1'||serviceAccount.kind!=='ServiceAccount'||account?.namespace!=='dns-system'||account.name!=='dns-windows-bridge'||!account.uid||account.deletionTimestamp||secret?.type!=='kubernetes.io/service-account-token'||secret.metadata?.namespace!=='dns-system'||secret.metadata.name!=='dns-windows-bridge-credential'||annotations?.['kubernetes.io/service-account.name']!==account.name||annotations?.['kubernetes.io/service-account.uid']!==account.uid||typeof secret.data?.token!=='string'||secret.data.token.length>24000||!Number.isSafeInteger(now))throw denied();
  const encoded=secret.data.token,tokenBytes=Buffer.from(encoded,'base64');if(tokenBytes.toString('base64')!==encoded)throw denied();
  const token=new TextDecoder('utf-8',{fatal:true}).decode(tokenBytes),parts=token.split('.');if(parts.length!==3)throw denied();
  const header=JSON.parse(decode(parts[0]).toString('utf8')),claims=JSON.parse(decode(parts[1]).toString('utf8')),signature=decode(parts[2]);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||header.kid.length>256||Object.keys(header).some(k=>!['alg','kid','typ'].includes(k))||header.typ!==undefined&&header.typ!=='JWT'||!Array.isArray(jwks?.keys)||jwks.keys.length>16)throw denied();
  const keys=jwks.keys.filter(key=>key.kid===header.kid);if(keys.length!==1)throw denied();const key=keys[0];
  if(key.kty!=='RSA'||key.alg!=='RS256'||key.use!=='sig'||key.key_ops!==undefined&&(!Array.isArray(key.key_ops)||key.key_ops.length!==1||key.key_ops[0]!=='verify')||['d','p','q','dp','dq','qi','oth'].some(k=>key[k]!==undefined)||decode(key.n).length<256||decode(key.n).length>512||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),{key:createPublicKey({key,format:'jwk'}),padding:constants.RSA_PKCS1_PADDING},signature))throw denied();
  if(claims.iss!=='kubernetes/serviceaccount'||claims.sub!=='system:serviceaccount:dns-system:dns-windows-bridge'||claims['kubernetes.io/serviceaccount/namespace']!=='dns-system'||claims['kubernetes.io/serviceaccount/service-account.name']!==account.name||claims['kubernetes.io/serviceaccount/service-account.uid']!==account.uid||claims['kubernetes.io/serviceaccount/secret.name']!==secret.metadata.name||claims.aud!==undefined)throw denied();
  for(const field of ['exp','nbf','iat'])if(claims[field]!==undefined&&!Number.isSafeInteger(claims[field]))throw denied();
  if(claims.exp!==undefined&&claims.exp<=now||claims.nbf!==undefined&&claims.nbf>now+30||claims.iat!==undefined&&claims.iat>now+30)throw denied();
  return {signatureVerified:true,accountUid:account.uid,secretName:secret.metadata.name,issuer:claims.iss};
 }catch{throw denied();}
}
