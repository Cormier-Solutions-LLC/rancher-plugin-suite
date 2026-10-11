export const rolloutExamples = [
  { id: 'web', name: 'Web Redirect Example', namespace: 'example-web', service: 'web-app', state: 'Applied · Example', before: 'HTTP 80 → Service 8080', after: 'HTTP 80 → HTTPS 443 → Service 8080', publications: 2 },
  { id: 'dns', name: 'DNS Port Bundle Example', namespace: 'example-dns', service: 'resolver', state: 'Applied · Example', before: 'TCP 53 → Service 53', after: 'TCP 53 + UDP 53 → Service 53', publications: 1 },
  { id: 'smb', name: 'SMB Configuration Example', namespace: 'example-storage', service: 'file-server', state: 'Rolled Back · Example', before: 'TCP 445 → Service 445', after: 'TCP 1445 → Service 445', publications: 3 }
];
