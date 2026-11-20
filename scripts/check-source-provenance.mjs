/**
 * Fail if known Mutiny Wallet Blastr blobs or distinctive copied phrases
 * reappear in this tree.
 *
 * A clean result does not prove that the repository is free of copied
 * expression. It only checks the markers recorded in docs/SOURCE_PROVENANCE.md.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FORBIDDEN_BLOBS = new Map([
  [
    "4b46f08b623e106055b9e9b3722b3c52a390f5ed",
    "docs/images/blastr-diagram.png",
  ],
  ["2e664745182202306600f9f9496ec99801905159", "migrations/0000_events.sql"],
  ["cb5c3b05273ca0e74ca38bb88d96efb5b627ce65", "migrations/0001_tag.sql"],
  ["d0c1b1e1f2bec8a2a73138c98a9f1dbabba5725b", "static/favicon.ico"],
]);

const FORBIDDEN_PHRASES = [
  "Mutiny blastr relay",
  "team@mutinywallet.com",
  "git+https://github.com/MutinyWallet/blastr.git",
  "df173277182f3155d37b330211ba1de4a81500c02d195e964f91be774ec96708",
  "Migration number: 0000",
  "Migration number: 0001",
  "nostr-events-pub-1-b",
  "NWC_REQUESTS",
  "NWC_RESPONSES",
];

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "coverage",
  "dist",
  "build",
  ".wrangler",
]);

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".ts",
  ".mjs",
  ".js",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".sql",
  ".svg",
  ".txt",
  ".html",
]);

const ALLOWED_PHRASE_FILES = new Set([
  "scripts/check-source-provenance.mjs",
  "docs/SOURCE_PROVENANCE.md",
  "THIRD_PARTY_NOTICES.md",
]);

function gitBlobSha1(bytes) {
  const header = `blob ${bytes.length}\0`;
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function walk(directory, files) {
  for (const name of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(name)) continue;
    const fullPath = join(directory, name);
    const info = statSync(fullPath);
    if (info.isDirectory()) {
      walk(fullPath, files);
    } else if (info.isFile()) {
      files.push(fullPath);
    }
  }
}

function toRepoPath(root, fullPath) {
  return relative(root, fullPath).split(sep).join("/");
}

function extensionOf(repoPath) {
  const dot = repoPath.lastIndexOf(".");
  return dot === -1 ? "" : repoPath.slice(dot);
}

export function scanSourceTree(root, extraForbiddenBlobs = []) {
  const files = [];
  walk(root, files);
  const blobHits = [];
  const phraseHits = [];
  const forbidden = new Map(FORBIDDEN_BLOBS);
  for (const hash of extraForbiddenBlobs) {
    forbidden.set(hash, "extra hash supplied to this run");
  }

  for (const fullPath of files) {
    const repoPath = toRepoPath(root, fullPath);
    const bytes = readFileSync(fullPath);
    const hash = gitBlobSha1(bytes);
    if (forbidden.has(hash)) {
      blobHits.push({
        path: repoPath,
        hash,
        expectedPath: forbidden.get(hash),
      });
    }
    if (
      ALLOWED_PHRASE_FILES.has(repoPath) ||
      !TEXT_EXTENSIONS.has(extensionOf(repoPath))
    ) {
      continue;
    }
    const text = bytes.toString("utf8");
    for (const phrase of FORBIDDEN_PHRASES) {
      if (text.includes(phrase)) {
        phraseHits.push({ path: repoPath, phrase });
      }
    }
  }

  return {
    scannedFiles: files.length,
    blobHits,
    phraseHits,
  };
}

function parseArgs(argv) {
  let root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
  const extraForbiddenBlobs = [];
  for (const arg of argv) {
    if (arg.startsWith("--root=")) {
      root = arg.slice("--root=".length);
    } else if (arg.startsWith("--forbid-hash=")) {
      extraForbiddenBlobs.push(arg.slice("--forbid-hash=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { root, extraForbiddenBlobs };
}

function report(result) {
  const problems = result.blobHits.length + result.phraseHits.length;
  if (problems === 0) {
    console.info(
      `Source provenance check scanned ${result.scannedFiles} files. Known copied blobs and phrases are absent. This does not prove copyright independence.`,
    );
    return 0;
  }
  console.error(
    `Source provenance check found ${problems} problem(s) in ${result.scannedFiles} files.`,
  );
  for (const hit of result.blobHits) {
    console.error(
      `copied blob ${hit.hash} at ${hit.path} (known as ${hit.expectedPath})`,
    );
  }
  for (const hit of result.phraseHits) {
    console.error(`copied phrase at ${hit.path}: ${hit.phrase}`);
  }
  return 1;
}

const invokedDirectly = Boolean(
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href,
);

if (invokedDirectly) {
  try {
    const { root, extraForbiddenBlobs } = parseArgs(process.argv.slice(2));
    process.exit(report(scanSourceTree(root, extraForbiddenBlobs)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
