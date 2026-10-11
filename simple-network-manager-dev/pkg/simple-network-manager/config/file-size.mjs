// Decimal units keep the displayed KB/MB/GB labels consistent with byte counts.
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  while (bytes >= 1000 && index < units.length - 1) { bytes /= 1000; index++; }
  return `${index ? bytes.toFixed(1) : bytes} ${units[index]}`;
}
