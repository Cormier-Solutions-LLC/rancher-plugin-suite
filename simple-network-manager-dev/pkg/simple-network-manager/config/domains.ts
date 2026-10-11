function hostname(value: string) {
  return value.length <= 253 && value.split('.').every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(label));
}
export function buildHostnames(baseDomain: string, subdomains: string): string[] {
  const base = baseDomain.trim().toLowerCase();
  if (!base.includes('.') || !hostname(base)) throw new Error('Enter a valid base domain, such as example.com, without a URL or path.');
  const names = subdomains.split(/[\s,;]+/).map(name => name.trim().toLowerCase()).filter(Boolean);
  if (!names.length) return [base, `www.${base}`].filter((name, index, all) => all.indexOf(name) === index).map(name => {
    if (!hostname(name)) throw new Error('The resulting hostname is too long.');
    return name;
  });
  return [...new Set(names.map(name => {
    if (name === '@') return base;
    if (!hostname(name) || name === base || name.endsWith(`.${base}`)) throw new Error('Enter relative subdomains, such as app or api.eu. Use @ for the base domain.');
    const fullName = `${name}.${base}`;
    if (!hostname(fullName)) throw new Error('The resulting hostname is too long.');
    return fullName;
  }))];
}
