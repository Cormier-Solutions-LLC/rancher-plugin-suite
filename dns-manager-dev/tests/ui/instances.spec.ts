import {describe,it,expect,vi} from 'vitest';
import {markRaw} from 'vue';
import {getByRole,renderManager} from './harness';
import {defaultInventory} from '../../pkg/dns-manager/ui/default-inventory.js';

function liveSource(){
  const inventory:any=structuredClone(defaultInventory);
  inventory.source={...inventory.source,reachable:true,managementReachable:true};
  inventory.replicas=[0,1,2].map(id=>({
    id,address:`10.99.15.${55+id}`,reachable:id!==2,
    zones:inventory.zones.map((zone:any)=>({zone:zone.name,serial:Number(zone.serial),sourceSerial:Number(zone.serial),expired:false}))
  }));
  inventory.replicas[2].zones[0].expired=true;
  const state={version:1,drafts:[],logs:[],page:'instances',order:inventory.zones.map((zone:any)=>zone.id)};
  const document={data:{inventory,state}};
  return markRaw({document,capabilities:{},loadState:()=>state,saveState:vi.fn(),reload:vi.fn(async()=>document)});
}

describe('DNS instance navigation and management links',()=>{
  it('places Instances immediately after the visible zone entries',async()=>{
    const app=await renderManager('overview');
    const zoneGroup=app.root.querySelector('#dm-zone-navigation')!;
    expect(zoneGroup.querySelectorAll('[data-page^="zone:"]')).toHaveLength(defaultInventory.zones.length);
    expect(zoneGroup.nextElementSibling?.getAttribute('data-page')).toBe('instances');
    expect(zoneGroup.nextElementSibling?.textContent).toContain('Instances');
  });

  it('lists live replicas and opens each private Technitium interface through Rancher',async()=>{
    const app=await renderManager('instances',{previewShell:false,clusterName:'local',dataSource:liveSource()});
    expect(getByRole(app.root,'heading',{level:1,name:'Instances'})).toBeTruthy();
    expect(app.root.textContent).toContain('dns-manager-engine-0');
    expect(app.root.textContent).toContain('dns-manager-engine-2');
    expect(app.root.textContent).toContain('Unreachable');
    const links=[...app.root.querySelectorAll<HTMLAnchorElement>('a[aria-label^="Open Technitium management"]')];
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute('href')).toContain('/k8s/clusters/local/api/v1/namespaces/dns-system/services/http%3Adns-manager-api-0%3A5380/proxy/');
    expect(links.every(link=>link.target==='_blank'&&link.rel==='noopener noreferrer')).toBe(true);
  });

  it('shows the serving instances and per-zone serial state above a zone record grid',async()=>{
    const app=await renderManager('zone:io',{previewShell:false,clusterName:'local',dataSource:liveSource()});
    expect(getByRole(app.root,'heading',{level:2,name:/Instances/})).toBeTruthy();
    expect(app.root.textContent).toContain('Current · Serial');
    expect(app.root.textContent).toContain('Needs Attention · Serial');
    expect(app.root.querySelectorAll('a[aria-label^="Open Technitium management"]')).toHaveLength(3);
  });
});
