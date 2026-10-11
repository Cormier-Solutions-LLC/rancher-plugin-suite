export function resolveBackendPort(selected: string, inbound: number, transport: string, ports: { name?: string; port: number; protocol: string }[]): string {
  const value = selected || String(inbound);
  if (!ports.some(port => port.protocol === transport && (port.name === value || String(port.port) === value))) {
    throw new Error(`The destination service does not expose ${value}/${transport}. Select an available service port.`);
  }
  return value;
}
