(function () {
  const data = window.SUNNYSIDE_DATA;
  const grid = document.querySelector("[data-camp-grid]");

  if (!grid) {
    return;
  }

  grid.innerHTML = data.camps
    .map(function (camp) {
      return `
        <article class="camp-card" style="--camp-a:${camp.colors[0]}; --camp-b:${camp.colors[1]};">
          <div class="camp-card-image">
            <img src="${camp.image}" alt="${camp.imageAlt}">
          </div>
          <div class="camp-card-body">
            <div class="camp-card-meta">
              <span>${camp.shortDate}</span>
              <span>${data.money(data.pricePerKid)}</span>
            </div>
            <h3>${camp.title}</h3>
            <p>${camp.blurb}</p>
            <a class="card-link" href="${data.campUrl(camp.slug)}">See camp details</a>
          </div>
        </article>
      `;
    })
    .join("");
})();
