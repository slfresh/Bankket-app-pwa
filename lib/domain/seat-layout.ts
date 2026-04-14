/** Optional per-table L leg sizes from `banquet_tables.layout_config`. */
export type LShapeLayoutConfig = {
  l_legs?: [number, number, number];
};

export function parseLShapeLayoutConfig(raw: unknown): LShapeLayoutConfig | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const legs = o.l_legs;
  if (!Array.isArray(legs) || legs.length !== 3) return null;
  const a = Number(legs[0]);
  const b = Number(legs[1]);
  const c = Number(legs[2]);
  if (![a, b, c].every((n) => Number.isInteger(n) && n >= 0)) return null;
  return { l_legs: [a, b, c] };
}

/**
 * Split total seats into three legs of an L (top horizontal, outer vertical, bottom horizontal).
 * Uses `config.l_legs` when they sum to `total`; otherwise falls back to an even split.
 */
export function lShapeLegCounts(
  total: number,
  config?: LShapeLayoutConfig | null,
): [number, number, number] {
  if (total <= 0) return [0, 0, 0];
  const legs = config?.l_legs;
  if (
    legs &&
    legs.length === 3 &&
    legs.every((n) => Number.isInteger(n) && n >= 0) &&
    legs[0] + legs[1] + legs[2] === total
  ) {
    return [legs[0], legs[1], legs[2]];
  }
  const n1 = Math.ceil(total / 3);
  const rest = total - n1;
  const n2 = rest <= 0 ? 0 : Math.ceil(rest / 2);
  const n3 = total - n1 - n2;
  return [n1, n2, n3];
}
