import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec=promisify(execFile);
const root=fileURLToPath(new URL('../../',import.meta.url));
const helm=process.env.HELM_BIN || (process.platform==='win32'?join(root,'.tools/helm/windows-amd64/helm.exe'):'helm');

test('Helm requires separately installed, enabled, compatible UIPlugin and does not embed it',async()=>{
  let dependency=null;
  const server=createServer((req,res)=>{
    let data;
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/version')data={major:'1',minor:'34',gitVersion:'v1.34.0'};
    else if(path==='/api')data={kind:'APIVersions',apiVersion:'v1',versions:['v1'],serverAddressByClientCIDRs:[]};
    else if(path==='/apis')data={kind:'APIGroupList',apiVersion:'v1',groups:[{name:'catalog.cattle.io',versions:[{groupVersion:'catalog.cattle.io/v1',version:'v1'}],preferredVersion:{groupVersion:'catalog.cattle.io/v1',version:'v1'}}]};
    else if(path==='/api/v1')data={kind:'APIResourceList',groupVersion:'v1',resources:[]};
    else if(path==='/apis/catalog.cattle.io/v1')data={kind:'APIResourceList',groupVersion:'catalog.cattle.io/v1',resources:[{name:'uiplugins',singularName:'uiplugin',namespaced:true,kind:'UIPlugin',verbs:['get','list']}]};
    else if(path.includes('/uiplugins/rancher-common-ui'))data=dependency;
    if(!data){res.writeHead(404,{'Content-Type':'application/json'}).end(JSON.stringify({kind:'Status',apiVersion:'v1',status:'Failure',reason:'NotFound',code:404}));return;}
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data));
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const temp=await mkdtemp(join(tmpdir(),'common-ui-helm-'));const config=join(temp,'config');
  assert.ok(temp.startsWith(join(tmpdir(),'common-ui-helm-')),'test cleanup remains in its temporary directory');
  await writeFile(config,`apiVersion: v1\nkind: Config\nclusters:\n- name: test\n  cluster:\n    server: http://127.0.0.1:${server.address().port}\ncontexts:\n- name: test\n  context:\n    cluster: test\n    user: test\ncurrent-context: test\nusers:\n- name: test\n  user: {}\n`);
  async function render(chart,offline=false){try{const result=await exec(helm,['template','test',join(root,'charts',chart),'--disable-openapi-validation','--namespace','cattle-ui-plugin-system','--set','plugin.endpoint=https://assets.example.invalid/extension','--kubeconfig',config,...(offline?['--set','commonUI.verifyInstalled=false']:['--dry-run=server'])],{windowsHide:true});return {ok:true,text:result.stdout};}catch(error){return {ok:false,text:error.stderr};}}
  try{
    const common=await render('rancher-common-ui',true);assert.equal(common.ok,true);assert.match(common.text,/name: rancher-common-ui/);assert.doesNotMatch(common.text,/kind: (Deployment|Secret|ClusterRole)/);
    for(const chart of ['simple-network-manager','dns-manager']){
      dependency=null;let result=await render(chart);assert.equal(result.ok,false);assert.match(result.text,/Install the separate rancher-common-ui/);
      dependency={apiVersion:'catalog.cattle.io/v1',kind:'UIPlugin',metadata:{name:'rancher-common-ui',annotations:{'common-ui.cormierconsulting.io/api-version':'1'}},spec:{plugin:{name:'rancher-common-ui',version:'1.0.0'}},status:{cacheState:'cached'}};
      result=await render(chart);assert.equal(result.ok,true,result.text);assert.equal((result.text.match(/kind: UIPlugin/g)||[]).length,1,'manager renders only itself');
      dependency.status.cacheState='disabled';result=await render(chart);assert.equal(result.ok,false);assert.match(result.text,/Enable the rancher-common-ui/);
      dependency.status.cacheState='cached';dependency.spec.plugin.version='2.0.0';result=await render(chart);assert.equal(result.ok,false);assert.match(result.text,/incompatible/);
      dependency.spec.plugin.version='1.0.0';dependency.metadata.annotations['common-ui.cormierconsulting.io/api-version']='2';result=await render(chart);assert.equal(result.ok,false);assert.match(result.text,/API version 1/);
    }
  }finally{await new Promise(done=>server.close(done));await rm(temp,{recursive:true,force:true});}
});
