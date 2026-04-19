const SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const SHEET_NAME = "Registrations";

function doPost(e) {
  const sheet = getSheet_();
  const payload = JSON.parse(e.postData.contents || "{}");
  const camps = Array.isArray(payload.camps) ? payload.camps : [];
  const kids = Array.isArray(payload.kids) ? payload.kids : [];
  const rows = [];

  camps.forEach(function (camp) {
    kids.forEach(function (kid) {
      rows.push([
        payload.submittedAt || new Date().toISOString(),
        payload.registrationId || "",
        payload.parentName || "",
        payload.email || "",
        payload.phone || "",
        payload.emergencyContact || "",
        payload.emergencyPhone || "",
        payload.familyNotes || "",
        camp.slug || "",
        camp.title || "",
        camp.shortDate || "",
        kid.name || "",
        kid.age || "",
        kid.notes || "",
        payload.waiverAccepted ? "Yes" : "No",
        payload.signatureName || "",
        payload.signatureDate || "",
        payload.totalDue || "",
        payload.paymentStatus || "pending"
      ]);
    });
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
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
      "Total Due",
      "Payment Status"
    ]);
  }

  return sheet;
}
