(function () {
  const data = window.SUNNYSIDE_DATA;
  const capacity = window.SUNNYSIDE_CAPACITY;
  const mount = document.getElementById("camp-page");

  if (!mount) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("camp") || data.camps[0].slug;
  const camp = data.getCamp(slug) || data.camps[0];

  document.title = camp.title + " | SunnySide Summer Camp";

  function render() {
    const status = capacity ? capacity.getCampStatus(camp.slug) : { soldOut: false };
    const soldOutRibbon = status.soldOut ? '<span class="sold-out-ribbon">Sold Out</span>' : "";
    const actionMarkup = status.soldOut
      ? '<span class="button button-secondary button-disabled" aria-disabled="true">Sold Out</span>'
      : '<a class="button button-primary" href="' + data.checkoutUrl(camp.slug) + '">Check Out</a>';
    const sidebarAction = status.soldOut
      ? '<span class="button button-secondary button-disabled full-width-button" aria-disabled="true">Sold Out</span>'
      : '<a class="button button-primary" href="' + data.checkoutUrl(camp.slug) + '">Book Now</a>';

    mount.innerHTML = `
      <section class="camp-hero${status.soldOut ? " sold-out" : ""}" style="--camp-a:${camp.colors[0]}; --camp-b:${camp.colors[1]};">
        <div class="camp-hero-copy">
          <p class="eyebrow">${camp.shortDate}</p>
          <div class="camp-title-wrap">
            ${soldOutRibbon}
            <h1>${camp.title}</h1>
          </div>
          <p class="hero-text">${camp.description}</p>
          <div class="camp-meta">
            <span class="meta-pill">${status.soldOut ? "Sold Out" : "Only " + data.money(data.pricePerKid) + "!"}</span>
            <span class="meta-pill">${status.soldOut ? "This camp has reached capacity." : "Limited availability. Book today!"}</span>
            <span class="meta-pill">Summer 2026</span>
          </div>
          <div class="hero-actions">
            ${actionMarkup}
            <a class="button button-secondary" href="index.html#lineup">See all camps</a>
          </div>
        </div>
        <div class="camp-hero-visual">
          <img src="${camp.image}" alt="${camp.imageAlt}">
        </div>
      </section>

      <section class="camp-layout">
        <div class="camp-detail-copy">
          <div class="detail-panel">
            <p class="eyebrow">Camp Description</p>
            <h2>What makes this camp fun?</h2>
            ${camp.details
              .map(function (paragraph) {
                return "<p>" + paragraph + "</p>";
              })
              .join("")}
          </div>

          <div class="photo-strip single-photo">
            <article class="photo-card featured-photo">
              <div
                class="photo-card-image"
                style="background-image:url('${camp.image}');"
              ></div>
              <div class="photo-card-copy">
                <strong>${camp.photoCaption}</strong>
                <p>${camp.blurb}</p>
              </div>
            </article>
          </div>
        </div>

        <aside class="camp-sidebar">
          <p class="eyebrow">Quick Facts</p>
          <h3>${status.soldOut ? "This camp is currently sold out" : "What families can look forward to"}</h3>
          <ul>
            ${camp.highlights
              .map(function (item) {
                return "<li>" + item + "</li>";
              })
              .join("")}
          </ul>
          <p>
            ${
              status.soldOut
                ? "This camp has reached the 20-seat limit. You can still view the details here and check back in case availability opens up."
                : "This camp day is designed to feel bright, welcoming, and easy to enjoy from drop-off through pickup."
            }
          </p>
          ${sidebarAction}
        </aside>
      </section>
    `;
  }

  render();

  if (capacity) {
    capacity.load().then(render);
  }
})();
