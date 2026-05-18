const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const jsFiles = [
  "scripts/asset-loader.js",
  "scripts/camp.js",
  "scripts/camp-data.js",
  "scripts/capacity.js",
  "scripts/checkout.js",
  "scripts/checkout-logic.js",
  "scripts/confirmation.js",
  "scripts/main.js",
  "scripts/site-config.js",
  "apps-script/Code.gs"
];

test("JavaScript and Apps Script files parse", () => {
  jsFiles.forEach((filePath) => {
    const absolutePath = path.join(__dirname, "..", filePath);
    const source = fs.readFileSync(absolutePath, "utf8");

    assert.doesNotThrow(() => new Function(source), filePath);
  });
});
