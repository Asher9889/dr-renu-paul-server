import { readFileSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const data = new Uint8Array(readFileSync("/tmp/test-book.pdf"));
const pdf = await getDocument({ data, useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise;
console.log("pages", pdf.numPages);
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1400 / base.width, 2000 / base.height);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  writeFileSync(`/tmp/page-${i}.png`, await canvas.encode("png"));
  console.log("rendered", i, canvas.width, canvas.height);
  page.cleanup();
}
await pdf.destroy();
