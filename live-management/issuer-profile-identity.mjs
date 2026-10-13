// An Issuer name is unique only within its kind and namespace.
export const issuerProfileKey=profile=>`${profile?.manifest?.kind||'ClusterIssuer'}/${profile?.manifest?.metadata?.namespace||''}/${profile?.name||''}`;
export function findIssuerProfile(profiles,selection){
 const exact=profiles.find(profile=>issuerProfileKey(profile)===selection);
 if(exact)return exact;
 // Restore older saved editors only when their name identifies one profile.
 const legacy=profiles.filter(profile=>profile.name===selection);
 return legacy.length===1?legacy[0]:undefined;
}
