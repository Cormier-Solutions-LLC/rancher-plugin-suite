export function formatCountdown(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.min(5999, Math.max(0, Math.ceil(seconds))) : 0;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
