/**
 * Original SmartFlowSocial Blastr mark.
 *
 * A navy rounded tile, a teal source dot, and three arcs opening to the right.
 * Drawn from this description. It is not a trace or recolor of any earlier icon.
 */

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAVY: Rgba = { r: 16, g: 32, b: 51, a: 255 };
const TEAL: Rgba = { r: 46, g: 196, b: 168, a: 255 };

const ICON_HEADERS = {
  "Cache-Control": "public, max-age=86400",
  "X-Content-Type-Options": "nosniff",
} as const;

export function renderFaviconSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="SmartFlowSocial Blastr">',
    '  <rect width="32" height="32" rx="7" fill="#102033"/>',
    '  <circle cx="9" cy="16" r="2.6" fill="#2EC4A8"/>',
    '  <path d="M13.5 12.2C16.2 13.2 16.2 18.8 13.5 19.8" fill="none" stroke="#2EC4A8" stroke-width="1.7" stroke-linecap="round"/>',
    '  <path d="M13.5 9.4C18.4 11 18.4 21 13.5 22.6" fill="none" stroke="#7DDFC8" stroke-width="1.7" stroke-linecap="round"/>',
    '  <path d="M13.5 6.6C21 8.8 21 23.2 13.5 25.4" fill="none" stroke="#D5F6EC" stroke-width="1.7" stroke-linecap="round"/>',
    "</svg>",
    "",
  ].join("\n");
}

export function renderFaviconIco(): Uint8Array {
  return encodeIco([
    { size: 16, rgba: paintIcon(16) },
    { size: 32, rgba: paintIcon(32) },
  ]);
}

export function faviconResponse(pathname: string): Response | null {
  if (pathname === "/favicon.svg") {
    return new Response(renderFaviconSvg(), {
      status: 200,
      headers: {
        ...ICON_HEADERS,
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    });
  }
  if (pathname === "/favicon.ico") {
    return new Response(renderFaviconIco(), {
      status: 200,
      headers: {
        ...ICON_HEADERS,
        "Content-Type": "image/x-icon",
      },
    });
  }
  return null;
}

function paintIcon(size: number): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = colorAt(x, y, size);
      if (!color) continue;
      const index = (y * size + x) * 4;
      rgba[index] = color.r;
      rgba[index + 1] = color.g;
      rgba[index + 2] = color.b;
      rgba[index + 3] = color.a;
    }
  }
  return rgba;
}

function colorAt(x: number, y: number, size: number): Rgba | null {
  if (!insideTile(x, y, size)) return null;
  if (inSourceDot(x, y, size) || onSignalArc(x, y, size)) return TEAL;
  return NAVY;
}

function insideTile(x: number, y: number, size: number): boolean {
  const radius = size * 0.22;
  const px = x + 0.5;
  const py = y + 0.5;
  const insetX = Math.min(Math.max(px, radius), size - radius);
  const insetY = Math.min(Math.max(py, radius), size - radius);
  return Math.hypot(px - insetX, py - insetY) <= radius;
}

function inSourceDot(x: number, y: number, size: number): boolean {
  const dx = x + 0.5 - size * 0.28;
  const dy = y + 0.5 - size * 0.5;
  return Math.hypot(dx, dy) <= size * 0.08;
}

function onSignalArc(x: number, y: number, size: number): boolean {
  const dx = x + 0.5 - size * 0.42;
  const dy = y + 0.5 - size * 0.5;
  if (dx < 0) return false;
  const distance = Math.hypot(dx, dy);
  const stroke = Math.max(1, size * 0.055);
  const radii = [size * 0.18, size * 0.3, size * 0.42];
  return radii.some((radius) => Math.abs(distance - radius) <= stroke / 2);
}

function encodeIco(
  images: readonly { size: number; rgba: Uint8Array }[],
): Uint8Array {
  const headerBytes = 6 + images.length * 16;
  const bitmaps = images.map((image) => encodeBitmap(image.size, image.rgba));
  const total =
    headerBytes + bitmaps.reduce((sum, bitmap) => sum + bitmap.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  let offset = headerBytes;
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const bitmap = bitmaps[index];
    if (!image || !bitmap) {
      throw new Error("Icon bitmap is missing");
    }
    const entry = 6 + index * 16;
    view.setUint8(entry, image.size);
    view.setUint8(entry + 1, image.size);
    view.setUint8(entry + 2, 0);
    view.setUint8(entry + 3, 0);
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, bitmap.length, true);
    view.setUint32(entry + 12, offset, true);
    out.set(bitmap, offset);
    offset += bitmap.length;
  }
  return out;
}

function encodeBitmap(size: number, rgba: Uint8Array): Uint8Array {
  const header = 40;
  const maskStride = Math.ceil(size / 32) * 4;
  const pixels = size * size * 4;
  const mask = size * maskStride;
  const out = new Uint8Array(header + pixels + mask);
  const view = new DataView(out.buffer);
  view.setUint32(0, header, true);
  view.setInt32(4, size, true);
  view.setInt32(8, size * 2, true);
  view.setUint16(12, 1, true);
  view.setUint16(14, 32, true);
  view.setUint32(16, 0, true);
  view.setUint32(20, pixels + mask, true);

  let cursor = header;
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      out[cursor] = channel(rgba, index + 2);
      out[cursor + 1] = channel(rgba, index + 1);
      out[cursor + 2] = channel(rgba, index);
      out[cursor + 3] = channel(rgba, index + 3);
      cursor += 4;
    }
  }

  for (let y = size - 1; y >= 0; y -= 1) {
    const row = out.subarray(cursor, cursor + maskStride);
    for (let x = 0; x < size; x += 1) {
      const alpha = channel(rgba, (y * size + x) * 4 + 3);
      if (alpha !== 0) continue;
      const byteIndex = Math.floor(x / 8);
      const current = row[byteIndex] ?? 0;
      row[byteIndex] = current | (0x80 >> (x % 8));
    }
    cursor += maskStride;
  }
  return out;
}

function channel(rgba: Uint8Array, index: number): number {
  const value = rgba[index];
  if (value === undefined) {
    throw new Error("Icon pixel is out of range");
  }
  return value;
}
