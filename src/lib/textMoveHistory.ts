export type MovableText = {
  id: string; page: number; x: number; y: number;
  fieldName?: string; sourceFieldName?: string;
};

// Store document coordinates so Undo still works after zooming.
export function rememberTextMove(item: MovableText, scale: number): MovableText {
  return { id: item.id, page: item.page, x: item.x / scale, y: item.y / scale,
    fieldName: item.fieldName, sourceFieldName: item.sourceFieldName };
}

export function restoreTextMove<T extends MovableText>(item: T, previous: MovableText, scale: number): T {
  return { ...item, x: previous.x * scale, y: previous.y * scale,
    fieldName: previous.fieldName, sourceFieldName: previous.sourceFieldName };
}
