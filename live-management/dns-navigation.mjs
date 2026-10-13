export function currentZoneOrder(saved, zones) {
 const ids=zones.map(z=>z.id);
 if(new Set(ids).size!==ids.length)throw new Error('Observed zone identities are ambiguous.');
 if(saved!==undefined&&(!Array.isArray(saved)||saved.some(id=>typeof id!=='string')||new Set(saved).size!==saved.length))throw new Error('Saved zone navigation is invalid; review its persisted state.');
 return [...(saved||[]).filter(id=>ids.includes(id)),...ids.filter(id=>!saved?.includes(id))];
}
export function navigationProposal(changes, current, zones) {
 const selected=changes.filter(c=>c.kind==='order'||c.kind==='restore'&&c.configuration?.kind==='DnsNavigation');
 if(selected.length!==1||changes.some(c=>c.needsCompletion))throw new Error('Review one complete navigation proposal.');
 const change=selected[0],order=change.kind==='order'?change.order:change.configuration.dns?.order;
 if(!Array.isArray(order)||order.length!==zones.length||new Set(order).size!==order.length||order.some(id=>!zones.some(z=>z.id===id)))throw new Error('Navigation must contain every current zone exactly once. Refresh and review again.');
 if(change.kind==='order'&&JSON.stringify(change.baseOrder)!==JSON.stringify(current))throw new Error('Applied navigation changed after review. Refresh and review again.');
 return {order:[...order],draftIds:changes.map(c=>c.id),unchanged:JSON.stringify(order)===JSON.stringify(current)};
}
export function validateNavigationBackup(snapshot, order, stateName, now=Date.now()) {
 const age=now-Date.parse(snapshot?.createdAt);
 if(!Number.isFinite(age)||age<0||age>=86400000||snapshot.encrypted)throw new Error('Save a recent unencrypted server configuration backup before applying navigation.');
 const current=snapshot.current;
 if(current?.snapshotScope?.managerStateName!==stateName)throw new Error('The navigation backup belongs to a different manager identity.');
 const configs=[current.configuration,...(current.relatedConfigurations||[])].filter(Boolean);
 const navigation=configs.filter(c=>c.kind==='DnsNavigation');
 if(navigation.length!==1||JSON.stringify(navigation[0].dns?.order)!==JSON.stringify(order))throw new Error('The backup does not cover the current applied navigation. Create a fresh backup.');
}
