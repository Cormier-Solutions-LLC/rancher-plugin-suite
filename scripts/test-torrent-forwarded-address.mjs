import fs from 'node:fs';import assert from 'node:assert/strict';import https from 'node:https';import {randomUUID} from 'node:crypto';import {execFile,execFileSync} from 'node:child_process';
const dir='.local/manager-installation',name='manager-torrent-address-probe',id=randomUUID(),base='http://127.0.0.1:15888',owned=[];
const resources=[
 ['/api/v1/namespaces/torrent/services',{apiVersion:'v1',kind:'Service',metadata:{name,namespace:'torrent',labels:{'manager-acceptance-id':id}},spec:{selector:{'app.kubernetes.io/name':'torrent'},ports:[{name:'probe',port:18090,targetPort:18090}]}}],
 ['/apis/networking.k8s.io/v1/namespaces/torrent/networkpolicies',{apiVersion:'networking.k8s.io/v1',kind:'NetworkPolicy',metadata:{name,namespace:'torrent',labels:{'manager-acceptance-id':id}},spec:{podSelector:{matchLabels:{'app.kubernetes.io/name':'torrent'}},policyTypes:['Ingress'],ingress:[{from:[{namespaceSelector:{matchLabels:{'kubernetes.io/metadata.name':'traefik-system'}},podSelector:{matchLabels:{'app.kubernetes.io/name':'traefik'}}}],ports:[{port:18090,protocol:'TCP'}]}]}}],
 ['/apis/traefik.io/v1alpha1/namespaces/torrent/ingressroutes',{apiVersion:'traefik.io/v1alpha1',kind:'IngressRoute',metadata:{name,namespace:'torrent',labels:{'manager-acceptance-id':id}},spec:{entryPoints:['websecure'],routes:[{kind:'Rule',match:'Host(`torrent.cormierconsulting.io`) && Path(`/manager-address-probe-'+id+'`)',priority:10000,services:[{name,port:18090}]}],tls:{secretName:'torrent-tls'}}}]
];
const ledgerPath=dir+'/torrent-address-probe-owned.json';assert.ok(!fs.existsSync(ledgerPath)||JSON.parse(fs.readFileSync(ledgerPath)).cleanedAt,'Reconcile prior probe first');
const ledger={id,intentAt:new Date().toISOString(),owned};function save(){fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));}
save();let child;
const firewall=['INPUT','-p','tcp','--dport','18090','-s','10.77.0.0/16','-m','comment','--comment',id,'-j','ACCEPT'];
function firewallRule(action){return execFileSync('C:/Program Files/Docker/Docker/resources/bin/kubectl.exe',['-n','torrent','exec','deployment/torrent','-c','gluetun','--','iptables',action,...firewall],{timeout:15000,stdio:['ignore','pipe','pipe']});}
try{
 for(const [url,manifest]of resources){assert.equal((await fetch(base+url+'/'+name)).status,404);const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(manifest)});assert.equal(r.status,201);const obj=await r.json();owned.push({url:url+'/'+name,uid:obj.metadata.uid});save();}
 ledger.firewallIntentAt=new Date().toISOString();save();firewallRule('-I');ledger.firewallAddedAt=new Date().toISOString();save();
 const code='import http.server,json\nclass Handler(http.server.BaseHTTPRequestHandler):\n def do_GET(self):\n  value={"peer":self.client_address[0],"forwardedFor":self.headers.get("X-Forwarded-For"),"forwardedProto":self.headers.get("X-Forwarded-Proto"),"forwardedHost":self.headers.get("X-Forwarded-Host"),"host":self.headers.get("Host")}; data=json.dumps(value).encode(); self.send_response(200); self.end_headers(); self.wfile.write(data)\n def log_message(self,*args): pass\nserver=http.server.HTTPServer(("0.0.0.0",18090),Handler); server.timeout=60; server.handle_request(); server.server_close()';
 const ended=new Promise((resolve,reject)=>{child=execFile('C:/Program Files/Docker/Docker/resources/bin/kubectl.exe',['-n','torrent','exec','deployment/torrent','-c','qbittorrent','--','python3','-c',code],{timeout:75000},(err,stdout,stderr)=>err?reject(new Error('Own header probe process failed')):resolve());});ended.catch(()=>{});
 let value;
 for(let attempt=0;attempt<12&&!value;attempt++){
  await new Promise(r=>setTimeout(r,1000));
  const result=await new Promise((resolve,reject)=>{const req=https.request({host:'torrent.cormierconsulting.io',port:443,path:'/manager-address-probe-'+id,lookup:(_h,_o,cb)=>cb(null,[{address:'10.99.15.50',family:4}]),rejectUnauthorized:true,timeout:5000},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Probe request timed out')));req.end();}).catch(()=>null);
  if(result?.status===200)value=JSON.parse(result.text);
 }
 assert.ok(value,'Own probe did not receive an HTTPS request');await ended;ledger.result=value;save();console.log(JSON.stringify(value));
}finally{
 if(ledger.firewallIntentAt){let exists=false;try{firewallRule('-C');exists=true;}catch{}if(exists)firewallRule('-D');ledger.firewallRemovedAt=new Date().toISOString();save();}
 for(const item of [...owned].reverse()){const current=await fetch(base+item.url);if(current.status===404)continue;const obj=await current.json();assert.equal(obj.metadata.uid,item.uid);const r=await fetch(base+item.url,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiVersion:'v1',kind:'DeleteOptions',preconditions:{uid:item.uid}})});assert.ok([200,202].includes(r.status));}
 ledger.cleanedAt=new Date().toISOString();save();if(child&&!child.killed)child.kill();
}
