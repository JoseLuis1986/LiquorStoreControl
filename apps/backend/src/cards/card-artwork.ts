import QRCode from 'qrcode';

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** QR vectorial con la zona muda de 4 módulos. Un PNG embebido no se imprime en Chrome. */
async function qrMarkup(payload: string, x: number, y: number, size: number) {
  const svg = await QRCode.toString(payload, {
    type: 'svg',
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#111111', light: '#ffffff' },
  });
  return svg.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const cleaned = attrs
      .replace(/\swidth="[^"]*"/g, '')
      .replace(/\sheight="[^"]*"/g, '');
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}"${cleaned}>`;
  });
}

/** Tarjeta CR80 (85.6 × 53.98 mm) lista para imprimir en PVC. */
export async function buildCardSvg(input: {
  storeName: string;
  code: string;
  customerName: string;
  payload: string;
}) {
  const qr = await qrMarkup(input.payload, 496, 100, 320);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="85.6mm" height="53.98mm" viewBox="0 0 856 540">
  <rect width="856" height="540" rx="28" fill="#ffffff"/>
  <rect x="8" y="8" width="840" height="524" rx="22" fill="none" stroke="#111111" stroke-width="6"/>
  <text x="40" y="78" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#5c4a32">${esc(input.storeName)}</text>
  <text x="40" y="168" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="#111111">${esc(input.customerName)}</text>
  <text x="40" y="230" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#333333">${esc(input.code)}</text>
  <text x="40" y="300" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#111111">Consumo en el local</text>
  <text x="40" y="470" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#555555">Escanear para despachar unidades</text>
  ${qr}
</svg>`;
}
