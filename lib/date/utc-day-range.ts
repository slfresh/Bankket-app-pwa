/** Inclusive UTC calendar day for filtering `timestamptz` columns. */
export function getUtcDayRangeIso(now: Date = new Date()): { startIso: string; endIso: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
