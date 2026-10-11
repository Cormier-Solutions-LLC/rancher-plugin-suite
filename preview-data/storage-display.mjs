export function formatExhaustion(storage, locale) {
  if (!storage) return 'Unavailable';
  if (storage.reason === 'Beyond Supported Date Range') return '∞';
  if (!storage.runOutAt) return storage.reason || 'Unavailable';
  const date = new Date(storage.runOutAt), cutoff = new Date(storage.measuredAt);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(cutoff.getTime())) return 'Unavailable';
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() + 1);
  return date > cutoff ? '∞' : date.toLocaleString(locale);
}
