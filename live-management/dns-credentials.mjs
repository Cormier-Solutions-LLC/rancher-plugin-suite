// These are the installed integration dependencies, not caller-selected Secret names.
export const dnsCredentialReferences = [
 {namespace:'dns-system',name:'dns-manager-engine-admin',type:'Opaque',purpose:'Replica administration',keys:['admin-password']},
 {namespace:'dns-system',name:'dns-windows-bridge-credential',type:'kubernetes.io/service-account-token',purpose:'Windows bridge Kubernetes access',serviceAccountName:'dns-windows-bridge',keys:['ca.crt','namespace','token']}
];
export function verifyDnsCredentialBinding(secret,reference,{serviceAccount,authentication}={}){
 if(!reference.serviceAccountName)return;
 const annotations=secret?.metadata?.annotations||{},user=authentication?.status?.userInfo;
 if(serviceAccount?.apiVersion!=='v1'||serviceAccount.kind!=='ServiceAccount'||serviceAccount.metadata?.namespace!==reference.namespace||serviceAccount.metadata?.name!==reference.serviceAccountName||!serviceAccount.metadata.uid||serviceAccount.metadata.deletionTimestamp||annotations['kubernetes.io/service-account.name']!==reference.serviceAccountName||annotations['kubernetes.io/service-account.uid']!==serviceAccount.metadata.uid||Buffer.from(secret.data?.namespace||'','base64').toString('utf8')!==reference.namespace||authentication?.apiVersion!=='authentication.k8s.io/v1'||authentication.kind!=='SelfSubjectReview'||user?.username!==`system:serviceaccount:${reference.namespace}:${reference.serviceAccountName}`||user.uid!==serviceAccount.metadata.uid||!['system:authenticated','system:serviceaccounts',`system:serviceaccounts:${reference.namespace}`].every(group=>user.groups?.includes(group)))throw new Error('The DNS bridge credential is not authenticated and bound to its current service account.');
}
export function credentialCapture(secret,reference,binding){
 const fail=()=>{throw new Error('The installed DNS credential identity or values are incomplete.');};
 if(secret?.apiVersion!=='v1'||secret.kind!=='Secret'||secret.metadata?.namespace!==reference.namespace||secret.metadata?.name!==reference.name||!secret.metadata.uid||!secret.metadata.resourceVersion||secret.type!==reference.type||!secret.data||Array.isArray(secret.data)||Object.keys(secret.data).sort().join('|')!==reference.keys.slice().sort().join('|'))fail();
 if(Object.values(secret.data).some(v=>typeof v!=='string'||!v||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v)))fail();
 const annotations=secret.metadata.annotations||{};
 if(reference.serviceAccountName&&(annotations['kubernetes.io/service-account.name']!==reference.serviceAccountName||!annotations['kubernetes.io/service-account.uid']))fail();
 verifyDnsCredentialBinding(secret,reference,binding);
 return {apiVersion:'v1',kind:'Secret',metadata:{namespace:reference.namespace,name:reference.name,...(reference.serviceAccountName?{annotations:Object.fromEntries(['kubernetes.io/service-account.name','kubernetes.io/service-account.uid'].map(k=>[k,annotations[k]]))}:{})},type:secret.type,data:structuredClone(secret.data)};
}
