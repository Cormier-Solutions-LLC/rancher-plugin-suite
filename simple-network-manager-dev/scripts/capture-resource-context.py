"""Read only non-secret ownership and namespace classification metadata."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'pkg/simple-network-manager/data'
def get(kind):
    return json.loads(subprocess.check_output(['kubectl', 'get', kind, '-A', '-o', 'json'], text=True, encoding='utf8'))['items']

owners = {}
for kind in ['ingresses', 'ingressroutes.traefik.io', 'ingressroutetcps.traefik.io', 'ingressrouteudps.traefik.io', 'certificates.cert-manager.io']:
    for resource in get(kind):
        meta = resource['metadata']
        annotations = meta.get('annotations', {})
        owners[f"{resource['kind']}/{meta.get('namespace', '')}/{meta['name']}"] = {
            'owners': [{'kind': ref['kind'], 'name': ref['name']} for ref in meta.get('ownerReferences', [])],
            'release': annotations.get('meta.helm.sh/release-name', ''),
            'releaseNamespace': annotations.get('meta.helm.sh/release-namespace', meta.get('namespace', ''))
        }
(root / 'resource-owner-snapshot.json').write_text(json.dumps(owners, indent=2), encoding='utf8')
system_names = ['cattle-dashboards','cattle-global-data','cattle-system','gatekeeper-system','ingress-nginx','kube-node-lease','kube-public','kube-system','linkerd','security-scan','tekton-pipelines','compliance-operator-system','istio-system','longhorn-system']
projects = {p['metadata']['name']: p.get('spec', {}).get('displayName') == 'System' for p in get('projects.management.cattle.io')}
namespaces = []
for ns in get('namespaces'):
    meta = ns['metadata']; name = meta['name']; ann = meta.get('annotations', {})
    project = ann.get('field.cattle.io/projectId', '')
    is_system = ann.get('field.cattle.io/system-namespace') == 'true' or name in system_names or name.startswith('cattle-') and name.endswith('-system') or projects.get(project.split(':')[-1], False)
    namespaces.append({'name': name, 'labels': meta.get('labels', {}), 'project': project, 'isSystem': bool(is_system)})
(root / 'namespace-snapshot.json').write_text(json.dumps({'namespaces': namespaces}, indent=2), encoding='utf8')
print(f'Captured ownership references and classification for {len(namespaces)} namespaces; no Secret objects read.')
