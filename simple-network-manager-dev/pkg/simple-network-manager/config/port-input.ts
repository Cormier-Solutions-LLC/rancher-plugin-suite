export function parsePortInput(input: string): number[] {
  const tokens = input.split(/[,\n]+/).map(token => token.trim()).filter(Boolean);
  if (!tokens.length) throw new Error('Enter one or more ports, such as 80,443 or 8000-8010.');
  const values = new Set<number>();
  for (const token of tokens) {
    const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(token);
    if (!match) throw new Error(`Invalid port input: ${token}. Use comma-separated numbers or ranges.`);
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end > 65535 || start > end) throw new Error('Ports must be between 1 and 65535, with each range in ascending order.');
    if (end - start + 1 > 1024) throw new Error('A preview configuration supports up to 1024 ports. Use a smaller range.');
    for (let port = start; port <= end; port++) values.add(port);
    if (values.size > 1024) throw new Error('A preview configuration supports up to 1024 ports.');
  }
  return [...values].sort((a, b) => a - b);
}
