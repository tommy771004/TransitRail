/** An item taken out of a list, with the position it held, so undo can put it back. */
export interface RemovedItem<T> {
  item: T;
  index: number;
}

export function takeRemoved<T>(list: T[], remove: (item: T) => boolean): RemovedItem<T>[] {
  return list.flatMap((item, index) => (remove(item) ? [{ item, index }] : []));
}

/**
 * Put removed items back where they were.
 *
 * Undo restores into the list as it is now, not a snapshot from before the
 * removal: something added during the snackbar's few seconds (a new search, a
 * newly saved trip) survives the undo. An item already back in the list is left
 * alone, so a double tap cannot duplicate it.
 */
export function restoreRemoved<T extends { id: string }>(current: T[], removed: RemovedItem<T>[]): T[] {
  const next = [...current];
  for (const { item, index } of [...removed].sort((a, b) => a.index - b.index)) {
    if (next.some((candidate) => candidate.id === item.id)) continue;
    next.splice(Math.min(index, next.length), 0, item);
  }
  return next;
}
