const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
 ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const key = record => JSON.stringify([record.name, record.type, record.value, record.ttl, canonical(record)]);

// Windows enumeration order is not DNS configuration. Preserve every value,
// duplicate, TTL and extra field while making capture and review deterministic.
export function orderedDnsRecords(records) {
 const copy = records.map(canonical);
 return copy.sort((left, right) => { const a=key(left),b=key(right);return a<b?-1:a>b?1:0; });
}
export function normalizeDnsConfiguration(config) {
 if(config?.kind!=='DnsZone'||!Array.isArray(config.dns?.records))return config;
 const zone=config.dns.zone;
 return {...config,dns:{...config.dns,records:orderedDnsRecords(config.dns.records),
  ...(Array.isArray(zone?.delegationRecords)?{zone:{...zone,delegationRecords:orderedDnsRecords(zone.delegationRecords)}}:{})}};
}
