import json,pathlib,yaml
root=pathlib.Path('.local/manager-installation')
def resources(name):
    return {f"{x['kind']}/{x['metadata']['name']}":x for x in yaml.safe_load_all((root/name).read_text(encoding='utf-8-sig')) if x}
def paths(a,b,path=''):
    if isinstance(a,dict) and isinstance(b,dict):
        return [p for k in sorted(a.keys()|b.keys()) for p in (paths(a[k],b[k],path+'/'+k) if k in a and k in b else [path+'/'+k])]
    if a!=b:return [path]
    return []
a=resources('harbor-manifest-before-private.yaml');b=resources('harbor-scanner-render-private.yaml')
report={'added':sorted(b.keys()-a.keys()),'removed':sorted(a.keys()-b.keys()),'changed':{k:paths(a[k],b[k]) for k in sorted(a.keys()&b.keys()) if a[k]!=b[k]}}
(root/'harbor-scanner-render-review.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
