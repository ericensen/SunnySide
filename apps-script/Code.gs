const SPREADSHEET_ID = "1zqINFZdhJjMSogbwOsgAM_FwUJgj3KwTnAy7n3NXmug";
const SHEET_NAME = "Registrations";
const STRIPE_SECRET_KEY_PROPERTY = "STRIPE_SECRET_KEY";
const INTEGRATION_TOKEN_PROPERTY = "SUNNYSIDE_INTEGRATION_TOKEN";
const REGISTRATION_HEADERS = [
  "Submitted At",
  "Registration ID",
  "Parent Name",
  "Email",
  "Phone",
  "Emergency Contact",
  "Emergency Phone",
  "Family Notes",
  "Camp Slug",
  "Camp Title",
  "Camp Date",
  "Child Name",
  "Child Age",
  "Child Notes",
  "Waiver Accepted",
  "Signature Name",
  "Signature Date",
  "Seat Count",
  "Total Due",
  "Payment Status",
  "Stripe Checkout Session ID",
  "Stripe Payment Intent ID",
  "Stripe Amount Total",
  "Stripe Currency",
  "Stripe Customer Email",
  "Paid At",
  "Confirmation Source",
  "Reconciliation Notes",
  "Last Updated At"
];

function doGet(e) {
  const action = getParameter_(e, "action");

  if (action === "status") {
    return handleStatusRequest_(e);
  }

  return outputJson_({
    ok: true,
    message: "SunnySide registration endpoint is running."
  });
}

function doPost(e) {
  try {
    const payload = parseJson_(e && e.postData ? e.postData.contents : "");

    if (isStripeEvent_(payload)) {
      return handleStripeEvent_(e, payload);
    }

    if (payload.eventType === "payment_confirmation") {
      return handlePaymentConfirmation_(payload);
    }

    return handleRegistrationSubmission_(payload);
  } catch (error) {
    return outputJson_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function handleRegistrationSubmission_(payload) {
  const context = getSheetContext_();
  const camps = Array.isArray(payload.camps) ? payload.camps : [];
  const kids = Array.isArray(payload.kids) ? payload.kids : [];
  const rows = [];
  const timestamp = payload.submittedAt || new Date().toISOString();

  camps.forEach(function (camp) {
    kids.forEach(function (kid) {
      rows.push(
        rowValuesFromObject_(
          {
            "Submitted At": timestamp,
            "Registration ID": payload.registrationId || "",
            "Parent Name": payload.parentName || "",
            Email: payload.email || "",
            Phone: payload.phone || "",
            "Emergency Contact": payload.emergencyContact || "",
            "Emergency Phone": payload.emergencyPhone || "",
            "Family Notes": payload.familyNotes || "",
            "Camp Slug": camp.slug || "",
            "Camp Title": camp.title || "",
            "Camp Date": camp.shortDate || "",
            "Child Name": kid.name || "",
            "Child Age": kid.age || "",
            "Child Notes": kid.notes || "",
            "Waiver Accepted": payload.waiverAccepted ? "Yes" : "No",
            "Signature Name": payload.signatureName || "",
            "Signature Date": payload.signatureDate || "",
            "Seat Count": payload.seatCount || "",
            "Total Due": payload.totalDue || "",
            "Payment Status": payload.paymentStatus || "pending",
            "Stripe Checkout Session ID": "",
            "Stripe Payment Intent ID": "",
            "Stripe Amount Total": "",
            "Stripe Currency": "",
            "Stripe Customer Email": "",
            "Paid At": "",
            "Confirmation Source": "",
            "Reconciliation Notes": "",
            "Last Updated At": timestamp
          },
          context.headers
        )
      );
    });
  });

  if (rows.length) {
    context.sheet
      .getRange(context.sheet.getLastRow() + 1, 1, rows.length, context.headers.length)
      .setValues(rows);
  }

  return outputJson_({
    ok: true,
    rowsWritten: rows.length,
    registrationId: payload.registrationId || ""
  });
}

function handlePaymentConfirmation_(payload) {
  const checkoutSessionId = payload.checkoutSessionId || payload.sessionId || "";

  if (!checkoutSessionId) {
    return outputJson_({
      ok: false,
      error: "Missing checkout session ID."
    });
  }

  const session = retrieveCheckoutSession_(checkoutSessionId);
  const registrationId = payload.registrationId || session.client_reference_id || "";

  if (!registrationId) {
    return outputJson_({
      ok: false,
      error: "Checkout session did not include a registration ID."
    });
  }

  const result = reconcilePayment_(registrationId, session, "confirmation_page");

  return outputJson_({
    ok: true,
    registrationId: registrationId,
    checkoutSessionId: session.id,
    paymentStatus: result.status,
    rowsUpdated: result.rowsUpdated
  });
}

function handleStripeEvent_(e, payload) {
  const expectedToken = getScriptProperty_(INTEGRATION_TOKEN_PROPERTY);
  const receivedToken = getParameter_(e, "token");

  if (expectedToken && expectedToken !== receivedToken) {
    return outputJson_({
      ok: false,
      error: "Invalid integration token."
    });
  }

  if (payload.type !== "checkout.session.completed") {
    return outputJson_({
      ok: true,
      handled: false,
      eventType: payload.type || ""
    });
  }

  const eventSession = payload.data && payload.data.object ? payload.data.object : null;

  if (!eventSession || !eventSession.id) {
    return outputJson_({
      ok: false,
      error: "Stripe event did not include a checkout session."
    });
  }

  const session = retrieveCheckoutSession_(eventSession.id);
  const registrationId = session.client_reference_id || eventSession.client_reference_id || "";

  if (!registrationId) {
    return outputJson_({
      ok: false,
      error: "Stripe checkout session did not include a registration ID."
    });
  }

  const result = reconcilePayment_(registrationId, session, "stripe_webhook");

  return outputJson_({
    ok: true,
    handled: true,
    registrationId: registrationId,
    paymentStatus: result.status,
    rowsUpdated: result.rowsUpdated
  });
}

function handleStatusRequest_(e) {
  const registrationId = getParameter_(e, "registrationId");

  if (!registrationId) {
    return outputJson_({
      ok: false,
      error: "Missing registrationId parameter."
    });
  }

  const context = getSheetContext_();
  const matches = findRegistrationRows_(context, registrationId);

  if (!matches.length) {
    return outputJson_({
      ok: false,
      error: "Registration ID not found."
    });
  }

  const firstRow = matches[0].row;

  return outputJson_({
    ok: true,
    registrationId: registrationId,
    paymentStatus: firstRow[context.index["Payment Status"]],
    stripeCheckoutSessionId: firstRow[context.index["Stripe Checkout Session ID"]],
    paidAt: firstRow[context.index["Paid At"]],
    notes: firstRow[context.index["Reconciliation Notes"]]
  });
}

function reconcilePayment_(registrationId, session, source) {
  const context = getSheetContext_();
  const matches = findRegistrationRows_(context, registrationId);
  const paymentStatus = session.payment_status || "unpaid";
  const now = new Date().toISOString();

  if (!matches.length) {
    return {
      status: "registration_not_found",
      rowsUpdated: 0
    };
  }

  const firstMatch = matches[0].row;
  const expectedTotal = parseNumber_(firstMatch[context.index["Total Due"]]);
  const stripeTotal = typeof session.amount_total === "number" ? session.amount_total / 100 : "";
  const status =
    paymentStatus === "paid" && expectedTotal && stripeTotal !== expectedTotal
      ? "paid_amount_mismatch"
      : paymentStatus;
  const notes =
    status === "paid_amount_mismatch"
      ? "Stripe amount does not match the expected registration total."
      : "";

  matches.forEach(function (match) {
    const row = match.row;

    row[context.index["Payment Status"]] = status;
    row[context.index["Stripe Checkout Session ID"]] = session.id || "";
    row[context.index["Stripe Payment Intent ID"]] = session.payment_intent || "";
    row[context.index["Stripe Amount Total"]] = stripeTotal;
    row[context.index["Stripe Currency"]] = session.currency || "";
    row[context.index["Stripe Customer Email"]] = getStripeCustomerEmail_(session);
    row[context.index["Paid At"]] = paymentStatus === "paid" ? now : "";
    row[context.index["Confirmation Source"]] = source;
    row[context.index["Reconciliation Notes"]] = notes;
    row[context.index["Last Updated At"]] = now;
  });

  writeUpdatedRows_(context, matches);

  return {
    status: status,
    rowsUpdated: matches.length
  };
}

function retrieveCheckoutSession_(sessionId) {
  const secretKey = getScriptProperty_(STRIPE_SECRET_KEY_PROPERTY);

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY script property.");
  }

  const response = UrlFetchApp.fetch(
    "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId),
    {
      method: "get",
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + secretKey
      }
    }
  );
  const statusCode = response.getResponseCode();
  const body = parseJson_(response.getContentText());

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("Stripe session lookup failed: " + (body.error && body.error.message || statusCode));
  }

  return body;
}

function findRegistrationRows_(context, registrationId) {
  const dataRowCount = Math.max(context.sheet.getLastRow() - 1, 0);
  const matches = [];

  if (!dataRowCount) {
    return matches;
  }

  const values = context.sheet.getRange(2, 1, dataRowCount, context.headers.length).getValues();
  const registrationColumn = context.index["Registration ID"];

  values.forEach(function (row, offset) {
    if (String(row[registrationColumn] || "") === registrationId) {
      matches.push({
        rowNumber: offset + 2,
        row: row
      });
    }
  });

  return matches;
}

function writeUpdatedRows_(context, matches) {
  matches.forEach(function (match) {
    context.sheet
      .getRange(match.rowNumber, 1, 1, context.headers.length)
      .setValues([match.row]);
  });
}

function getSheetContext_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const headers = ensureHeaders_(sheet);

  return {
    sheet: sheet,
    headers: headers,
    index: buildHeaderIndex_(headers)
  };
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(REGISTRATION_HEADERS);
    return REGISTRATION_HEADERS.slice();
  }

  const currentHeaders = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), REGISTRATION_HEADERS.length))
    .getValues()[0]
    .filter(function (header) {
      return String(header || "").trim() !== "";
    });
  const headers = currentHeaders.slice();

  REGISTRATION_HEADERS.forEach(function (header) {
    if (headers.indexOf(header) === -1) {
      headers.push(header);
    }
  });

  if (headers.length !== currentHeaders.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return headers;
}

function buildHeaderIndex_(headers) {
  const index = {};

  headers.forEach(function (header, column) {
    index[header] = column;
  });

  return index;
}

function rowValuesFromObject_(rowObject, headers) {
  return headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(rowObject, header) ? rowObject[header] : "";
  });
}

function getStripeCustomerEmail_(session) {
  if (session.customer_details && session.customer_details.email) {
    return session.customer_details.email;
  }

  return session.customer_email || "";
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || "";
}

function getParameter_(e, key) {
  return e && e.parameter && e.parameter[key] ? e.parameter[key] : "";
}

function isStripeEvent_(payload) {
  return Boolean(payload && payload.object === "event" && payload.type);
}

function parseJson_(text) {
  if (!text) {
    return {};
  }

  return JSON.parse(text);
}

function parseNumber_(value) {
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

function outputJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
