(function () {
  const config = window.SUNNYSIDE_CONFIG || {};
  const data = window.SUNNYSIDE_DATA;
  const statusBox = document.getElementById("confirmation-status");
  const MAX_STATUS_POLLS = 8;
  const STATUS_POLL_DELAY = 1500;

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
  updateReferenceField("[data-payment-status]", checkoutSessionId ? "Checking..." : "Pending");
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

    if (queued && registrationId) {
      markPendingRegistration(checkoutSessionId, "confirmation_sent");
      showMessage(
        "<strong>Your payment has been received.</strong><p>We are matching it with your registration now. This can take a few seconds.</p>",
        true
      );
      pollForFinalStatus(0);
      return;
    }

    if (queued) {
      updateReferenceField("[data-payment-status]", "Received");
      showMessage(
        "<strong>Your payment has been received.</strong><p>We could not automatically display the final registration status on this page, but SunnySide can still confirm it from Stripe if needed.</p>",
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

  function markPendingRegistration(sessionId, paymentStatus) {
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
        paymentStatus: paymentStatus || pendingRegistration.paymentStatus || "pending"
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

  function pollForFinalStatus(attempt) {
    fetchRegistrationStatus(registrationId)
      .then(function (result) {
        if (!result || !result.ok) {
          if (attempt < MAX_STATUS_POLLS - 1) {
            retryConfirmation(attempt);
            return;
          }

          showPendingHelp();
          return;
        }

        const normalizedStatus = String(result.paymentStatus || "").toLowerCase();

        if (normalizedStatus === "paid") {
          updateReferenceField("[data-payment-status]", "Paid");
          markPendingRegistration(checkoutSessionId, "paid");
          showMessage(
            "<strong>Your camp payment is confirmed.</strong><p>Your registration is all set, and SunnySide has your payment on file.</p>",
            true
          );
          return;
        }

        if (normalizedStatus === "paid_amount_mismatch") {
          updateReferenceField("[data-payment-status]", "Needs Review");
          markPendingRegistration(checkoutSessionId, "paid_amount_mismatch");
          showMessage(
            "<strong>Your payment was received.</strong><p>We are double-checking the amount against your registration and will follow up if anything needs attention.</p>",
            false
          );
          return;
        }

        if (attempt < MAX_STATUS_POLLS - 1) {
          retryConfirmation(attempt);
          return;
        }

        showPendingHelp(result.notes);
      })
      .catch(function () {
        if (attempt < MAX_STATUS_POLLS - 1) {
          retryConfirmation(attempt);
          return;
        }

        showPendingHelp();
      });
  }

  function retryConfirmation(attempt) {
    window.setTimeout(function () {
      sendConfirmation({
        eventType: "payment_confirmation",
        checkoutSessionId: checkoutSessionId,
        registrationId: registrationId,
        confirmedAt: new Date().toISOString()
      });
      pollForFinalStatus(attempt + 1);
    }, STATUS_POLL_DELAY);
  }

  function fetchRegistrationStatus(targetRegistrationId) {
    return new Promise(function (resolve, reject) {
      if (!config.registrationWebhook || !targetRegistrationId) {
        resolve(null);
        return;
      }

      const callbackName = "__sunnySideStatus" + Date.now() + Math.floor(Math.random() * 1000);
      const script = document.createElement("script");
      const url = new URL(config.registrationWebhook);

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("Status request failed."));
      };

      url.searchParams.set("action", "status");
      url.searchParams.set("registrationId", targetRegistrationId);
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("_", String(Date.now()));
      script.src = url.toString();
      document.body.appendChild(script);

      function cleanup() {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }

        try {
          delete window[callbackName];
        } catch (error) {
          window[callbackName] = undefined;
        }
      }
    });
  }

  function showPendingHelp(notes) {
    updateReferenceField("[data-payment-status]", "Pending Review");
    showMessage(
      "<strong>Your payment was received, but the final confirmation is still catching up.</strong><p>Please refresh this page in a moment. If it still shows pending later, SunnySide can verify it from the registration sheet." +
        (notes ? " " + notes : "") +
        "</p>",
      false
    );
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
