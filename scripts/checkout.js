(function () {
  const data = window.SUNNYSIDE_DATA;
  const config = window.SUNNYSIDE_CONFIG || {};
  const capacity = window.SUNNYSIDE_CAPACITY;
  const checkoutLogic = window.SUNNYSIDE_CHECKOUT_LOGIC;
  const form = document.getElementById("checkout-form");

  if (!form || !checkoutLogic) {
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
  const minCamperAge = data.minAge || 5;
  const maxCamperAge = data.maxAge || 12;

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
    const seatCount = checkoutLogic.calculateSeatCount(camps, kids);
    const total = checkoutLogic.calculateTotalDue(seatCount, data.pricePerKid);

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

  function submitCheckoutRedirect(payload) {
    if (!config.registrationWebhook) {
      return false;
    }

    const redirectForm = document.createElement("form");

    redirectForm.method = "POST";
    redirectForm.action = config.registrationWebhook;
    redirectForm.acceptCharset = "UTF-8";
    redirectForm.style.display = "none";
    addHiddenField(redirectForm, "action", "create_checkout_from_payload");
    addHiddenField(redirectForm, "payload", JSON.stringify(payload));
    document.body.appendChild(redirectForm);
    redirectForm.submit();

    return true;
  }

  function addHiddenField(targetForm, name, value) {
    const input = document.createElement("input");

    input.type = "hidden";
    input.name = name;
    input.value = value;
    targetForm.appendChild(input);
  }

  function showStatus(messageHtml, isSuccess) {
    statusBox.classList.remove("hidden");
    statusBox.classList.toggle("success", Boolean(isSuccess));
    statusBox.classList.toggle("error", !isSuccess);
    statusBox.innerHTML = messageHtml;
  }

  function setSubmittingState(isSubmitting, label) {
    submitButton.disabled = Boolean(isSubmitting);
    submitButton.textContent = isSubmitting
      ? label || "Checking Availability..."
      : "Save Registration and Continue";
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
      setSubmittingState(true, "Preparing Payment...");
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

      const ineligibleChildren = checkoutLogic.getIneligibleChildren(children, minCamperAge, maxCamperAge);

      if (ineligibleChildren.length) {
        setSubmittingState(false);
        showStatus(
          "<strong>SunnySide camp is for kids ages " +
            minCamperAge +
            " to " +
            maxCamperAge +
            ".</strong><p>Please update each camper age before continuing.</p>",
          false
        );
        return;
      }

      const soldOutSelections = checkoutLogic.getSoldOutSelections(
        selectedCamps,
        children,
        function (slug) {
          return capacity ? capacity.getCampStatus(slug) : { soldOut: false };
        }
      );

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

      const seatCount = checkoutLogic.calculateSeatCount(selectedCamps, children);
      const totalDue = checkoutLogic.calculateTotalDue(seatCount, data.pricePerKid);
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
        totalDue: totalDue
      };

      try {
        savePendingRegistration(payload);
      } catch (error) {
        setSubmittingState(false);
        showStatus(
          "<strong>Registration details could not be saved in this browser.</strong><p>Please keep this page open and contact SunnySide for help completing payment.</p>",
          false
        );
        return;
      }

      showStatus(
        `<strong>Registration details saved.</strong>
         <p>We saved ${children.length} child${children.length === 1 ? "" : "ren"} for ${selectedCamps.length} camp${selectedCamps.length === 1 ? "" : "s"}.</p>
         <p>Total due: <strong>${data.money(totalDue)}</strong></p>
         <p>Opening your secure payment page for <strong>${seatCount}</strong> camp seat${seatCount === 1 ? "" : "s"}. Your camp registration is confirmed after payment.</p>`,
        true
      );

      window.location.hash = "summary-card";

      if (submitCheckoutRedirect(payload)) {
        return;
      }

      setSubmittingState(false);
      showStatus(
        "<strong>Payment could not open automatically.</strong><p>Please contact SunnySide for help completing payment.</p>",
        false
      );
    };

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
