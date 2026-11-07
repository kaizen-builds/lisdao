import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const page = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/page.js"),
  "utf8"
);

test("root page is the real demo app, not a placeholder shell", () => {
  const lines = page.split(/\n/).length;
  assert.ok(lines > 300, `web/app/page.js should be the full app, not a short shell (${lines} lines)`);

  for (const marker of [
    "setupWalletSelector",
    "Create New Proposal",
    "lisdao-demo",
    "Spending limits",
    "PolicyCheck",
    "Live browser",
    "get_proposals",
    "Limits",
  ]) {
    assert.ok(page.includes(marker), `web/app/page.js is missing required UI: ${marker}`);
  }
});
