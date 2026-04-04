export function upsertById<T extends { id: string }>(items: T[] | undefined, nextItem: T) {
  if (!items?.length) {
    return [nextItem];
  }

  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) {
    return [...items, nextItem];
  }

  const nextItems = [...items];
  nextItems[existingIndex] = nextItem;
  return nextItems;
}

export function removeById<T extends { id: string }>(items: T[] | undefined, itemId: string) {
  if (!items?.length) {
    return [];
  }

  return items.filter((item) => item.id !== itemId);
}
