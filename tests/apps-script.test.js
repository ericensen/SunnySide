const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadAppsScript(extraGlobals = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8");
  const context = {
    console,
    Logger: { log() {} },
    ...extraGlobals
  };

  vm.createContext(context);
  vm.runInContext(
    `${source}
globalThis.__sunny = {
  buildCampCapacityMap_,
  buildRegistrationRowsFromPayload_,
  createStripeCheckoutSession_,
  isEligibleCamperAge_,
  moneyText_,
  parseNumber_,
  rowValuesFromObject_
};`,
    context
  );

  return context;
}

function samplePayload(overrides = {}) {
  return {
    registrationId: "SSC-test-123",
    submittedAt: "2026-05-17T10:00:00.000Z",
    parentName: "Jamie Parent",
    email: "parent@example.com",
    phone: "801-555-0101",
    emergencyContact: "Morgan Backup",
    emergencyPhone: "801-555-0102",
    familyNotes: "Allergy note",
    waiverAccepted: true,
    signatureName: "Jamie Parent",
    signatureDate: "2026-05-17",
    kids: [
      { name: "Avery", age: "6", notes: "" },
      { name: "Riley", age: "9", notes: "Bring inhaler" }
    ],
    camps: [
      { slug: "arts-crafts", title: "Arts and Crafts Camp", shortDate: "June 24, 2026" },
      { slug: "carnival", title: "Carnival Camp", shortDate: "August 5, 2026" }
    ],
    seatCount: 4,
    totalDue: 120,
    ...overrides
  };
}

test("Apps Script age validator enforces ages 5 through 12", () => {
  const { __sunny } = loadAppsScript();

  assert.equal(__sunny.isEligibleCamperAge_("5"), true);
  assert.equal(__sunny.isEligibleCamperAge_("12"), true);
  assert.equal(__sunny.isEligibleCamperAge_("4"), false);
  assert.equal(__sunny.isEligibleCamperAge_("13"), false);
  assert.equal(__sunny.isEligibleCamperAge_("7.5"), false);
});

test("paid session creates one registration row per child per camp", () => {
  const { __sunny } = loadAppsScript();
  const rows = __sunny.buildRegistrationRowsFromPayload_(samplePayload(), {
    id: "cs_live_123",
    payment_status: "paid",
    amount_total: 12000,
    currency: "usd",
    payment_intent: "pi_123",
    customer_details: { email: "parent@example.com" }
  }, "confirmation_page");

  assert.equal(rows.length, 4);
  assert.deepEqual(
    Array.from(rows, (row) => `${row["Child Name"]} / ${row["Camp Title"]}`),
    [
      "Avery / Arts and Crafts Camp",
      "Riley / Arts and Crafts Camp",
      "Avery / Carnival Camp",
      "Riley / Carnival Camp"
    ]
  );
  assert.equal(rows[0]["Payment Status"], "paid");
  assert.equal(rows[0]["Seat Count"], 4);
  assert.equal(rows[0]["Total Due"], 120);
  assert.equal(rows[0]["Stripe Amount Total"], 120);
});

test("paid session with short payment is marked for amount review", () => {
  const { __sunny } = loadAppsScript();
  const rows = __sunny.buildRegistrationRowsFromPayload_(samplePayload(), {
    id: "cs_live_underpaid",
    payment_status: "paid",
    amount_total: 3000,
    currency: "usd",
    payment_intent: "pi_underpaid",
    customer_details: { email: "parent@example.com" }
  }, "confirmation_page");

  assert.equal(rows.length, 4);
  assert.equal(rows[0]["Payment Status"], "paid_amount_mismatch");
  assert.match(rows[0]["Reconciliation Notes"], /does not match/);
});

test("Stripe Checkout Session uses exact seat quantity and card-only payment", () => {
  let capturedRequest;
  const context = loadAppsScript({
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return key === "STRIPE_SECRET_KEY" ? "sk_live_test" : "";
          }
        };
      }
    },
    UrlFetchApp: {
      fetch(url, options) {
        capturedRequest = { url, options };

        return {
          getResponseCode() {
            return 200;
          },
          getContentText() {
            return JSON.stringify({
              id: "cs_live_123",
              url: "https://checkout.stripe.com/c/pay/cs_live_123"
            });
          }
        };
      }
    }
  });

  const session = context.__sunny.createStripeCheckoutSession_({
    registrationId: "SSC-exact",
    parentEmail: "parent@example.com",
    parentName: "Jamie Parent",
    seatCount: 4
  });

  assert.equal(session.id, "cs_live_123");
  assert.equal(capturedRequest.url, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(capturedRequest.options.method, "post");
  assert.equal(capturedRequest.options.payload["payment_method_types[0]"], "card");
  assert.equal(capturedRequest.options.payload["line_items[0][quantity]"], "4");
  assert.equal(capturedRequest.options.payload["line_items[0][price_data][unit_amount]"], "3000");
  assert.equal(capturedRequest.options.payload.client_reference_id, "SSC-exact");
  assert.match(capturedRequest.options.payload.success_url, /confirmation\.html\?session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(capturedRequest.options.payload.success_url, /registration_id=SSC-exact/);
});

test("camp capacity counts one seat per child per camp row", () => {
  const { __sunny } = loadAppsScript();
  const registrations = [];

  for (let index = 0; index < 20; index += 1) {
    registrations.push({
      "Registration ID": `SSC-${index}`,
      "Camp Slug": "arts-crafts",
      "Camp Title": "Arts and Crafts Camp",
      "Camp Date": "June 24, 2026",
      "Payment Status": "paid",
      "Total Due": 30,
      "Seat Count": 1,
      "Stripe Amount Total": 30
    });
  }

  registrations.push({
    "Registration ID": "SSC-carnival",
    "Camp Slug": "carnival",
    "Camp Title": "Carnival Camp",
    "Camp Date": "August 5, 2026",
    "Payment Status": "paid_amount_mismatch",
    "Total Due": 60,
    "Seat Count": 2,
    "Stripe Amount Total": 30
  });

  const summary = __sunny.buildCampCapacityMap_(registrations);

  assert.equal(summary["arts-crafts"].registeredSeats, 20);
  assert.equal(summary["arts-crafts"].paidSeats, 20);
  assert.equal(summary["arts-crafts"].remainingSpots, 0);
  assert.equal(summary["arts-crafts"].soldOut, true);
  assert.equal(summary.carnival.registeredSeats, 1);
  assert.equal(summary.carnival.followUpSeats, 1);
  assert.equal(summary.carnival.remainingSpots, 19);
});
