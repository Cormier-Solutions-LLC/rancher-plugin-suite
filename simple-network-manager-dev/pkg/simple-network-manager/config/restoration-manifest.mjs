// Backup identity/version belongs to the capture, not the new review. The live
// adapter checks the target's current UID and resourceVersion before applying.
export function restorationManifest(resource){
 const restored=structuredClone(resource);delete restored.status;
 restored.metadata=Object.fromEntries(['name','namespace','labels','annotations'].filter(k=>restored.metadata?.[k]!==undefined).map(k=>[k,restored.metadata[k]]));
 return restored;
}
