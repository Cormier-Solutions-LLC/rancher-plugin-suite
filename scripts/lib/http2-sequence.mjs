import http2 from 'node:http2';

// Exercise multiple authorities on one TLS connection, as browsers do when
// two origins share an address and certificate. Never disable TLS validation.
export async function http2Sequence({target, port = 443, servername, authorities, ca}) {
  const session = http2.connect(`https://${target}:${port}`, {servername, ca});
  let connectionError;
  session.on('error', error => { connectionError = error; });
  const results = [];
  try {
    for (const authority of authorities) {
      if (connectionError) throw connectionError;
      const result = await new Promise((resolve, reject) => {
        let status, body = '', error;
        const request = session.request({':path': '/', ':authority': authority});
        const timer = setTimeout(() => {
          request.destroy();
          reject(Error('HTTP/2 request timed out'));
        }, 10000);
        request.on('response', headers => { status = headers[':status']; });
        request.on('data', data => { body += data; });
        request.on('error', failure => { error = failure.code || failure.message; });
        request.on('close', () => {
          clearTimeout(timer);
          resolve({authority, status, body, error});
        });
        request.end();
      });
      results.push(result);
    }
    return results;
  } finally {
    session.destroy();
  }
}
