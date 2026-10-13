import fs from 'node:fs';
import path from 'node:path';
const directory=process.argv[2]||'.local/traefik-vendor';
const file=path.join(directory,'pkg/server/server_entrypoint_udp.go');
let source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const before=`func (eps UDPEntryPoints) Switch(handlers map[string]udp.Handler) {
	for epName, handler := range handlers {`;
const after=`func (eps UDPEntryPoints) Switch(handlers map[string]udp.Handler) {
	// DNS/Network Manager compatibility: removed UDP routes must clear old handlers.
	for epName, ep := range eps {
		if _, exists := handlers[epName]; !exists {
			ep.Switch(nil)
		}
	}
	for epName, handler := range handlers {`;
if(source.includes(after))console.log('UDP compatibility patch already present.');
else{if(source.split(before).length!==2)throw new Error('Unexpected upstream UDP switch implementation; review before patching.');fs.writeFileSync(file,source.replace(before,after));console.log('Missing UDP handlers are cleared on configuration replacement.');}
