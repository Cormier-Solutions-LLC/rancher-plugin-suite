// An owner may have multiple types and multiple values in one DNS zone.
export const recordIdentity = record => JSON.stringify([record.name, record.type, record.value]);
