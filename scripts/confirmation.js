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
  updateReferenceField("[data-session-id]", checkoutSessionId || "Not found");
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
      "<strong>Stripe did not send a checkout session ID back to this page.</strong><p>Set your Payment Link to redirect here after payment using <code>confirmation.html?session_id={CHECKOUT_SESSION_ID}</code>.</p>",
      false
    );
    return;
  }

  if (!config.registrationWebhook) {
    showMessage(
      "<strong>Your Stripe payment appears complete, but registration reconciliation is not configured yet.</strong><p>Add your Apps Script web app URL to <code>registrationWebhook</code> in <code>scripts/site-config.js</code> so this page can confirm payment automatically.</p>",
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
        "<strong>Payment confirmation queued.</strong><p>We sent your Stripe checkout session for reconciliation. Your registration sheet can now be updated with the paid status.</p>",
        true
      );
      return;
    }

    showMessage(
      "<strong>We could not queue the confirmation request from this browser.</strong><p>Please keep your Stripe receipt and registration ID handy in case SunnySide needs to confirm payment manually.</p>",
      false
    );
  } catch (error) {
    showMessage(
      "<strong>We could not send your confirmation to the registration tracker.</strong><p>Please keep your Stripe receipt and contact SunnySide with your registration ID if needed.</p>",
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
