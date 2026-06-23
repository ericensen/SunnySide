const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadCampData() {
  const context = {
    window: {}
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "scripts", "camp-data.js"), "utf8"),
    context
  );

  return context.window.SUNNYSIDE_DATA;
}

test("camp data exposes current price and age rules", () => {
  const data = loadCampData();

  assert.equal(data.pricePerKid, 30);
  assert.equal(data.maxOpenings, 20);
  assert.equal(data.minAge, 5);
  assert.equal(data.maxAge, 12);
  assert.equal(data.campTime, "10:00 AM - 1:00 PM");
  assert.deepEqual(
    Array.from(data.camps, (camp) => camp.time),
    Array(data.camps.length).fill("10:00 AM - 1:00 PM")
  );
});

test("camp lineup is ordered by current camp date", () => {
  const data = loadCampData();

  assert.deepEqual(
    Array.from(data.camps, (camp) => `${camp.title} - ${camp.shortDate}`),
    [
      "Arts and Crafts Camp - June 24, 2026",
      "Science & STEM Camp - July 1, 2026",
      "Cooking Camp - July 8, 2026",
      "Sports and Movement Camp - July 15, 2026",
      "Water Day Camp - July 22, 2026",
      "Hogwarts / Wizarding Camp - July 29, 2026",
      "Carnival Camp - August 5, 2026"
    ]
  );
});

test("checkout URL preserves selected camp slug", () => {
  const data = loadCampData();

  assert.equal(data.checkoutUrl("science-stem"), "checkout.html?camp=science-stem");
  assert.equal(data.checkoutUrl(), "checkout.html");
});
