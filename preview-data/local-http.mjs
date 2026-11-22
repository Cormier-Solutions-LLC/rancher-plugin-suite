export function localRequestAllowed(request, proxyPort) {
  const {host, origin} = request.headers;
  const ports = [request.socket.localPort, proxyPort].filter(port => Number.isInteger(port) && port > 0 && port <= 65535);
  const local = ports.some(port => [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host));
  return local && request.headers['sec-fetch-site'] !== 'cross-site' && (!origin || origin === `http://${host}`);
}

export function requestUrl(target) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.includes('\\')) return null;
  try {
    const origin = 'http://127.0.0.1';
    const url = new URL(target, origin);
    return url.origin === origin ? url : null;
  } catch {
    return null;
  }
}
