/**
 * Fail before Wrangler can open a browser. Prints names, never secret values.
 */
const token = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? "";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
const missing = [];
if (!token) missing.push("CLOUDFLARE_API_TOKEN");
if (!accountId) missing.push("CLOUDFLARE_ACCOUNT_ID");

if (missing.length > 0) {
  console.error(
    `Cloudflare deployment preflight failed before Wrangler ran. Missing: ${missing.join(", ")}. This is an authentication configuration failure, not an application build failure. Interactive OAuth will not be started, and no other account will be selected.`,
  );
  process.exit(2);
}

if (token.length < 20 || !/^[a-f0-9]{32}$/i.test(accountId)) {
  console.error(
    "Cloudflare deployment preflight failed before Wrangler ran. CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is present but not usable. Values were not printed. This is not an application build failure.",
  );
  process.exit(2);
}

console.log(
  "Cloudflare credentials are present. This check did not deploy and did not select a different account.",
);
