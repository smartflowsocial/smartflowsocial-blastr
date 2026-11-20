import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  faviconResponse,
  renderFaviconIco,
  renderFaviconSvg,
} from "../../src/brand/icon";

const COPIED_FAVICON_BLOB = "d0c1b1e1f2bec8a2a73138c98a9f1dbabba5725b";
const MUTINY_PINK = "226,58,94";

function gitBlobSha1(bytes: Uint8Array): string {
  return createHash("sha1")
    .update(`blob ${String(bytes.byteLength)}\0`)
    .update(bytes)
    .digest("hex");
}

function readBytes(path: string): Uint8Array {
  const data: unknown = readFileSync(path);
  if (!(data instanceof Uint8Array)) {
    throw new Error("Expected a byte file");
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function opaqueColors(ico: Uint8Array): Set<string> {
  const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
  const count = view.getUint16(4, true);
  const colors = new Set<string>();
  for (let image = 0; image < count; image += 1) {
    const entry = 6 + image * 16;
    const size = view.getUint8(entry);
    const length = view.getUint32(entry + 8, true);
    const offset = view.getUint32(entry + 12, true);
    const dib = ico.subarray(offset, offset + length);
    const header = new DataView(
      dib.buffer,
      dib.byteOffset,
      dib.byteLength,
    ).getUint32(0, true);
    for (let pixel = 0; pixel < size * size; pixel += 1) {
      const index = header + pixel * 4;
      const blue = dib[index];
      const green = dib[index + 1];
      const red = dib[index + 2];
      const alpha = dib[index + 3];
      if (
        red === undefined ||
        green === undefined ||
        blue === undefined ||
        alpha === undefined ||
        alpha < 200
      ) {
        continue;
      }
      colors.add(`${red},${green},${blue}`);
    }
  }
  return colors;
}

describe("original Blastr icon", () => {
  it("matches the committed svg and ico files", async () => {
    const svg = faviconResponse("/favicon.svg");
    const ico = faviconResponse("/favicon.ico");
    expect(svg).not.toBeNull();
    expect(ico).not.toBeNull();
    if (!svg || !ico) return;
    expect(svg.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(ico.headers.get("Content-Type")).toBe("image/x-icon");
    expect(svg.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await svg.text()).toBe(readFileSync("static/favicon.svg", "utf8"));
    expect(new Uint8Array(await ico.arrayBuffer())).toEqual(
      readBytes("static/favicon.ico"),
    );
  });

  it("uses the navy and teal mark and not the previous pink icon", () => {
    const svg = renderFaviconSvg();
    expect(svg).toContain("#102033");
    expect(svg).toContain("#2EC4A8");
    expect(svg).not.toContain("#E23A5E");

    const ico = renderFaviconIco();
    const colors = opaqueColors(ico);
    expect(colors.has("16,32,51")).toBe(true);
    expect(colors.has("46,196,168")).toBe(true);
    expect(colors.has(MUTINY_PINK)).toBe(false);

    expect(gitBlobSha1(ico)).not.toBe(COPIED_FAVICON_BLOB);
    expect(
      new DataView(ico.buffer, ico.byteOffset, ico.byteLength).getUint16(
        4,
        true,
      ),
    ).toBe(2);
  });

  it("leaves non-icon paths to the router", () => {
    expect(faviconResponse("/health")).toBeNull();
    expect(faviconResponse("/")).toBeNull();
  });
});
