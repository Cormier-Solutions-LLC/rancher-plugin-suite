// Persist ownership before each native API write. Unknown outcomes remain visible
// and are never adopted or replayed merely because a same-named zone exists.
export async function reconcileManagedZones({replica,entries,ownership,api,save,sourceAddress}) {
 const reports=[];
 const state=await api('zones/list');
 const existing=new Map(state.zones.map(z=>[z.name,z]));
 for(const entry of entries) {
  const key=`${replica}/${entry.name}`,zone=existing.get(entry.name);let owned=ownership[key];
  if(!['Active','Deleted'].includes(entry.status))continue;
  try {
   if(entry.status==='Active') {
    if(!zone&&owned?.status==='Deleted'){delete ownership[key];owned=undefined;}
    if(owned&&owned.ownerId!==entry.ownerId)throw new Error('Replica zone has a different ownership revision.');
    if(zone&&!owned)throw new Error('Existing replica zone is not owned by this manager.');
    if(owned&&owned.status==='Creating')throw new Error('Interrupted zone creation requires ownership reconciliation; it will not be adopted or replayed automatically.');
    if(!zone) {
     ownership[key]={ownerId:entry.ownerId,status:'Creating'};await save();
     await api('zones/create',{zone:entry.name,type:'Secondary',primaryNameServerAddresses:sourceAddress,zoneTransferProtocol:'Tcp'});
     // A confirmed create may be read back on subsequent reconciliations.
     ownership[key].status='Active';await save();
    }
    const options=await api('zones/options/get',{zone:entry.name});
    if(options.type!=='Secondary'||options.primaryZoneTransferProtocol!=='Tcp'||options.primaryNameServerAddresses?.length!==1||options.primaryNameServerAddresses[0]!==sourceAddress)throw new Error('Replica zone type or primary endpoint changed; no overwrite is allowed.');
    if(owned?.status==='Deleting'||owned?.status==='Deleted')throw new Error('Replica deletion history requires reconciliation before recreating this ownership revision.');
    reports.push({zone:entry.name,ownerId:entry.ownerId,replica,status:'Present',readBack:true});
   }else{
    if(owned&&owned.ownerId!==entry.ownerId)throw new Error('Deletion does not match replica ownership.');
    if(zone) {
     if(!owned||!['Active','Deleting'].includes(owned.status))throw new Error('Replica deletion is not authorized by confirmed ownership.');
     const options=await api('zones/options/get',{zone:entry.name});
     if(options.type!=='Secondary'||options.primaryZoneTransferProtocol!=='Tcp'||options.primaryNameServerAddresses?.length!==1||options.primaryNameServerAddresses[0]!==sourceAddress)throw new Error('Replica zone changed before deletion; no deletion is allowed.');
     // A lost deletion response is recovered only by an observed absence.
     // A still-present Deleting zone is not replayed.
     if(owned.status==='Deleting')throw new Error('Unconfirmed replica deletion is still present; review before retrying.');
     owned.status='Deleting';await save();await api('zones/delete',{zone:entry.name});
     const after=await api('zones/list');if(after.zones.some(z=>z.name===entry.name))throw new Error('Deleted replica zone remains present.');
    }
    if(owned){owned.status='Deleted';await save();}
    reports.push({zone:entry.name,ownerId:entry.ownerId,replica,status:'Absent',readBack:true});
   }
  }catch(error){reports.push({zone:entry.name,ownerId:entry.ownerId,replica,status:'NeedsReview',error:error.message});}
 }
 return reports;
}
