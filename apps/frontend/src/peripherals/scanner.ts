/**
 * Lectores de código de barras / QR.
 *
 * 1. **Keyboard wedge** (recomendado en POS): el lector se comporta como teclado.
 *    Escucha Enter al final del scan y captura el buffer.
 * 2. **WebUSB**: stub experimental — requiere descriptor del dispositivo.
 *
 * Uso típico: `attachKeyboardWedgeListener(inputEl, onScan)`.
 */

export type ScanHandler = (code: string) => void;

export function attachKeyboardWedgeListener(
  target: HTMLElement | Document,
  onScan: ScanHandler,
  opts: { minLength?: number; maxGapMs?: number } = {},
): () => void {
  const minLength = opts.minLength ?? 4;
  const maxGapMs = opts.maxGapMs ?? 80;
  let buffer = '';
  let lastKeyAt = 0;

  const onKeyDown = (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const now = Date.now();
    if (now - lastKeyAt > maxGapMs) buffer = '';
    lastKeyAt = now;

    if (e.key === 'Enter') {
      if (buffer.length >= minLength) {
        e.preventDefault();
        onScan(buffer);
      }
      buffer = '';
      return;
    }
    if (e.key.length === 1) {
      buffer += e.key;
    }
  };

  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}

export type UsbScannerCapability = {
  webUsb: boolean;
};

export function getScannerCapabilities(): UsbScannerCapability {
  return {
    webUsb: typeof navigator !== 'undefined' && 'usb' in navigator,
  };
}

/**
 * Solicita un dispositivo USB (permiso del usuario). No interpreta HID:
 * documenta el punto de extensión para drivers específicos.
 */
export async function requestUsbScannerDevice(): Promise<{
  vendorId: number;
  productId: number;
  productName?: string;
} | null> {
  const nav = navigator as Navigator & {
    usb?: {
      requestDevice: (opts: {
        filters: unknown[];
      }) => Promise<{
        vendorId: number;
        productId: number;
        productName?: string;
      }>;
    };
  };
  if (!nav.usb) return null;
  const device = await nav.usb.requestDevice({ filters: [] });
  return {
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName,
  };
}
