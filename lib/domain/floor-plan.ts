/** Default floor canvas position for table index 0, 1, … (4 columns). Matches SQL backfill in migrations. */
export function defaultFloorGridPosition(index: number): {
  floor_x: number;
  floor_y: number;
} {
  return {
    floor_x: 0.08 + (index % 4) * 0.24,
    floor_y: 0.08 + Math.floor(index / 4) * 0.22,
  };
}
