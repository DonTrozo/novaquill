import { PDFDocument, StandardFonts, degrees, rgb, LineCapStyle } from "pdf-lib";
import { pagePlacement, signaturePlacement, type ViewportSize } from "./pdfPlacement";
import { inkPath, type InkStroke } from "./documentInk";
import type { TextElement } from "../components/DocumentFillLayer";

export async function buildSignedPdf({ pdfBytes, sigDataUrl, page, x, y, width, signatureHeight, rotation, textElements, pdfViewportSize, pdfViewportSizes, inkStrokes = [] }: {
  inkStrokes?: InkStroke[];
  pdfBytes: Uint8Array;
  sigDataUrl: string | null;
  page: number; x: number; y: number; width: number; signatureHeight: number; rotation: number;
  textElements: TextElement[];
  pdfViewportSize?: ViewportSize | null;
  pdfViewportSizes: Record<number, ViewportSize>;
}) {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const viewportFor = (pageNumber: number) => pdfViewportSizes[pageNumber] || (pageNumber === page ? pdfViewportSize : null);

    textElements.forEach((item) => {
      const text = item.text.trim();
      const target = pages[item.page - 1];
      if (!target) throw new Error("The text belongs to a page that no longer exists");
      const map = pagePlacement(target, viewportFor(item.page));
      if (item.fieldName) {
        const field = pdfDoc.getForm().getTextField(item.fieldName);
        field.setText(text);
        field.acroField.setDefaultAppearance(`${field.acroField.getDefaultAppearance() ?? ""}\n0 g`);
        field.setFontSize(item.fontSize * map.sy);
        field.updateAppearances(font);
        return;
      }
      if (!text) return;
      const baseline = map.point(item.x + 8, item.y + item.height / 2 + item.fontSize * 0.35);
      target.drawText(text, {
        ...baseline,
        size: item.fontSize * map.sy,
        rotate: degrees(map.angle),
        font,
        color: rgb(0, 0, 0),
      });
    });

    for (const stroke of inkStrokes) {
      if (!stroke.points.length) continue;
      const target = pages[stroke.page - 1];
      if (!target) throw new Error("The handwriting belongs to a page that no longer exists");
      const map = pagePlacement(target, stroke.viewport);
      const origin = map.point(0, 0);
      const hex = stroke.color.replace("#", "");
      if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error("Invalid ink colour");
      const color = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
      if (stroke.points.length === 1) {
        const point = map.point(stroke.points[0]!.x, stroke.points[0]!.y);
        target.drawCircle({ ...point, size: stroke.width * map.sx / 2, color });
      } else {
        target.drawSvgPath(inkPath(stroke.points), { ...origin, scale: map.sx, rotate: degrees(map.angle), borderColor: color, borderWidth: stroke.width, borderLineCap: LineCapStyle.Round });
      }
    }

    if (sigDataUrl) {
      const imageBytes = await fetch(sigDataUrl).then((response) => {
        if (!response.ok) throw new Error("Failed to read signature image");
        return response.arrayBuffer();
      });
      const image = /^data:image\/jpe?g[;,]/i.test(sigDataUrl)
        ? await pdfDoc.embedJpg(imageBytes)
        : await pdfDoc.embedPng(imageBytes);
      const target = pages[page - 1];
      if (!target) throw new Error("The signature belongs to a page that no longer exists");
      const placement = signaturePlacement(target, viewportFor(page), { x, y, width, height: signatureHeight, rotation });
      target.drawImage(image, {
        x: placement.x, y: placement.y,
        width: placement.width, height: placement.height,
        rotate: degrees(placement.angle),
      });
    }

    try {
      pdfDoc.getForm().flatten();
    } catch {
      // Ignore PDFs without AcroForm fields.
    }

    return pdfDoc.save();
}
