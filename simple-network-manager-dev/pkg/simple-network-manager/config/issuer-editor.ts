import {buildIssuer,type IssuerSettings} from './issuer';
import {findIssuerProfile,issuerProfileKey} from '../../../../live-management/issuer-profile-identity.mjs';
export {findIssuerProfile,issuerProfileKey};
export function issuerEditorSettings(profile:any):IssuerSettings {
 const resource=profile?.manifest;
 if(resource?.apiVersion!=='cert-manager.io/v1'||resource.kind!=='ClusterIssuer'||!resource.spec?.acme||!profile.settings)throw new Error('This issuer uses a configuration outside the ACME form. Inspect or edit its Kubernetes resource in Rancher.');
 if(profile.name!==resource.metadata?.name||profile.settings.name!==profile.name)throw new Error('Issuer profile identity changed. Refresh and select the issuer again.');
 return {...profile.settings};
}
export function buildIssuerEditorChange(input:IssuerSettings,creating:boolean,selected:string,profiles:any[]) {
 if(creating){if(profiles.some(profile=>issuerProfileKey(profile)===`ClusterIssuer//${input.name}`))throw new Error('That issuer profile already exists. Choose a different name or select the existing profile to edit it.');return buildIssuer(input);}
 const profile=findIssuerProfile(profiles,selected);issuerEditorSettings(profile);
 if(input.name!==profile.name)throw new Error('The selected issuer and edit target differ. Refresh and select the issuer again.');
 const generated=buildIssuer(input),original=profile.manifest,oldAcme=original.spec.acme,oldSolver=oldAcme.solvers?.[0]||{},newSolver=generated.spec.acme.solvers[0],solver:any={...oldSolver,...newSolver};
 delete solver.http01;delete solver.dns01;
 if(oldSolver.selector||('selector' in newSolver))solver.selector={...oldSolver.selector,...('selector' in newSolver?newSolver.selector:{})};
 if('dns01' in newSolver){const webhook=newSolver.dns01.webhook;solver.dns01={webhook:{...oldSolver.dns01?.webhook,...webhook,config:{...oldSolver.dns01?.webhook?.config,...webhook.config}}};}
 else {const ingress={...oldSolver.http01?.ingress,...newSolver.http01.ingress};delete ingress.class;delete ingress.name;solver.http01={...oldSolver.http01,...newSolver.http01,ingress};}
 return JSON.parse(JSON.stringify({...generated,metadata:{...generated.metadata,...(original.metadata.labels?{labels:{...original.metadata.labels}}:{}),...(original.metadata.annotations?{annotations:Object.fromEntries(Object.entries(original.metadata.annotations).filter(([key])=>key!=='kubectl.kubernetes.io/last-applied-configuration'))}:{})},spec:{...original.spec,acme:{...oldAcme,...generated.spec.acme,solvers:[solver,...(oldAcme.solvers||[]).slice(1)]}}}));
}
export function issuerValidationLabel(profile:any){
 const spec=profile.manifest?.spec||{};
 if(spec.selfSigned)return 'Self signed';if(spec.ca)return 'CA';if(spec.vault)return 'Vault';if(spec.venafi)return 'Venafi';
 return profile.challenge==='dns01'?'DNS challenge':profile.challenge==='http01'?'HTTP challenge':'Other issuer';
}
