/**
 * Canonical station-name key for menu membership and timetable matching.
 * Same rule everywhere: lower-case + trim.
 */
export function stationSearchKey(name: string): string {
  return name.toLowerCase().trim();
}
