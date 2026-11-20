import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const KNOWN_BLOBS = [
  "4b46f08b623e106055b9e9b3722b3c52a390f5ed",
  "2e664745182202306600f9f9496ec99801905159",
  "cb5c3b05273ca0e74ca38bb88d96efb5b627ce65",
  "d0c1b1e1f2bec8a2a73138c98a9f1dbabba5725b",
] as const;

function runCheck(args: string[]): { status: number; output: string } {
  try {
    const output = execFileSync(
      "node",
      ["scripts/check-source-provenance.mjs", ...args],
      { encoding: "utf8" },
    );
    return { status: 0, output };
  } catch (error) {
    const failed = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      status: failed.status ?? 1,
      output: `${failed.stdout ?? ""}\n${failed.stderr ?? ""}`,
    };
  }
}

describe("source provenance check", () => {
  it("records the four known copied blobs and finds none in this tree", () => {
    const script = readFileSync("scripts/check-source-provenance.mjs", "utf8");
    for (const hash of KNOWN_BLOBS) {
      expect(script).toContain(hash);
    }
    expect(existsSync("docs/images/blastr-diagram.png")).toBe(false);
    expect(existsSync("migrations/0000_events.sql")).toBe(false);
    expect(existsSync("migrations/0001_tag.sql")).toBe(false);

    const result = runCheck([]);
    expect(result.status).toBe(0);
    expect(result.output).toContain("does not prove copyright independence");
  });

  it("fails when a known copied phrase is reintroduced", () => {
    const root = mkdtempSync(join(tmpdir(), "blastr-provenance-"));
    try {
      const phrase = ["Mutiny", "blastr", "relay"].join(" ");
      writeFileSync(join(root, "note.md"), `copied ${phrase}\n`);
      const result = runCheck([`--root=${root}`]);
      expect(result.status).toBe(1);
      expect(result.output).toContain("note.md");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a forbidden blob hash is present", () => {
    const root = mkdtempSync(join(tmpdir(), "blastr-provenance-"));
    try {
      const bytes = Uint8Array.from("original-bytes-for-the-detector", (char) =>
        char.charCodeAt(0),
      );
      writeFileSync(join(root, "payload.bin"), bytes);
      const hash = createHash("sha1")
        .update(`blob ${String(bytes.byteLength)}\0`)
        .update(bytes)
        .digest("hex");
      const result = runCheck([`--root=${root}`, `--forbid-hash=${hash}`]);
      expect(result.status).toBe(1);
      expect(result.output).toContain(hash);
      expect(result.output).toContain("payload.bin");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
