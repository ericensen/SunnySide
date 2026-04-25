(function () {
  const data = window.SUNNYSIDE_DATA;
  const capacity = window.SUNNYSIDE_CAPACITY;
  const grid = document.querySelector("[data-camp-grid]");

  if (!grid) {
    return;
  }

  function render() {
    grid.innerHTML = data.camps
      .map(function (camp) {
        const status = capacity ? capacity.getCampStatus(camp.slug) : { soldOut: false };
        const soldOutClass = status.soldOut ? " sold-out" : "";
        const soldOutRibbon = status.soldOut ? '<span class="sold-out-ribbon">Sold Out</span>' : "";
        const soldOutBadge = status.soldOut ? '<span class="sold-out-badge">Sold Out</span>' : "";

        return `
          <a class="camp-card camp-card-link${soldOutClass}" href="${data.campUrl(camp.slug)}" style="--camp-a:${camp.colors[0]}; --camp-b:${camp.colors[1]};" aria-label="See details for ${camp.title}">
            <div class="camp-card-image">
              <img src="${camp.image}" alt="${camp.imageAlt}">
            </div>
            <div class="camp-card-body">
              <div class="camp-card-meta">
                <span>${camp.shortDate}</span>
                <span>${status.soldOut ? "Sold Out" : "Only " + data.money(data.pricePerKid) + "!"}</span>
              </div>
              <div class="camp-title-wrap">
                ${soldOutRibbon}
                <h3>${camp.title}</h3>
              </div>
              <p>${camp.blurb}</p>
              ${soldOutBadge}
              <span class="card-link">${status.soldOut ? "View sold out camp details" : "See camp details"}</span>
            </div>
          </a>
        `;
      })
      .join("");
  }

  render();

  if (capacity) {
    capacity.load().then(render);
  }
})();
