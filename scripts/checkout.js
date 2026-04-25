(function () {
  const data = window.SUNNYSIDE_DATA;
  const config = window.SUNNYSIDE_CONFIG || {};
  const capacity = window.SUNNYSIDE_CAPACITY;
  const form = document.getElementById("checkout-form");

  if (!form) {
    return;
  }

  const campPicker = document.querySelector("[data-camp-picker]");
  const camperList = document.querySelector("[data-camper-list]");
  const camperTemplate = document.getElementById("camper-template");
  const addCamperButton = document.querySelector("[data-add-camper]");
  const statusBox = document.getElementById("status-box");
  const submitButton = form.querySelector('button[type="submit"]');
  const summaryFields = {
    camps: document.querySelector("[data-summary-camps]"),
    kids: document.querySelector("[data-summary-kids]"),
    seats: document.querySelector("[data-summary-seats]"),
    total: document.querySelector("[data-summary-total]"),
    list: document.querySelector("[data-summary-list]")
  };

  const params = new URLSearchParams(window.location.search);
  const preselectedCamp = params.get("camp");

  function getLocalToday() {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().slice(0, 10);
  }

  function renderCampPicker(selectedSlugs) {
    const selectedLookup = Array.isArray(selectedSlugs)
      ? selectedSlugs.reduce(function (lookup, slug) {
          lookup[slug] = true;
          return lookup;
        }, {})
      : {};

    campPicker.innerHTML = data.camps
      .map(function (camp) {
        const availability = capacity ? capacity.getCampStatus(camp.slug) : { soldOut: false };
        const shouldCheck =
          (selectedLookup[camp.slug] || (!selectedSlugs && camp.slug === preselectedCamp)) &&
          !availability.soldOut;
        const checked = shouldCheck ? "checked" : "";
        const disabled = availability.soldOut ? "disabled" : "";
        const availabilityMarkup = availability.soldOut
          ? '<em class="camp-option-status sold-out-text">Sold Out</em>'
          : '<em class="camp-option-status">Open</em>';

        return `
          <label class="camp-option${availability.soldOut ? " sold-out-option" : ""}">
            <input type="checkbox" name="selectedCamp" value="${camp.slug}" ${checked} ${disabled}>
            <span>
              <strong>${camp.title}</strong>
              <small>${camp.shortDate}</small>
              <p>${camp.blurb}</p>
              ${availabilityMarkup}
            </span>
          </label>
        `;
      })
      .join("");
  }

  function addCamperCard() {
    const fragment = camperTemplate.content.cloneNode(true);
    camperList.appendChild(fragment);
    refreshCamperNumbers();
    updateSummary();
  }

  function refreshCamperNumbers() {
    const cards = camperList.querySelectorAll(".camper-card");

    cards.forEach(function (card, index) {
      const number = card.querySelector("[data-camper-number]");
      const removeButton = card.querySelector("[data-remove-camper]");

      number.textContent = String(index + 1);
      removeButton.hidden = cards.length === 1;

      removeButton.onclick = function () {
        card.remove();
        refreshCamperNumbers();
        updateSummary();
      };
    });
  }

  function getSelectedCamps() {
    return Array.from(form.querySelectorAll('input[name="selectedCamp"]:checked'))
      .map(function (input) {
        return data.getCamp(input.value);
      })
      .filter(Boolean);
  }

  function getChildren() {
    return Array.from(camperList.querySelectorAll(".camper-card")).map(function (card) {
      return {
        name: card.querySelector('input[name="childName"]').value.trim(),
        age: card.querySelector('input[name="childAge"]').value.trim(),
        notes: card.querySelector('textarea[name="childNotes"]').value.trim()
      };
    });
  }

  function updateSummary() {
    const camps = getSelectedCamps();
    const kids = getChildren().filter(function (kid) {
      return kid.name || kid.age || kid.notes;
    });
    const seatCount = camps.length * kids.length;
    const total = seatCount * data.pricePerKid;

    summaryFields.camps.textContent = String(camps.length);
    summaryFields.kids.textContent = String(kids.length);
    summaryFields.seats.textContent = String(seatCount);
    summaryFields.total.textContent = data.money(total);

    summaryFields.list.innerHTML = camps.length
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
      : '<p>Select one or more camps to see your summary here.</p>';
  }

  function saveLocalRegistration(payload) {
    const key = "sunnySideRegistrations";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push(payload);
    localStorage.setItem(key, JSON.stringify(existing));
  }

  function savePendingRegistration(payload) {
    localStorage.setItem(
      "sunnySidePendingRegistration",
      JSON.stringify({
        registrationId: payload.registrationId,
        parentName: payload.parentName,
        email: payload.email,
        seatCount: payload.seatCount,
        totalDue: payload.totalDue,
        submittedAt: payload.submittedAt,
        camps: payload.camps
      })
    );
  }

  function createRegistrationId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "SSC-" + window.crypto.randomUUID();
    }

    return "SSC-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  }

  function sendToWebhook(payload) {
    if (!config.registrationWebhook) {
      return;
    }

    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      navigator.sendBeacon(config.registrationWebhook, blob);
      return;
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
  }

  function showStatus(messageHtml, isSuccess) {
    statusBox.classList.remove("hidden");
    statusBox.classList.toggle("success", Boolean(isSuccess));
    statusBox.classList.toggle("error", !isSuccess);
    statusBox.innerHTML = messageHtml;
  }

  function setSubmittingState(isSubmitting) {
    submitButton.disabled = Boolean(isSubmitting);
    submitButton.textContent = isSubmitting ? "Checking Availability..." : "Save Registration and Continue";
  }

  function buildPaymentLink(payload) {
    if (!config.stripePaymentLink) {
      return "";
    }

    try {
      const url = new URL(config.stripePaymentLink);

      if (payload.email) {
        url.searchParams.set("prefilled_email", payload.email);
      }

      if (payload.registrationId) {
        url.searchParams.set("client_reference_id", payload.registrationId);
        url.searchParams.set("utm_source", "sunnyside_site");
        url.searchParams.set("utm_medium", "registration");
        url.searchParams.set("utm_campaign", "summer_camp_checkout");
        url.searchParams.set("utm_content", payload.registrationId);
      }

      return url.toString();
    } catch (error) {
      return config.stripePaymentLink;
    }
  }

  form.addEventListener("input", updateSummary);

  addCamperButton.addEventListener("click", function () {
    addCamperCard();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }
    setSubmittingState(true);
    const currentSelections = Array.from(form.querySelectorAll('input[name="selectedCamp"]:checked')).map(
      function (input) {
        return input.value;
      }
    );

    const proceed = function () {
      const selectedCamps = getSelectedCamps();
      const children = getChildren().filter(function (kid) {
        return kid.name && kid.age;
      });

      if (!selectedCamps.length) {
        setSubmittingState(false);
        showStatus("<strong>Please select at least one camp.</strong>", false);
        return;
      }

      if (!children.length) {
        setSubmittingState(false);
        showStatus("<strong>Please add at least one child with a name and age.</strong>", false);
        return;
      }

      const soldOutSelections = selectedCamps.filter(function (camp) {
        const availability = capacity ? capacity.getCampStatus(camp.slug) : { soldOut: false };
        return availability.soldOut || availability.remainingSpots < children.length;
      });

      if (soldOutSelections.length) {
        setSubmittingState(false);
        renderCampPicker(currentSelections);
        updateSummary();
        showStatus(
          "<strong>One or more selected camps are sold out.</strong><p>Please remove sold out camp days before continuing.</p>",
          false
        );
        return;
      }

      const seatCount = selectedCamps.length * children.length;
      const totalDue = seatCount * data.pricePerKid;
      const payload = {
        registrationId: createRegistrationId(),
        submittedAt: new Date().toISOString(),
        parentName: form.parentName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        emergencyContact: form.emergencyContact.value.trim(),
        emergencyPhone: form.emergencyPhone.value.trim(),
        familyNotes: form.familyNotes.value.trim(),
        waiverAccepted: form.waiverAccepted.checked,
        signatureName: form.signatureName.value.trim(),
        signatureDate: form.signatureDate.value,
        kids: children,
        camps: selectedCamps.map(function (camp) {
          return {
            slug: camp.slug,
            title: camp.title,
            shortDate: camp.shortDate
          };
        }),
        seatCount: seatCount,
        totalDue: totalDue,
        paymentStatus: "pending"
      };

      try {
        saveLocalRegistration(payload);
        savePendingRegistration(payload);
      } catch (error) {
        setSubmittingState(false);
        showStatus(
          "<strong>Registration details could not be saved in this browser.</strong><p>Please keep this page open and complete payment after you set up your live webhook and payment link.</p>",
          false
        );
        return;
      }

      sendToWebhook(payload);

      const paymentLink = buildPaymentLink(payload);
      const paymentMarkup = paymentLink
        ? `<p><a class="button button-primary" href="${paymentLink}" target="_blank" rel="noreferrer">Open Payment Link</a></p>
           <p>Pay for <strong>${seatCount}</strong> camp seat${seatCount === 1 ? "" : "s"} in Stripe.</p>
           <p>If you need to change children or camp selections, return to this form before completing payment.</p>`
        : `<p>Payment is not available at the moment. Please try again soon.</p>`;

      setSubmittingState(false);
      showStatus(
        `<strong>Registration saved.</strong>
         <p>Saved ${children.length} child${children.length === 1 ? "" : "ren"} for ${selectedCamps.length} camp${selectedCamps.length === 1 ? "" : "s"}.</p>
         <p>Total due: <strong>${data.money(totalDue)}</strong></p>
         ${paymentMarkup}`,
        true
      );

      window.location.hash = "summary-card";
    };

    if (capacity) {
      capacity.load(true).then(function () {
        renderCampPicker(currentSelections);
        updateSummary();
        proceed();
      });
      return;
    }

    proceed();
  });

  renderCampPicker();
  addCamperCard();
  form.signatureDate.value = getLocalToday();
  updateSummary();

  if (capacity) {
    capacity.load().then(function () {
      renderCampPicker(
        Array.from(form.querySelectorAll('input[name="selectedCamp"]:checked')).map(function (input) {
          return input.value;
        })
      );
      updateSummary();
    });
  }
})();
