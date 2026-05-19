const assert = require("node:assert/strict");
const test = require("node:test");

const checkoutLogic = require("../scripts/checkout-logic.js");

const camps = [
  { slug: "arts-crafts" },
  { slug: "science-stem" },
  { slug: "carnival" }
];
const kids = [
  { name: "Avery", age: "6" },
  { name: "Riley", age: "9" }
];

test("calculates seats as selected camps times registered kids", () => {
  assert.equal(checkoutLogic.calculateSeatCount([camps[0]], [kids[0]]), 1);
  assert.equal(checkoutLogic.calculateSeatCount([camps[0], camps[2]], [kids[0]]), 2);
  assert.equal(checkoutLogic.calculateSeatCount([camps[0], camps[1]], kids), 4);
  assert.equal(checkoutLogic.calculateSeatCount([], kids), 0);
  assert.equal(checkoutLogic.calculateSeatCount(camps, []), 0);
});

test("calculates total due from exact seat count", () => {
  assert.equal(checkoutLogic.calculateTotalDue(1, 30), 30);
  assert.equal(checkoutLogic.calculateTotalDue(2, 30), 60);
  assert.equal(checkoutLogic.calculateTotalDue(4, 30), 120);
  assert.equal(checkoutLogic.calculateTotalDue(0, 30), 0);
});

test("accepts only whole-number ages from 5 through 12", () => {
  assert.equal(checkoutLogic.isEligibleAge("5", 5, 12), true);
  assert.equal(checkoutLogic.isEligibleAge("12", 5, 12), true);
  assert.equal(checkoutLogic.isEligibleAge(8, 5, 12), true);
  assert.equal(checkoutLogic.isEligibleAge("4", 5, 12), false);
  assert.equal(checkoutLogic.isEligibleAge("13", 5, 12), false);
  assert.equal(checkoutLogic.isEligibleAge("7.5", 5, 12), false);
  assert.equal(checkoutLogic.isEligibleAge("", 5, 12), false);
  assert.equal(checkoutLogic.isEligibleAge("banana", 5, 12), false);
});

test("returns all children with out-of-range ages", () => {
  assert.deepEqual(
    checkoutLogic.getIneligibleChildren(
      [
        { name: "Too young", age: "4" },
        { name: "Valid", age: "10" },
        { name: "Too old", age: "13" }
      ],
      5,
      12
    ).map((kid) => kid.name),
    ["Too young", "Too old"]
  );
});

test("blocks camp selections when requested seats exceed remaining capacity", () => {
  const soldOut = checkoutLogic.getSoldOutSelections(camps, kids, (slug) => {
    const remainingBySlug = {
      "arts-crafts": 2,
      "science-stem": 1,
      carnival: 20
    };

    return { remainingSpots: remainingBySlug[slug], soldOut: false };
  });

  assert.deepEqual(soldOut.map((camp) => camp.slug), ["science-stem"]);
});

test("blocks camps explicitly marked sold out even with remaining spots", () => {
  const soldOut = checkoutLogic.getSoldOutSelections([camps[2]], [kids[0]], () => ({
    remainingSpots: 10,
    soldOut: true
  }));

  assert.deepEqual(soldOut.map((camp) => camp.slug), ["carnival"]);
});

test("allows capacity when requested seats exactly match remaining spots", () => {
  const soldOut = checkoutLogic.getSoldOutSelections([camps[0]], kids, () => ({
    remainingSpots: 2,
    soldOut: false
  }));

  assert.deepEqual(soldOut, []);
});
