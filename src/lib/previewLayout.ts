type Size = { width: number; height: number };

export function fitPreviewPage(page: Size, viewport: Size, padding = 12): number {
  return Math.max(0.001, Math.min(
    Math.max(1, viewport.width - padding * 2) / page.width,
    Math.max(1, viewport.height - padding * 2) / page.height,
  ));
}
