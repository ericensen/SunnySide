const SPREADSHEET_ID = "1zqINFZdhJjMSogbwOsgAM_FwUJgj3KwTnAy7n3NXmug";
const SHEET_NAME = "Registrations";
const CAMP_SUMMARY_SHEET_NAME = "Camp Summary";
const PAYMENT_FOLLOW_UP_SHEET_NAME = "Payment Follow Up";
const DEFAULT_CAMP_CAPACITY = 20;
const ADMIN_NOTIFICATION_EMAIL = "sunnysidesummercamper@gmail.com";
const CAMP_CONTACT_EMAIL = "sunnysidesummercamper@gmail.com";
const CAMP_CONTACT_PHONE = "(801) 230-1068";
const CAMP_ADDRESS = "551 W Cephus Road, Draper UT 80420";
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
  "Parent Email Status",
  "Admin Email Status",
  "Email Last Attempt At",
  "Reconciliation Notes",
  "Last Updated At"
];

function doGet(e) {
  const action = getParameter_(e, "action");

  if (action === "confirm_payment") {
    return handlePaymentConfirmationRequest_(e);
  }

  if (action === "capacity") {
    return handleCapacityRequest_(e);
  }

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
  const capacityMap = buildCampCapacityMap_(getRegistrationObjects_(context));
  const requestedSeatsPerCamp = kids.length;
  const soldOutCamps = camps.filter(function (camp) {
    const status = getCampCapacityStatus_(capacityMap, camp.slug || "");
    return requestedSeatsPerCamp > status.remainingSpots;
  });

  if (!camps.length || !kids.length) {
    return outputJson_({
      ok: false,
      error: "At least one camp and one child are required."
    });
  }

  if (soldOutCamps.length) {
    return outputJson_({
      ok: false,
      error:
        "One or more selected camps are sold out: " +
        soldOutCamps
          .map(function (camp) {
            return camp.title || camp.slug || "Selected camp";
          })
          .join(", "),
      soldOutCamps: soldOutCamps.map(function (camp) {
        return camp.slug || "";
      })
    });
  }

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
            "Payment Status": "pending",
            "Stripe Checkout Session ID": "",
            "Stripe Payment Intent ID": "",
            "Stripe Amount Total": "",
            "Stripe Currency": "",
            "Stripe Customer Email": "",
            "Paid At": "",
            "Confirmation Source": "",
            "Parent Email Status": "",
            "Admin Email Status": "",
            "Email Last Attempt At": "",
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

  refreshReportingSheets_();
  sendRegistrationEmailsSafely_(payload);

  return outputJson_({
    ok: true,
    rowsWritten: rows.length,
    registrationId: payload.registrationId || ""
  });
}

function handlePaymentConfirmationRequest_(e) {
  const callback = getParameter_(e, "callback");
  const payload = {
    checkoutSessionId: getParameter_(e, "checkoutSessionId") || getParameter_(e, "session_id"),
    registrationId: getParameter_(e, "registrationId") || getParameter_(e, "registration_id")
  };

  return outputJsonOrJsonp_(confirmPayment_(payload, "confirmation_page"), callback);
}

function confirmPayment_(payload, source) {
  const checkoutSessionId = payload.checkoutSessionId || payload.sessionId || "";

  if (!checkoutSessionId) {
    return {
      ok: false,
      error: "Missing checkout session ID."
    };
  }

  const session = retrieveCheckoutSession_(checkoutSessionId);
  const registrationId = payload.registrationId || session.client_reference_id || "";

  if (!registrationId) {
    return {
      ok: false,
      error: "Checkout session did not include a registration ID."
    };
  }

  const result = reconcilePayment_(registrationId, session, source || "confirmation_page");

  return {
    ok: true,
    registrationId: registrationId,
    checkoutSessionId: session.id,
    paymentStatus: result.status,
    rowsUpdated: result.rowsUpdated
  };
}

function handleStripeEvent_(e, payload) {
  const expectedToken = getScriptProperty_(INTEGRATION_TOKEN_PROPERTY);
  const receivedToken = getParameter_(e, "token");

  if (!expectedToken) {
    return outputJson_({
      ok: false,
      error: "Missing SUNNYSIDE_INTEGRATION_TOKEN script property."
    });
  }

  if (expectedToken !== receivedToken) {
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
  const registrationId = getParameter_(e, "registrationId") || getParameter_(e, "registration_id");
  const callback = getParameter_(e, "callback");

  if (!registrationId) {
    return outputJsonOrJsonp_({
      ok: false,
      error: "Missing registrationId parameter."
    }, callback);
  }

  const context = getSheetContext_();
  const matches = findRegistrationRows_(context, registrationId);

  if (!matches.length) {
    return outputJsonOrJsonp_({
      ok: false,
      error: "Registration ID not found."
    }, callback);
  }

  const firstRow = matches[0].row;

  return outputJsonOrJsonp_({
    ok: true,
    registrationId: registrationId,
    paymentStatus: firstRow[context.index["Payment Status"]],
    stripeCheckoutSessionId: firstRow[context.index["Stripe Checkout Session ID"]],
    paidAt: firstRow[context.index["Paid At"]],
    notes: firstRow[context.index["Reconciliation Notes"]]
  }, callback);
}

function handleCapacityRequest_(e) {
  const callback = getParameter_(e, "callback");
  const context = getSheetContext_();
  const capacity = buildCampCapacityMap_(getRegistrationObjects_(context));

  return outputJsonOrJsonp_({
    ok: true,
    defaultCapacity: DEFAULT_CAMP_CAPACITY,
    capacity: capacity
  }, callback);
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
  refreshReportingSheets_();

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

function refreshReportingSheets_() {
  const context = getSheetContext_();
  const registrations = getRegistrationObjects_(context);

  rebuildCampSummarySheet_(context.sheet.getParent(), registrations);
  rebuildPaymentFollowUpSheet_(context.sheet.getParent(), registrations);
}

function getRegistrationObjects_(context) {
  const dataRowCount = Math.max(context.sheet.getLastRow() - 1, 0);

  if (!dataRowCount) {
    return [];
  }

  const values = context.sheet.getRange(2, 1, dataRowCount, context.headers.length).getValues();

  return values.map(function (row) {
    return rowObjectFromValues_(row, context.headers);
  });
}

function rebuildCampSummarySheet_(spreadsheet, registrations) {
  const sheet = getOrCreateSheet_(spreadsheet, CAMP_SUMMARY_SHEET_NAME);
  const headers = [
    "Camp Title",
    "Camp Date",
    "Registered Seats",
    "Paid Seats",
    "Pending / Follow Up Seats",
    "Families",
    "Paid Revenue",
    "Expected Revenue",
    "Remaining Spots",
    "Status"
  ];
  const summaryByCamp = buildCampCapacityMap_(registrations);
  const rows = [];

  Object.keys(summaryByCamp)
    .sort(function (left, right) {
      const leftSummary = summaryByCamp[left];
      const rightSummary = summaryByCamp[right];
      const leftDate = sortableText_(leftSummary.date);
      const rightDate = sortableText_(rightSummary.date);
      const leftTitle = sortableText_(leftSummary.title);
      const rightTitle = sortableText_(rightSummary.title);

      if (leftDate === rightDate) {
        return leftTitle.localeCompare(rightTitle);
      }

      return leftDate.localeCompare(rightDate);
    })
    .forEach(function (campKey) {
      const summary = summaryByCamp[campKey];

      rows.push([
        summary.title,
        summary.date,
        summary.registeredSeats,
        summary.paidSeats,
        summary.followUpSeats,
        Object.keys(summary.families).length,
        roundCurrency_(summary.paidRevenue),
        roundCurrency_(summary.expectedRevenue),
        summary.remainingSpots,
        summary.status
      ]);
    });

  writeReportSheet_(sheet, headers, rows);
  formatCampSummarySheet_(sheet, rows.length);
}

function rebuildPaymentFollowUpSheet_(spreadsheet, registrations) {
  const sheet = getOrCreateSheet_(spreadsheet, PAYMENT_FOLLOW_UP_SHEET_NAME);
  const headers = [
    "Submitted At",
    "Registration ID",
    "Parent Name",
    "Email",
    "Phone",
    "Camp Days",
    "Children",
    "Seat Count",
    "Total Due",
    "Payment Status",
    "Last Updated At",
    "Reconciliation Notes"
  ];
  const followUpByRegistration = {};
  const rows = [];

  registrations.forEach(function (registration) {
    const paymentStatus = String(registration["Payment Status"] || "").toLowerCase();
    const registrationId = registration["Registration ID"] || "";

    if (!registrationId || paymentStatus === "paid") {
      return;
    }

    if (!followUpByRegistration[registrationId]) {
      followUpByRegistration[registrationId] = {
        submittedAt: registration["Submitted At"] || "",
        registrationId: registrationId,
        parentName: registration["Parent Name"] || "",
        email: registration["Email"] || "",
        phone: registration["Phone"] || "",
        campTitles: {},
        childNames: {},
        seatCount: parseNumber_(registration["Seat Count"]),
        totalDue: parseNumber_(registration["Total Due"]),
        paymentStatus: registration["Payment Status"] || "",
        lastUpdatedAt: registration["Last Updated At"] || "",
        notes: registration["Reconciliation Notes"] || ""
      };
    }

    const followUp = followUpByRegistration[registrationId];

    if (registration["Camp Title"]) {
      followUp.campTitles[registration["Camp Title"]] = true;
    }

    if (registration["Child Name"]) {
      followUp.childNames[registration["Child Name"]] = true;
    }

    followUp.notes = followUp.notes || registration["Reconciliation Notes"] || "";
    followUp.lastUpdatedAt = registration["Last Updated At"] || followUp.lastUpdatedAt;
  });

  Object.keys(followUpByRegistration)
    .sort(function (left, right) {
      return sortableText_(followUpByRegistration[right].submittedAt).localeCompare(
        sortableText_(followUpByRegistration[left].submittedAt)
      );
    })
    .forEach(function (registrationId) {
      const followUp = followUpByRegistration[registrationId];

      rows.push([
        followUp.submittedAt,
        followUp.registrationId,
        followUp.parentName,
        followUp.email,
        followUp.phone,
        Object.keys(followUp.campTitles).join(", "),
        Object.keys(followUp.childNames).join(", "),
        followUp.seatCount,
        roundCurrency_(followUp.totalDue),
        followUp.paymentStatus,
        followUp.lastUpdatedAt,
        followUp.notes
      ]);
    });

  writeReportSheet_(sheet, headers, rows);
  formatPaymentFollowUpSheet_(sheet, rows.length);
}

function buildCampCapacityMap_(registrations) {
  const summaryByCamp = {};

  registrations.forEach(function (registration) {
    const slug = registration["Camp Slug"] || "";
    const campKey = slug || [registration["Camp Date"], registration["Camp Title"]].join(" | ");

    if (!summaryByCamp[campKey]) {
      summaryByCamp[campKey] = {
        slug: slug,
        title: registration["Camp Title"] || "",
        date: registration["Camp Date"] || "",
        registeredSeats: 0,
        paidSeats: 0,
        followUpSeats: 0,
        families: {},
        paidRevenue: 0,
        expectedRevenue: 0,
        remainingSpots: DEFAULT_CAMP_CAPACITY,
        soldOut: false,
        status: "Open"
      };
    }

    const summary = summaryByCamp[campKey];
    const paymentStatus = String(registration["Payment Status"] || "").toLowerCase();
    const expectedRevenue = parseNumber_(registration["Total Due"]);
    const paidRevenue = parseNumber_(registration["Stripe Amount Total"]);

    summary.registeredSeats += 1;

    if (registration["Registration ID"]) {
      summary.families[registration["Registration ID"]] = true;
    }

    if (paymentStatus === "paid") {
      summary.paidSeats += 1;
    } else {
      summary.followUpSeats += 1;
    }

    if (expectedRevenue) {
      summary.expectedRevenue += expectedRevenue / Math.max(parseNumber_(registration["Seat Count"]), 1);
    }

    if (paidRevenue) {
      summary.paidRevenue += paidRevenue / Math.max(parseNumber_(registration["Seat Count"]), 1);
    }
  });

  Object.keys(summaryByCamp).forEach(function (campKey) {
    const summary = summaryByCamp[campKey];

    summary.remainingSpots = Math.max(DEFAULT_CAMP_CAPACITY - summary.registeredSeats, 0);
    summary.soldOut = summary.remainingSpots <= 0;
    summary.status = getAvailabilityStatus_(summary.remainingSpots);
  });

  return summaryByCamp;
}

function sendRegistrationEmailsSafely_(payload) {
  const registrationId = payload && payload.registrationId ? payload.registrationId : "";

  try {
    sendRegistrationEmails_(payload);
    recordEmailStatus_(registrationId, {
      parentStatus: payload && payload.email ? "sent" : "no_parent_email",
      adminStatus: ADMIN_NOTIFICATION_EMAIL ? "sent" : "no_admin_email"
    });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    Logger.log("Registration email failed: " + message);
    recordEmailStatus_(registrationId, {
      parentStatus: "error",
      adminStatus: "error",
      notes: "Registration email failed: " + message
    });
  }
}

function sendTestEmail() {
  const summary = {
    registrationId: "TEST-" + new Date().getTime(),
    submittedAt: new Date().toISOString(),
    parentName: "Test Parent",
    email: ADMIN_NOTIFICATION_EMAIL,
    phone: CAMP_CONTACT_PHONE,
    emergencyContact: "Test Emergency Contact",
    emergencyPhone: CAMP_CONTACT_PHONE,
    familyNotes: "This is a test email sent from Apps Script.",
    signatureName: "Test Parent",
    signatureDate: new Date().toISOString().slice(0, 10),
    seatCount: 1,
    totalDue: 30,
    camps: [
      {
        slug: "test-camp",
        title: "SunnySide Test Camp",
        shortDate: "Test Date"
      }
    ],
    kids: [
      {
        name: "Test Camper",
        age: "8",
        notes: "No notes"
      }
    ]
  };

  sendRegistrationEmails_(summary);

  return "Test emails sent to " + ADMIN_NOTIFICATION_EMAIL;
}

function sendRegistrationEmails_(payload) {
  const registrationSummary = buildRegistrationSummary_(payload);
  const adminEmail = ADMIN_NOTIFICATION_EMAIL;
  const parentEmail = payload.email || "";
  const parentSubject = "SunnySide Registration Received - " + registrationSummary.registrationId;
  const adminSubject = "New SunnySide Registration - " + registrationSummary.registrationId;
  const parentTextBody = buildParentEmailText_(registrationSummary);
  const parentHtmlBody = buildParentEmailHtml_(registrationSummary);
  const adminTextBody = buildAdminEmailText_(registrationSummary);
  const adminHtmlBody = buildAdminEmailHtml_(registrationSummary);

  if (parentEmail) {
    MailApp.sendEmail({
      to: parentEmail,
      subject: parentSubject,
      htmlBody: parentHtmlBody,
      body: parentTextBody,
      replyTo: CAMP_CONTACT_EMAIL,
      name: "SunnySide Summer Camp"
    });
  }

  if (adminEmail) {
    MailApp.sendEmail({
      to: adminEmail,
      subject: adminSubject,
      htmlBody: adminHtmlBody,
      body: adminTextBody,
      replyTo: parentEmail || CAMP_CONTACT_EMAIL,
      name: "SunnySide Summer Camp"
    });
  }
}

function recordEmailStatus_(registrationId, details) {
  if (!registrationId) {
    return;
  }

  const context = getSheetContext_();
  const matches = findRegistrationRows_(context, registrationId);

  if (!matches.length) {
    return;
  }

  const now = new Date().toISOString();

  matches.forEach(function (match) {
    const row = match.row;
    const existingNotes = String(row[context.index["Reconciliation Notes"]] || "");

    row[context.index["Parent Email Status"]] = details.parentStatus || "";
    row[context.index["Admin Email Status"]] = details.adminStatus || "";
    row[context.index["Email Last Attempt At"]] = now;
    row[context.index["Last Updated At"]] = now;

    if (details.notes) {
      row[context.index["Reconciliation Notes"]] = existingNotes
        ? existingNotes + " | " + details.notes
        : details.notes;
    }
  });

  writeUpdatedRows_(context, matches);
}

function buildRegistrationSummary_(payload) {
  const camps = Array.isArray(payload.camps) ? payload.camps : [];
  const kids = Array.isArray(payload.kids) ? payload.kids : [];

  return {
    registrationId: payload.registrationId || "",
    submittedAt: payload.submittedAt || new Date().toISOString(),
    parentName: payload.parentName || "",
    email: payload.email || "",
    phone: payload.phone || "",
    emergencyContact: payload.emergencyContact || "",
    emergencyPhone: payload.emergencyPhone || "",
    familyNotes: payload.familyNotes || "",
    signatureName: payload.signatureName || "",
    signatureDate: payload.signatureDate || "",
    seatCount: parseNumber_(payload.seatCount),
    totalDue: parseNumber_(payload.totalDue),
    camps: camps.map(function (camp) {
      return {
        slug: camp.slug || "",
        title: camp.title || "",
        shortDate: camp.shortDate || ""
      };
    }),
    kids: kids.map(function (kid) {
      return {
        name: kid.name || "",
        age: kid.age || "",
        notes: kid.notes || ""
      };
    })
  };
}

function buildParentEmailText_(summary) {
  const lines = [
    "SunnySide Summer Camp Registration Received",
    "",
    "Hi " + (summary.parentName || "there") + ",",
    "",
    "Thanks for registering with SunnySide Summer Camp.",
    "Your confirmation ID is " + summary.registrationId + ".",
    "",
    "Registration details:",
    "Parent: " + summary.parentName,
    "Email: " + summary.email,
    "Phone: " + summary.phone,
    "Emergency contact: " + summary.emergencyContact,
    "Emergency phone: " + summary.emergencyPhone,
    "Camp address: " + CAMP_ADDRESS,
    "Camp contact email: " + CAMP_CONTACT_EMAIL,
    "Camp contact phone: " + CAMP_CONTACT_PHONE,
    "",
    "Selected camp days:",
    formatCampLines_(summary.camps),
    "",
    "Registered campers:",
    formatKidLines_(summary.kids),
    "",
    "Seat count: " + summary.seatCount,
    "Total due: " + moneyText_(summary.totalDue),
    "",
    summary.familyNotes ? "Family notes: " + summary.familyNotes : "Family notes: None provided",
    "",
    "Payment is confirmed separately after checkout. Please keep this email for your records.",
    "",
    "SunnySide Summer Camp"
  ];

  return lines.join("\n");
}

function buildParentEmailHtml_(summary) {
  return (
    "<h2>SunnySide Summer Camp Registration Received</h2>" +
    "<p>Hi " +
    escapeHtml_(summary.parentName || "there") +
    ",</p>" +
    "<p>Thanks for registering with SunnySide Summer Camp. Your confirmation ID is <strong>" +
    escapeHtml_(summary.registrationId) +
    "</strong>.</p>" +
    "<h3>Registration details</h3>" +
    "<ul>" +
    "<li><strong>Parent:</strong> " +
    escapeHtml_(summary.parentName) +
    "</li>" +
    "<li><strong>Email:</strong> " +
    escapeHtml_(summary.email) +
    "</li>" +
    "<li><strong>Phone:</strong> " +
    escapeHtml_(summary.phone) +
    "</li>" +
    "<li><strong>Emergency contact:</strong> " +
    escapeHtml_(summary.emergencyContact) +
    "</li>" +
    "<li><strong>Emergency phone:</strong> " +
    escapeHtml_(summary.emergencyPhone) +
    "</li>" +
    "<li><strong>Camp address:</strong> " +
    escapeHtml_(CAMP_ADDRESS) +
    "</li>" +
    "<li><strong>Camp contact email:</strong> " +
    escapeHtml_(CAMP_CONTACT_EMAIL) +
    "</li>" +
    "<li><strong>Camp contact phone:</strong> " +
    escapeHtml_(CAMP_CONTACT_PHONE) +
    "</li>" +
    "<li><strong>Seat count:</strong> " +
    escapeHtml_(String(summary.seatCount)) +
    "</li>" +
    "<li><strong>Total due:</strong> " +
    escapeHtml_(moneyText_(summary.totalDue)) +
    "</li>" +
    "</ul>" +
    "<h3>Selected camp days</h3>" +
    formatCampListHtml_(summary.camps) +
    "<h3>Registered campers</h3>" +
    formatKidListHtml_(summary.kids) +
    "<p><strong>Family notes:</strong> " +
    escapeHtml_(summary.familyNotes || "None provided") +
    "</p>" +
    "<p>Payment is confirmed separately after checkout. Please keep this email for your records.</p>" +
    "<p>SunnySide Summer Camp</p>"
  );
}

function buildAdminEmailText_(summary) {
  const lines = [
    "New SunnySide Registration",
    "",
    "Confirmation ID: " + summary.registrationId,
    "Submitted at: " + summary.submittedAt,
    "",
    "Parent details:",
    "Name: " + summary.parentName,
    "Email: " + summary.email,
    "Phone: " + summary.phone,
    "Emergency contact: " + summary.emergencyContact,
    "Emergency phone: " + summary.emergencyPhone,
    "",
    "Selected camp days:",
    formatCampLines_(summary.camps),
    "",
    "Registered campers:",
    formatKidLines_(summary.kids),
    "",
    "Seat count: " + summary.seatCount,
    "Total due: " + moneyText_(summary.totalDue),
    summary.familyNotes ? "Family notes: " + summary.familyNotes : "Family notes: None provided",
    "Signature: " + summary.signatureName,
    "Signature date: " + summary.signatureDate
  ];

  return lines.join("\n");
}

function buildAdminEmailHtml_(summary) {
  return (
    "<h2>New SunnySide Registration</h2>" +
    "<p><strong>Confirmation ID:</strong> " +
    escapeHtml_(summary.registrationId) +
    "<br><strong>Submitted at:</strong> " +
    escapeHtml_(summary.submittedAt) +
    "</p>" +
    "<h3>Parent details</h3>" +
    "<ul>" +
    "<li><strong>Name:</strong> " +
    escapeHtml_(summary.parentName) +
    "</li>" +
    "<li><strong>Email:</strong> " +
    escapeHtml_(summary.email) +
    "</li>" +
    "<li><strong>Phone:</strong> " +
    escapeHtml_(summary.phone) +
    "</li>" +
    "<li><strong>Emergency contact:</strong> " +
    escapeHtml_(summary.emergencyContact) +
    "</li>" +
    "<li><strong>Emergency phone:</strong> " +
    escapeHtml_(summary.emergencyPhone) +
    "</li>" +
    "<li><strong>Seat count:</strong> " +
    escapeHtml_(String(summary.seatCount)) +
    "</li>" +
    "<li><strong>Total due:</strong> " +
    escapeHtml_(moneyText_(summary.totalDue)) +
    "</li>" +
    "<li><strong>Signature:</strong> " +
    escapeHtml_(summary.signatureName) +
    "</li>" +
    "<li><strong>Signature date:</strong> " +
    escapeHtml_(summary.signatureDate) +
    "</li>" +
    "</ul>" +
    "<h3>Selected camp days</h3>" +
    formatCampListHtml_(summary.camps) +
    "<h3>Registered campers</h3>" +
    formatKidListHtml_(summary.kids) +
    "<p><strong>Family notes:</strong> " +
    escapeHtml_(summary.familyNotes || "None provided") +
    "</p>"
  );
}

function formatCampLines_(camps) {
  if (!camps.length) {
    return "- No camp days selected";
  }

  return camps
    .map(function (camp) {
      return "- " + (camp.title || "Camp day") + (camp.shortDate ? " (" + camp.shortDate + ")" : "");
    })
    .join("\n");
}

function formatKidLines_(kids) {
  if (!kids.length) {
    return "- No campers listed";
  }

  return kids
    .map(function (kid) {
      const notes = kid.notes ? " - Notes: " + kid.notes : "";
      return "- " + (kid.name || "Camper") + (kid.age ? ", age " + kid.age : "") + notes;
    })
    .join("\n");
}

function formatCampListHtml_(camps) {
  if (!camps.length) {
    return "<p>No camp days selected.</p>";
  }

  return (
    "<ul>" +
    camps
      .map(function (camp) {
        return (
          "<li>" +
          escapeHtml_(camp.title || "Camp day") +
          (camp.shortDate ? " (" + escapeHtml_(camp.shortDate) + ")" : "") +
          "</li>"
        );
      })
      .join("") +
    "</ul>"
  );
}

function formatKidListHtml_(kids) {
  if (!kids.length) {
    return "<p>No campers listed.</p>";
  }

  return (
    "<ul>" +
    kids
      .map(function (kid) {
        return (
          "<li>" +
          escapeHtml_(kid.name || "Camper") +
          (kid.age ? ", age " + escapeHtml_(String(kid.age)) : "") +
          (kid.notes ? " - Notes: " + escapeHtml_(kid.notes) : "") +
          "</li>"
        );
      })
      .join("") +
    "</ul>"
  );
}

function getCampCapacityStatus_(capacityMap, slug) {
  return capacityMap[slug] || {
    slug: slug,
    title: "",
    date: "",
    registeredSeats: 0,
    paidSeats: 0,
    followUpSeats: 0,
    families: {},
    paidRevenue: 0,
    expectedRevenue: 0,
    remainingSpots: DEFAULT_CAMP_CAPACITY,
    soldOut: false,
    status: "Open"
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

function getOrCreateSheet_(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  return sheet;
}

function writeReportSheet_(sheet, headers, rows) {
  const existingFilter = sheet.getFilter();

  if (existingFilter) {
    existingFilter.remove();
  }

  sheet.clearContents();
  sheet.clearFormats();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
}

function formatCampSummarySheet_(sheet, rowCount) {
  const totalRows = Math.max(rowCount + 1, 1);

  sheet.autoResizeColumns(1, 10);
  sheet.getRange(1, 1, 1, 10).setFontWeight("bold");
  sheet.getRange(1, 1, 1, 10).setBackground("#fde68a");

  if (rowCount) {
    sheet.getRange(2, 7, rowCount, 2).setNumberFormat("$0.00");
    sheet.getRange(2, 10, rowCount, 1).setFontWeight("bold");
    applyStatusColors_(sheet.getRange(2, 10, rowCount, 1));
  }

  if (totalRows > 1) {
    sheet.getRange(1, 1, totalRows, 10).createFilter();
  }
}

function formatPaymentFollowUpSheet_(sheet, rowCount) {
  const totalRows = Math.max(rowCount + 1, 1);

  sheet.autoResizeColumns(1, 12);
  sheet.getRange(1, 1, 1, 12).setFontWeight("bold");
  sheet.getRange(1, 1, 1, 12).setBackground("#bfdbfe");

  if (rowCount) {
    sheet.getRange(2, 9, rowCount, 1).setNumberFormat("$0.00");
  }

  if (totalRows > 1) {
    sheet.getRange(1, 1, totalRows, 12).createFilter();
  }
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

function rowObjectFromValues_(rowValues, headers) {
  const rowObject = {};

  headers.forEach(function (header, index) {
    rowObject[header] = rowValues[index];
  });

  return rowObject;
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

function roundCurrency_(value) {
  return Math.round(value * 100) / 100;
}

function moneyText_(value) {
  return "$" + roundCurrency_(parseNumber_(value)).toFixed(2);
}

function sortableText_(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value || "");
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAvailabilityStatus_(remainingSpots) {
  if (remainingSpots <= 0) {
    return "Waitlist / Full";
  }

  if (remainingSpots <= 5) {
    return "Nearly Full";
  }

  return "Open";
}

function applyStatusColors_(range) {
  const values = range.getValues();
  const backgrounds = values.map(function (row) {
    const status = String(row[0] || "");

    if (status === "Waitlist / Full") {
      return ["#fecaca"];
    }

    if (status === "Nearly Full") {
      return ["#fde68a"];
    }

    return ["#bbf7d0"];
  });

  range.setBackgrounds(backgrounds);
}

function outputJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function outputJsonOrJsonp_(payload, callbackName) {
  if (isValidJsonpCallback_(callbackName)) {
    return ContentService
      .createTextOutput(callbackName + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return outputJson_(payload);
}

function isValidJsonpCallback_(callbackName) {
  return Boolean(callbackName) && /^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(callbackName);
}

function rebuildAdminReports() {
  refreshReportingSheets_();
}
