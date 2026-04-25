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
  updateReferenceField("[data-camp-address]", config.campAddress || "Not provided");
  updateReferenceField("[data-contact-email]", config.contactEmail || "Not provided");
  updateReferenceField("[data-contact-phone]", config.contactPhone || "Not provided");
  updateReferenceField(
    "[data-camp-schedule]",
    config.campScheduleNote || "Camp schedule details will be shared before your camp day."
  );
  renderSelectedCamps();

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

  showMessage(
    "<strong>Your payment has been received.</strong><p>We are confirming it with your registration now.</p>",
    true
  );

  confirmPayment(checkoutSessionId, registrationId)
    .then(function (result) {
      if (!result || !result.ok) {
        showPendingHelp(result && result.error ? result.error : "");
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

      showPendingHelp(result.paymentStatus || "");
    })
    .catch(function () {
      showPendingHelp();
    });

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

  function renderSelectedCamps() {
    const selectedCamps = document.querySelector("[data-selected-camps]");
    const camps = pendingRegistration && Array.isArray(pendingRegistration.camps) ? pendingRegistration.camps : [];

    if (!selectedCamps) {
      return;
    }

    selectedCamps.innerHTML = camps.length
      ? camps
          .map(function (camp) {
            return `
              <div class="summary-item">
                <strong>${camp.title}</strong>
                <p>${camp.shortDate}</p>
              </div>
            `;
          })
          .join("")
      : "<p>Your selected camp dates will appear here once your registration is saved in this browser.</p>";
  }

  function confirmPayment(sessionId, targetRegistrationId) {
    return new Promise(function (resolve, reject) {
      const callbackName = "__sunnySideConfirm" + Date.now() + Math.floor(Math.random() * 1000);
      const script = document.createElement("script");
      const url = new URL(config.registrationWebhook);
      const timeoutId = window.setTimeout(function () {
        cleanup();
        reject(new Error("Confirmation request timed out."));
      }, 12000);

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("Confirmation request failed."));
      };

      url.searchParams.set("action", "confirm_payment");
      url.searchParams.set("session_id", sessionId);

      if (targetRegistrationId) {
        url.searchParams.set("registration_id", targetRegistrationId);
      }

      url.searchParams.set("callback", callbackName);
      url.searchParams.set("_", String(Date.now()));
      script.src = url.toString();
      document.body.appendChild(script);

      function cleanup() {
        window.clearTimeout(timeoutId);

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

  function showPendingHelp(detail) {
    updateReferenceField("[data-payment-status]", "Pending Review");
    showMessage(
      "<strong>Your payment was received, but we could not show the final confirmation on this page.</strong><p>Please keep your receipt handy. SunnySide can verify the payment from the registration sheet." +
        (detail ? " " + detail : "") +
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
