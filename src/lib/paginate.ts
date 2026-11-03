/** Pagination helpers for the Data table. */

/** nearest date <= iso within an ascending iso list (null when iso precedes all) */
export function nearestEarlierIso(isosAsc: string[], iso: string): string | null {
  let best: string | null = null
  for (const d of isosAsc) {
    if (d <= iso && (best === null || d > best)) best = d
  }
  return best
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage))
}
