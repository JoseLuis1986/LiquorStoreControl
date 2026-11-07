/**
 * Abstracción de impresión de comprobantes.
 *
 * Flujos soportados:
 * 1. Ventana del navegador (`window.print`) — default, compatible con impresoras
 *    térmicas vía drivers del SO.
 * 2. Web Serial (Chrome) — envío ESC/POS crudo a puerto serie/USB-serial.
 *
 * Ver también `docs` en README: WebUSB/Bluetooth requieren HTTPS y permiso del usuario.
 */

export type PrinterCapability = {
  browserPrint: boolean;
  webSerial: boolean;
};

export function getPrinterCapabilities(): PrinterCapability {
  return {
    browserPrint: typeof window !== 'undefined' && typeof window.print === 'function',
    webSerial: typeof navigator !== 'undefined' && 'serial' in navigator,
  };
}

/** Abre el HTML del comprobante (ruta relativa API) e imprime. */
export async function printReceiptHtml(
  htmlUrl: string,
  token: string,
): Promise<void> {
  const res = await fetch(htmlUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`No se pudo cargar comprobante (${res.status})`);
  const html = await res.text();
  const w = window.open('', '_blank', 'noopener,noreferrer,width=480,height=720');
  if (!w) throw new Error('El navegador bloqueó la ventana de impresión');
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 300);
}

/** Envía bytes ESC/POS por Web Serial si el usuario elige un puerto. */
export async function printEscPosViaSerial(data: Uint8Array): Promise<void> {
  const nav = navigator as Navigator & {
    serial?: {
      requestPort: () => Promise<{
        open: (opts: { baudRate: number }) => Promise<void>;
        writable: WritableStream<Uint8Array> | null;
        close: () => Promise<void>;
      }>;
    };
  };
  if (!nav.serial) {
    throw new Error('Web Serial no disponible en este navegador');
  }
  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 9600 });
  if (!port.writable) {
    await port.close();
    throw new Error('Puerto serie no escribible');
  }
  const writer = port.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
    await port.close();
  }
}

/** Texto simple → bytes ESC/POS mínimos (init + texto + corte). */
export function textToEscPos(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const body = encoder.encode(text);
  const init = new Uint8Array([0x1b, 0x40]);
  const cut = new Uint8Array([0x1d, 0x56, 0x00]);
  const out = new Uint8Array(init.length + body.length + cut.length);
  out.set(init, 0);
  out.set(body, init.length);
  out.set(cut, init.length + body.length);
  return out;
}
