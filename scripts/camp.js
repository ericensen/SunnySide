(function () {
  const data = window.SUNNYSIDE_DATA;
  const mount = document.getElementById("camp-page");

  if (!mount) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("camp") || data.camps[0].slug;
  const camp = data.getCamp(slug) || data.camps[0];

  document.title = camp.title + " | SunnySide Summer Camp";

  mount.innerHTML = `
    <section class="camp-hero" style="--camp-a:${camp.colors[0]}; --camp-b:${camp.colors[1]};">
      <div class="camp-hero-copy">
        <p class="eyebrow">${camp.shortDate}</p>
        <h1>${camp.title}</h1>
        <p class="hero-text">${camp.description}</p>
        <div class="camp-meta">
          <span class="meta-pill">${data.money(data.pricePerKid)} per kid</span>
          <span class="meta-pill">${data.maxOpenings} spots max</span>
          <span class="meta-pill">Summer 2026</span>
        </div>
        <div class="hero-actions">
          <a class="button button-primary" href="${data.checkoutUrl(camp.slug)}">Check Out</a>
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
        <h3>Included on this camp page</h3>
        <ul>
          ${camp.highlights
            .map(function (item) {
              return "<li>" + item + "</li>";
            })
            .join("")}
        </ul>
        <p>
          Parents can register one or more kids, choose multiple camps, sign the
          waiver, and move into payment from the same checkout flow.
        </p>
        <a class="button button-primary" href="${data.checkoutUrl(camp.slug)}">Reserve a Spot</a>
      </aside>
    </section>
  `;
})();
