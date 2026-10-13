// Apply a narrow compatibility patch to pinned upstream v15.6.1 source.
// Full transfers avoid the observed 120-second Windows IXFR update delay.
import fs from 'node:fs';
const file='.local/dns-vendor/DnsServer/DnsServerCore/Dns/Zones/SecondaryZone.cs';
const before='bool doIXFR = !_isExpired && !_resync;';
const after=`// Operator-selected zones use AXFR; all other zones retain upstream behavior.
                bool forceAxfr = Array.Exists((Environment.GetEnvironmentVariable("DNS_MANAGER_AXFR_ZONES") ?? "")
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                    zone => zone.Equals(_name, StringComparison.OrdinalIgnoreCase));
                bool doIXFR = !_isExpired && !_resync && !forceAxfr;`;
const source=fs.readFileSync(file,'utf8');
if(source.includes(after))process.exit(0);
if(source.split(before).length!==2)throw new Error('Pinned upstream patch point changed; manual review required.');
fs.writeFileSync(file,source.replace(before,after));
