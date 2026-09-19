export type PrintOrientation = "portrait" | "landscape";

type PreviewOptions = {
  title: string;
  body: string;
  orientation?: PrintOrientation;
  extraStyles?: string;
};

export function openPrintPreview({
  title,
  body,
  orientation = "portrait",
  extraStyles = "",
}: PreviewOptions) {
  const preview = window.open("", "_blank", "width=1120,height=900");

  if (!preview) {
    window.alert("Please allow pop-ups so the document preview can open.");
    return false;
  }

  preview.document.open();
  preview.document.write(buildPreviewDocument(title, body, orientation, extraStyles));
  preview.document.close();
  preview.focus();
  return true;
}

export function openHtmlDocumentPreview(
  title: string,
  html: string,
  orientation: PrintOrientation = "portrait"
) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script").forEach((script) => script.remove());
  const styles = Array.from(parsed.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n")
    .replaceAll(/(^|})\s*body\s*{/g, "$1 .document {");

  return openPrintPreview({
    title,
    body: parsed.body.innerHTML,
    orientation,
    extraStyles: styles,
  });
}

function buildPreviewDocument(
  title: string,
  body: string,
  orientation: PrintOrientation,
  extraStyles: string
) {
  const pageSize = orientation === "landscape" ? "A4 landscape" : "A4 portrait";
  const pageWidth = orientation === "landscape" ? "297mm" : "210mm";
  const pageMinHeight = orientation === "landscape" ? "210mm" : "297mm";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #e8edf2; color: #172b3d; font-family: Arial, sans-serif; }
    .preview-toolbar {
      position: sticky; top: 0; z-index: 20; min-height: 58px; padding: 9px 18px;
      display: flex; align-items: center; justify-content: space-between; gap: 15px;
      background: #123a59; color: #fff; box-shadow: 0 3px 12px rgba(0,0,0,.2);
    }
    .preview-brand { display: flex; align-items: center; gap: 10px; }
    .preview-mark { width: 35px; height: 35px; border-radius: 8px; display: grid; place-items: center; background: #0d79a8; font-weight: 900; }
    .preview-title { font-size: 13px; font-weight: 800; }
    .preview-hint { margin-top: 2px; color: #c9d9e5; font-size: 10px; }
    .preview-actions { display: flex; gap: 8px; }
    .preview-actions button { height: 36px; padding: 0 14px; border-radius: 7px; border: 1px solid #94aec1; background: #fff; color: #183950; font-weight: 800; cursor: pointer; }
    .preview-actions .primary { border-color: #198754; background: #198754; color: #fff; }
    .preview-stage { padding: 24px; overflow: auto; }
    .document {
      width: ${pageWidth}; min-height: ${pageMinHeight}; margin: 0 auto; padding: 14mm 15mm;
      background: #fff; color: #172b3d; box-shadow: 0 8px 30px rgba(27,49,66,.22); font-size: 11px;
    }
    .document-header { display: flex; justify-content: space-between; gap: 25px; padding-bottom: 12px; border-bottom: 3px solid #145f8c; }
    .property-name { color: #123a59; font-size: 23px; font-weight: 900; }
    .document-title { text-align: right; }
    .document-title h1 { margin: 0 0 5px; color: #145f8c; font-size: 19px; }
    .section { margin-top: 16px; break-inside: avoid; }
    .section-title { padding-bottom: 5px; border-bottom: 1px solid #bfcbd5; color: #145f8c; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .5px; }
    .row { display: flex; justify-content: space-between; gap: 20px; padding: 5px 0; font-size: 11px; }
    .large { font-size: 17px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { padding: 7px; border-bottom: 1px solid #dfe6ec; text-align: left; }
    th { background: #edf4f8; color: #274b65; font-size: 9px; text-transform: uppercase; }
    .right { text-align: right; }
    .totals { width: 330px; max-width: 100%; margin: 15px 0 0 auto; break-inside: avoid; }
    .bank, .footer { margin-top: 20px; padding-top: 9px; border-top: 1px solid #bdcbd6; font-size: 9px; line-height: 1.6; color: #52697b; }
    ${extraStyles}
    @page { size: ${pageSize}; margin: 0; }
    @media print {
      html, body { background: #fff; }
      .preview-toolbar { display: none !important; }
      .preview-stage { padding: 0; }
      .document { width: 100%; min-height: auto; padding: 12mm 14mm; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="preview-toolbar">
    <div class="preview-brand"><div class="preview-mark">N</div><div><div class="preview-title">NETPOS DOCUMENT PREVIEW</div><div class="preview-hint">A4 printable format · choose Save as PDF in the print dialog</div></div></div>
    <div class="preview-actions"><button onclick="window.close()">Close</button><button class="primary" onclick="window.print()">Print / Save PDF</button></div>
  </div>
  <main class="preview-stage"><article class="document">${body}</article></main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}
