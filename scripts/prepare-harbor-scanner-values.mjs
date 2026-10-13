import fs from 'node:fs';import assert from 'node:assert/strict';
const base='http://127.0.0.1:15888';async function get(name){const r=await fetch(base+'/api/v1/namespaces/harbor/secrets/'+name);assert.equal(r.status,200);return (await r.json()).data;}
const core=await get('harbor-core'),registry=await get('harbor-registry-htpasswd');
const decode=(d,k)=>{assert.ok(d[k]);return Buffer.from(d[k],'base64').toString();};
const values={trivy:{enabled:true},core:{tokenKey:decode(core,'tls.key'),tokenCert:decode(core,'tls.crt')},registry:{credentials:{htpasswdString:decode(registry,'REGISTRY_HTPASSWD')}}};
fs.writeFileSync('.local/manager-installation/harbor-scanner-values-private.json',JSON.stringify(values),{mode:0o600});console.log('Scanner override prepared with existing token certificate and registry credential hash preserved.');
