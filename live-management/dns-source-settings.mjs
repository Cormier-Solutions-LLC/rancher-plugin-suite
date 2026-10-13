const fail=code=>Object.assign(new Error('The DNS source setting is invalid.'),{code});
// Shared by the browser editor/catalog and the native network probe. A settings
// validator must not pull Node sockets or filesystem code into the extension.
export function dnsSourceAddress(value){
 if(typeof value!=='string'||value!==value.trim()||value.length>64)throw fail('SOURCE_INVALID_ADDRESS');
 if(/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)){const parts=value.split('.').map(Number);if(parts.every(p=>p<=255)&&(parts[0]===10||parts[0]===172&&parts[1]>=16&&parts[1]<=31||parts[0]===192&&parts[1]===168))return value;}
 if(/^(fc|fd)[0-9a-f]{2}:/i.test(value)){try{const address=new URL('http://['+value+']/').hostname;if(address.startsWith('[')&&address.endsWith(']'))return address.slice(1,-1);}catch{}}
 throw fail('SOURCE_INVALID_ADDRESS');
}
export function dnsSourceDomain(value,{allowUnderscore=false}={}){
 const name=String(value||'').toLowerCase().replace(/\.$/,'');const label=allowUnderscore?/^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/:/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
 if(name.length>253||!name.includes('.')||!name.split('.').every(part=>label.test(part)))throw fail('SOURCE_INVALID_NAME');return name;
}
