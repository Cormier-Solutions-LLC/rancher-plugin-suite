import { commonUIAssets } from '../../rancher-common-ui/preview/vite-plugin.mjs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { projectMockData } from '../../preview-data/vite-plugin.mjs';
import { localSnapshotService } from '../../preview-data/snapshot-service.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const session=resolve(root,'.local/dns-standards-audit',randomUUID());
await mkdir(resolve(session,'data'),{recursive:true});
const source=JSON.parse(await readFile(resolve(root,'preview-data/data/dns-manager.json'),'utf8'));
source.revision=0; source.data.state={...source.data.state,version:1,page:'overview',order:source.data.inventory.zones.map(zone=>zone.id),drafts:[],logs:[],snapshots:[],preferences:{namespaceFilters:[],banners:{preview:false}}};
await writeFile(resolve(session,'data/dns-manager.json'),JSON.stringify(source,null,2));
process.env.RANCHER_SUITE_PREVIEW_SESSION=session;
console.log(`Isolated DNS audit source: ${session}`);
export default defineConfig({root:resolve(root,'dns-manager-dev/preview'),
  plugins:[commonUIAssets(),projectMockData({pluginId:'dns-manager',file:resolve(session,'data/dns-manager.json')}),
    localSnapshotService({pluginId:'dns-manager',folder:'dns-manager-dev',port:5195}),vue()],
  resolve:{dedupe:['vue']},server:{host:'127.0.0.1',port:5194,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:5195'}}}});
