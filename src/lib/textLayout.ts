import { StandardFontEmbedder, StandardFonts } from "pdf-lib";

export type TextGeometry = {
  text: string; width: number; height: number; fontSize: number;
  fontName?: string; preferredFontSize?: number; autoFit?: boolean; padding?: number;
};

export function matchingFont(name = "", bold = false, italic = false): string {
  const lower = name.toLowerCase();
  bold ||= /bold|black|semibold|demi/.test(lower);
  italic ||= /italic|oblique/.test(lower);
  if (/courier|mono|consolas/.test(lower)) return bold ? italic ? "Courier-BoldOblique" : "Courier-Bold" : italic ? "Courier-Oblique" : "Courier";
  if (/times|georgia|cambria|^serif$/.test(lower)) return bold ? italic ? "Times-BoldItalic" : "Times-Bold" : italic ? "Times-Italic" : "Times-Roman";
  return bold ? italic ? "Helvetica-BoldOblique" : "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica";
}

export function textFont(name?: string) {
  const chosen = name && Object.values(StandardFonts).includes(name as StandardFonts) ? name : "Helvetica";
  return StandardFontEmbedder.for(chosen as Parameters<typeof StandardFontEmbedder.for>[0]);
}

export function cssFont(name?: string) {
  return {
    fontFamily: name?.startsWith("Times") ? '"Times New Roman", Times, serif' : name?.startsWith("Courier") ? '"Courier New", monospace' : 'Arial, Helvetica, sans-serif',
    fontWeight: name?.includes("Bold") ? 700 : 400,
    fontStyle: /Italic|Oblique/.test(name ?? "") ? "italic" : "normal",
  };
}

// The same metrics determine fit, baseline and alignment on screen and in the PDF.
export function layoutText(item: TextGeometry) {
  const font = textFont(item.fontName);
  const padding = item.padding ?? (item.autoFit ? Math.min(item.height * 0.1, 2) : 8);
  const preferred = item.preferredFontSize ?? item.fontSize;
  let unitWidth: number;
  try { // PDF drawText emits a single Tj string, without pair-kerning adjustments.
    unitWidth = Array.from(item.text).reduce((width, character) => width + font.widthOfTextAtSize(character, 1), 0); }
  catch { unitWidth = Array.from(item.text).length * 0.65; }
  const ascent = Number(font.font.Ascender ?? font.font.FontBBox[3]) / 1000;
  const descent = Number(font.font.Descender ?? font.font.FontBBox[1]) / 1000;
  const size = item.autoFit ? Math.max(0.01, Math.min(preferred, Math.max(0.01, item.width - padding * 2) / (unitWidth || 1), Math.max(0.01, item.height - padding * 2) / (ascent - descent))) : item.fontSize;
  const baseline = item.autoFit ? (item.height - (ascent - descent) * size) / 2 + ascent * size : item.height / 2 + size * 0.35;
  return { size, padding, baseline, textWidth: unitWidth * size, fontName: font.fontName };
}

export function scaleText<T extends TextGeometry & { x: number; y: number }>(item: T, ratio: number): T {
  return { ...item, x: item.x * ratio, y: item.y * ratio, width: item.width * ratio, height: item.height * ratio, fontSize: item.fontSize * ratio,
    ...(item.preferredFontSize !== undefined ? { preferredFontSize: item.preferredFontSize * ratio } : {}),
    ...(item.padding !== undefined ? { padding: item.padding * ratio } : {}) };
}
