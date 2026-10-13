import {createHash,createPublicKey,publicEncrypt,createCipheriv,createHmac,randomBytes,constants} from 'node:crypto';
const fail=()=>Object.assign(new Error('The Windows recovery envelope or recipient is invalid.'),{code:'RECOVERY_ENVELOPE_REJECTED',status:422});
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value||'');
export function validateWindowsRecoveryMessage(message,{now=Math.floor(Date.now()/1000)}={}){
 if(!message||message.version!==1||!uuid(message.id)||!uuid(message.requestId)||!/^user-[a-z0-9-]+$/.test(message.userId||'')||!uuid(message.clusterUid)||!uuid(message.accountUid)||!['prepare','commit','reconcile','status'].includes(message.action)||!Number.isSafeInteger(message.issuedAt)||!Number.isSafeInteger(message.expiresAt)||message.issuedAt>now+30||message.issuedAt<now-600||message.expiresAt<=now||message.expiresAt<=message.issuedAt||message.expiresAt-message.issuedAt>600||Object.keys(message).some(k=>!['version','id','requestId','userId','clusterUid','accountUid','action','issuedAt','expiresAt','target'].includes(k)))throw fail();
 if(message.action==='prepare'){if(typeof message.target?.configuration!=='string'||!message.target.configuration||message.target.configuration.length>65536||Object.keys(message.target).join('|')!=='configuration')throw fail();}else if(message.target!==undefined)throw fail();
 return message;
}
export function recoveryRecipientId(jwk){
 try{if(jwk?.kty!=='RSA'||jwk.e!=='AQAB'||typeof jwk.n!=='string'||!/^[A-Za-z0-9_-]+$/.test(jwk.n)||Buffer.from(jwk.n,'base64url').toString('base64url')!==jwk.n||Buffer.from(jwk.n,'base64url').length<384||Buffer.from(jwk.n,'base64url').length>512||['d','p','q','dp','dq','qi','oth'].some(k=>jwk[k]!==undefined))throw fail();return createHash('sha256').update(JSON.stringify({e:jwk.e,kty:'RSA',n:jwk.n})).digest('base64url');}catch{throw fail();}
}
export function recoveryAuthenticationTag(cek,aad,iv,encrypted){
 if(cek.length!==64||iv.length!==16||!encrypted.length||encrypted.length%16)throw fail();const length=Buffer.alloc(8);length.writeBigUInt64BE(BigInt(aad.length)*8n);
 return createHmac('sha512',cek.subarray(0,32)).update(aad).update(iv).update(encrypted).update(length).digest().subarray(0,32);
}
// RFC 7516 compact JWE, RSA-OAEP-256 and A256CBC-HS512. Encryption and
// integrity do not authenticate the sender; the queue's RBAC must do that.
export function encryptWindowsRecovery(message,jwk,options){
 validateWindowsRecoveryMessage(message,options);const kid=recoveryRecipientId(jwk);if(jwk.kid!==kid||jwk.alg!=='RSA-OAEP-256'||jwk.use!=='enc')throw fail();
 const plaintext=Buffer.from(JSON.stringify(message));if(plaintext.length>65536)throw fail();const cek=randomBytes(64),iv=randomBytes(16);
 try{
  const header=Buffer.from(JSON.stringify({alg:'RSA-OAEP-256',enc:'A256CBC-HS512',kid,typ:'dns-recovery+jwe'})).toString('base64url'),aad=Buffer.from(header,'ascii');
  const wrapped=publicEncrypt({key:createPublicKey({key:jwk,format:'jwk'}),oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},cek);
  const cipher=createCipheriv('aes-256-cbc',cek.subarray(32),iv),encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const tag=recoveryAuthenticationTag(cek,aad,iv,encrypted);
  return [header,wrapped.toString('base64url'),iv.toString('base64url'),encrypted.toString('base64url'),tag.toString('base64url')].join('.');
 }catch{throw fail();}finally{cek.fill(0);plaintext.fill(0);}
}
