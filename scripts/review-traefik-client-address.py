import json,pathlib,yaml
root=pathlib.Path('.local/manager-installation')
def load(text):
    return {f"{x['kind']}/{x['metadata']['name']}":x for x in yaml.safe_load_all(text) if x}
def paths(a,b,path=''):
    if isinstance(a,dict) and isinstance(b,dict):
        return [p for k in sorted(a.keys()|b.keys()) for p in (paths(a[k],b[k],path+'/'+k) if k in a and k in b else [path+'/'+k])]
    return [path] if a!=b else []
old=load((root/'traefik-manifest-before-client-address-private.yaml').read_text(encoding='utf-8-sig'))
dry=json.loads((root/'traefik-client-address-dry-run-private.json').read_text(encoding='utf-8-sig'));new=load(dry['manifest'])
changed={k:paths(old[k],new[k]) for k in sorted(old.keys()&new.keys()) if old[k]!=new[k]}
assert old.keys()==new.keys(), 'Resource additions or removals need review'
assert changed=={'Service/traefik':['/spec/externalTrafficPolicy','/spec/loadBalancerIP'],'Service/traefik-udp':['/spec/externalTrafficPolicy','/spec/loadBalancerIP']}, changed
assert all(new[k]['metadata']['annotations']['metallb.io/loadBalancerIPs']=='10.99.15.50' and not new[k]['spec'].get('loadBalancerIP') for k in changed)
report={'reviewedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'onlyTrafficPolicyAndDuplicateAddressChanges':True,'canonicalVipPreserved':True,'changed':changed,'resourceAdditions':0,'resourceRemovals':0}
(root/'traefik-client-address-render-review.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
