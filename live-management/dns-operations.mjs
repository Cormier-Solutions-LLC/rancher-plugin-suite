const supported=new Set(['A','AAAA','CNAME','PTR','TXT','MX','SRV']);
const identity=r=>JSON.stringify([r.name,r.type,r.value]);
export function validateZoneRecovery(saved){
 if(!saved?.zone?.managed||!saved.zone.ownerId)throw new Error('Only a previously managed deleted zone can be recreated from a snapshot.');
 const records=saved.records;
 if(!Array.isArray(records)||!records.length||records.length>5000||records.some(r=>!r||!['SOA','NS',...supported].includes(r.type)||typeof r.name!=='string'||typeof r.value!=='string'||!Number.isInteger(r.ttl)||r.ttl<0||r.ttl>604800))throw new Error('Deleted-zone restoration requires complete supported SOA, NS and zone records.');
 if(new Set(records.map(identity)).size!==records.length)throw new Error('Duplicate recovery record identity.');
 const soa=records.filter(r=>r.type==='SOA'),ns=records.filter(r=>r.name==='@'&&r.type==='NS');
 if(soa.length!==1||soa[0].name!=='@'||!ns.length)throw new Error('Recovery requires the apex SOA and nameservers.');
 const parts=soa[0].value.split(/\s+/);
 if(parts.length!==7||parts.slice(2).some(n=>!/^\d+$/.test(n)||Number(n)>4294967295))throw new Error('Invalid recovery SOA.');
 for(const r of records.filter(r=>r.type==='CNAME'))if(r.name==='@'||records.some(other=>other!==r&&other.name===r.name))throw new Error('Recovery CNAME conflicts with another record.');
 return records;
}
export function zoneName(value,kind) {
 const name=String(value||'').trim().toLowerCase().replace(/\.$/,'');
 if(name.length>253||!name.includes('.')||!name.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))throw new Error('Use an absolute zone name with valid DNS labels.');
 const ipv4=name.match(/^((?:\d+\.){1,4})in-addr\.arpa$/),ipv6=name.match(/^((?:[0-9a-f]\.){1,32})ip6\.arpa$/);
 const reverse=Boolean(ipv4&&ipv4[1].split('.').filter(Boolean).every(n=>Number(n)<=255&&String(Number(n))===n)||ipv6&&ipv6[1].split('.').filter(Boolean).length>=4);
 if(!['Forward','Reverse'].includes(kind)||kind==='Reverse'&&!reverse||kind==='Forward'&&/\.(?:in-addr|ip6)\.arpa$/.test(name))throw new Error('Reverse zones must use IPv4 octet or IPv6 nibble notation; forward zones must use a domain name.');
 return name;
}
export function dnsOperations(changes,inventory,{allowEmpty=false}={}) {
 if(!inventory?.source?.managementReachable)throw new Error('The Windows management bridge is unavailable.');
 const operations=[],targets=new Set(),serials={};
 for(const change of changes) {
  if(change.needsCompletion)throw new Error('Complete the selected draft before applying.');
  if(change.kind==='zone') {
   if(change.source&&change.source!==inventory.source.name)throw new Error('The selected writable source changed; review the zone again.');
   const name=zoneName(change.zone,change.type);
   if(inventory.zones.some(z=>z.name.toLowerCase()===name))throw new Error('The proposed zone already exists.');
   const parent=inventory.zones.filter(z=>name.endsWith('.'+z.name)).sort((a,b)=>b.name.length-a.name.length)[0];
   operations.push({zone:name,kind:change.type,operation:'CreateZone',...(parent?{parentZone:parent.name}:{})});if(parent)serials[parent.name]=parent.serial;
  } else if(change.kind==='delete'&&change.zone==='zones') {
   for(const id of change.items||[]) {
    const zone=inventory.zones.find(z=>z.id===id);if(!zone)throw new Error('The selected zone is unavailable.');
    if(!zone.managed||!zone.ownerId)throw new Error('Only zones created by this manager can be deleted. Existing source zones are protected.');
    operations.push({zone:zone.name,operation:'DeleteZone',ownerId:zone.ownerId});serials[zone.name]=zone.serial;
    if(zone.delegationRecords?.length){const parent=inventory.zones.find(z=>z.name===zone.parentZone);if(!parent)throw new Error('The managed parent delegation is unavailable.');serials[parent.name]=parent.serial;}
   }
  } else if(change.kind==='record') {
   const zone=inventory.zones.find(z=>z.id===change.zone);if(!zone)throw new Error('The selected zone is unavailable.');
   if(!supported.has(change.type))throw new Error('Unsupported writable DNS record type.');
   const ttl=Number(change.ttl);if(!Number.isInteger(ttl)||ttl<0||ttl>604800)throw new Error('TTL must be from zero to seven days.');
   const previous=change.targetId&&inventory.records[zone.id].find(r=>identity(r)===change.targetId);
   if(change.targetId&&!previous)throw new Error('The reviewed record changed; refresh and review again.');
   if(previous&&(previous.name!==change.name||previous.type!==change.type))throw new Error('Record name and type cannot change during an update.');
   operations.push({zone:zone.name,name:change.name,type:change.type,value:change.value,ttl,operation:previous?'Update':'Create',...(previous?{targetId:change.targetId}:{})});serials[zone.name]=zone.serial;
  } else if(change.kind==='delete'&&change.zone?.startsWith('zone:')) {
   const id=change.zone.slice(5),zone=inventory.zones.find(z=>z.id===id);if(!zone)throw new Error('The selected zone is unavailable.');
   for(const targetId of change.items){const r=inventory.records[id].find(r=>identity(r)===targetId);if(!r||!supported.has(r.type))throw new Error('A selected delete target changed or has an unsupported record type.');operations.push({...r,zone:zone.name,operation:'Delete',targetId});}
   serials[zone.name]=zone.serial;
  } else if(change.kind==='restore'&&change.configuration?.kind==='DnsZone') {
   const saved=change.configuration.dns,zone=inventory.zones.find(z=>z.name===saved?.zone?.name);
   if(!zone){
    validateZoneRecovery(saved);
    const name=zoneName(saved.zone.name,saved.zone.kind);
    const parent=inventory.zones.filter(z=>name.endsWith('.'+z.name)).sort((a,b)=>b.name.length-a.name.length)[0];
    operations.push({zone:name,kind:saved.zone.kind,operation:'RestoreZone',previousOwnerId:saved.zone.ownerId,records:saved.records,...(change.restoreSnapshotId?{restoreSnapshotId:change.restoreSnapshotId}:{}),...(parent?{parentZone:parent.name}:{})});if(parent)serials[parent.name]=parent.serial;
    continue;
   }
   // Restore only selected saved records; never delete unrelated newer records.
   for(const record of saved.records || []) {
    if(!supported.has(record.type))continue;
    if(inventory.records[zone.id].some(r=>identity(r)===identity(record)&&r.ttl===record.ttl))continue;
    const matches=inventory.records[zone.id].filter(r=>r.name===record.name&&r.type===record.type);
    if(matches.length>1)throw new Error('Restore target has multiple values; select individual records for review.');
    operations.push({...record,zone:zone.name,operation:matches.length?'Update':'Create',...(matches.length?{targetId:identity(matches[0])}:{})});
   }
   serials[zone.name]=zone.serial;
  }else if(change.kind==='restore'&&change.configuration?.kind==='DnsSource'){
   const saved=change.configuration.dns;
   if(!saved?.host||!saved.address||['name','host','address','credential'].some(k=>saved[k]!==inventory.source[k]))throw new Error('The saved source configuration differs; restore it through source management first.');
   // An unchanged source in a complete backup is already restored; do not turn
   // its presence into a failed record/zone recovery batch.
  }else throw new Error('This source, zone or navigation change requires its specific management operation. Record changes can be applied now.');
 }
 if(!operations.length&&!allowEmpty||operations.length>50)throw new Error('Select one to fifty executable DNS changes.');
 for(const op of operations){const key=JSON.stringify([op.zone,op.name,op.type,op.operation==='Create'?op.value:op.targetId]);if(targets.has(key)||operations.some(other=>other!==op&&other.zone===op.zone&&(op.operation.endsWith('Zone')||other.operation.endsWith('Zone'))))throw new Error('Conflicting proposals target one zone or record.');targets.add(key);}
 return {operations,serials};
}
