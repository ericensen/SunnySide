(function () {
  const VERSION = "2026-04-21-2";
  const currentScript = document.currentScript;
  const requestedGroups = (currentScript && currentScript.getAttribute("data-assets") || "")
    .split(",")
    .map(function (value) {
      return value.trim();
    })
    .filter(Boolean);
  const assets = {
    styles: [{ type: "style", path: "styles.css" }],
    common: [
      { type: "script", path: "scripts/site-config.js" },
      { type: "script", path: "scripts/camp-data.js" }
    ],
    main: [{ type: "script", path: "scripts/main.js" }],
    camp: [{ type: "script", path: "scripts/camp.js" }],
    checkout: [{ type: "script", path: "scripts/checkout.js" }],
    confirmation: [{ type: "script", path: "scripts/confirmation.js" }]
  };

  window.SUNNYSIDE_ASSET_VERSION = VERSION;

  if (!requestedGroups.length) {
    return;
  }

  document.write(
    requestedGroups
      .flatMap(function (group) {
        return assets[group] || [];
      })
      .map(function (asset) {
        const path = withVersion_(asset.path, VERSION);

        if (asset.type === "style") {
          return '<link rel="stylesheet" href="' + path + '">';
        }

        return '<script src="' + path + '"><\/script>';
      })
      .join("")
  );

  function withVersion_(path, version) {
    return path + (path.indexOf("?") === -1 ? "?" : "&") + "v=" + encodeURIComponent(version);
  }
})();
