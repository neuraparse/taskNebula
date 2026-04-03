interface TreePage {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  icon: string | null;
  projectId: string | null;
  currentRevision: number;
  updatedAt: string | Date;
  position?: number;
}

export function buildDocumentTree<T extends TreePage>(pages: T[]) {
  const byId = new Map<string, T & { children: Array<T & { children: any[] }> }>();
  const roots: Array<T & { children: any[] }> = [];

  const sortedPages = [...pages].sort((left, right) => {
    const positionDelta = (left.position ?? 0) - (right.position ?? 0);
    if (positionDelta !== 0) {
      return positionDelta;
    }
    return left.title.localeCompare(right.title);
  });

  for (const page of sortedPages) {
    byId.set(page.id, { ...page, children: [] });
  }

  for (const page of sortedPages) {
    const node = byId.get(page.id)!;
    if (page.parentId && byId.has(page.parentId)) {
      byId.get(page.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
