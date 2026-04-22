(function () {
  const data = window.SUNNYSIDE_DATA;
  const grid = document.querySelector("[data-camp-grid]");

  if (!grid) {
    return;
  }

  grid.innerHTML = data.camps
    .map(function (camp) {
      return `
        <a class="camp-card camp-card-link" href="${data.campUrl(camp.slug)}" style="--camp-a:${camp.colors[0]}; --camp-b:${camp.colors[1]};" aria-label="See details for ${camp.title}">
          <div class="camp-card-image">
            <img src="${camp.image}" alt="${camp.imageAlt}">
          </div>
          <div class="camp-card-body">
            <div class="camp-card-meta">
              <span>${camp.shortDate}</span>
              <span>Only ${data.money(data.pricePerKid)}!</span>
            </div>
            <h3>${camp.title}</h3>
            <p>${camp.blurb}</p>
            <span class="card-link">See camp details</span>
          </div>
        </a>
      `;
    })
    .join("");
})();
