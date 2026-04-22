(function () {
  const config = window.SUNNYSIDE_CONFIG || {};
  const data = window.SUNNYSIDE_DATA;
  const statusBox = document.getElementById("confirmation-status");

  if (!statusBox) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const pendingRegistration = readPendingRegistration();
  const checkoutSessionId = params.get("session_id") || "";
  const registrationId =
    params.get("registration_id") ||
    params.get("utm_content") ||
    (pendingRegistration && pendingRegistration.registrationId) ||
    "";

  updateReferenceField("[data-registration-id]", registrationId || "Not found");
  updateReferenceField("[data-payment-status]", checkoutSessionId ? "Received" : "Pending");
  updateReferenceField(
    "[data-parent-email]",
    (pendingRegistration && pendingRegistration.email) || "Not found"
  );
  updateReferenceField(
    "[data-total-due]",
    pendingRegistration && typeof pendingRegistration.totalDue === "number"
      ? data.money(pendingRegistration.totalDue)
      : "Not found"
  );

  if (!checkoutSessionId) {
    showMessage(
      "<strong>We could not finish your payment confirmation on this page.</strong><p>Please keep your email receipt handy and contact SunnySide if you need help confirming your camp spots.</p>",
      false
    );
    return;
  }

  if (!config.registrationWebhook) {
    showMessage(
      "<strong>Your payment went through, but we could not finish the online confirmation step.</strong><p>Please keep your payment receipt for your records and contact SunnySide if you have any questions.</p>",
      false
    );
    return;
  }

  try {
    const queued = sendConfirmation({
      eventType: "payment_confirmation",
      checkoutSessionId: checkoutSessionId,
      registrationId: registrationId,
      confirmedAt: new Date().toISOString()
    });

    if (queued) {
      markPendingRegistration(checkoutSessionId);
      showMessage(
        "<strong>Your payment has been received.</strong><p>Your registration is being finalized now. You are all set for your selected camp day${pendingRegistration && pendingRegistration.seatCount === 1 ? "" : "s"}.</p>",
        true
      );
      return;
    }

    showMessage(
      "<strong>We could not finish the final confirmation step from this browser.</strong><p>Please keep your receipt and registration ID handy just in case SunnySide needs to double-check your payment.</p>",
      false
    );
  } catch (error) {
    showMessage(
      "<strong>We could not finish your confirmation automatically.</strong><p>Please keep your receipt and registration ID handy and contact SunnySide if needed.</p>",
      false
    );
  }

  function readPendingRegistration() {
    try {
      return JSON.parse(localStorage.getItem("sunnySidePendingRegistration") || "null");
    } catch (error) {
      return null;
    }
  }

  function markPendingRegistration(sessionId) {
    if (!pendingRegistration) {
      return;
    }

    localStorage.setItem(
      "sunnySidePendingRegistration",
      JSON.stringify({
        registrationId: pendingRegistration.registrationId,
        parentName: pendingRegistration.parentName,
        email: pendingRegistration.email,
        seatCount: pendingRegistration.seatCount,
        totalDue: pendingRegistration.totalDue,
        submittedAt: pendingRegistration.submittedAt,
        checkoutSessionId: sessionId,
        paymentStatus: "confirmation_sent"
      })
    );
  }

  function sendConfirmation(payload) {
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      return navigator.sendBeacon(config.registrationWebhook, blob);
    }

    fetch(config.registrationWebhook, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: body
    }).catch(function () {
      return undefined;
    });

    return true;
  }

  function updateReferenceField(selector, value) {
    const field = document.querySelector(selector);

    if (field) {
      field.textContent = value;
    }
  }

  function showMessage(messageHtml, isSuccess) {
    statusBox.classList.toggle("success", Boolean(isSuccess));
    statusBox.classList.toggle("error", !isSuccess);
    statusBox.innerHTML = messageHtml;
  }
})();
