"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const files = ["server.js", "scripts/make-admin.js", "scripts/check-syntax.js", "../Frontend/storefront.js", "../Frontend/checkout.js", "../Frontend/js/main.js", "../Frontend/js/dashboard.js", "../Frontend/js/products.js", "../Frontend/customer-orders.js", "../Frontend/admin.js", "../Frontend/config.js"];
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", path.resolve(__dirname, "..", file)], { encoding: "utf8" });
  if (result.status !== 0) { failed = true; process.stderr.write(`FAIL ${file}\n${result.stderr || result.stdout}`); }
  else process.stdout.write(`PASS ${file}\n`);
}
if (failed) process.exit(1);
