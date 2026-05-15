(function () {
  const VERSION = "2026-05-14-1";
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
      { type: "script", path: "scripts/camp-data.js" },
      { type: "script", path: "scripts/capacity.js" }
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

  requestedGroups
    .flatMap(function (group) {
      return assets[group] || [];
    })
    .forEach(function (asset) {
      injectAsset_(asset, VERSION, currentScript);
    });

  function withVersion_(path, version) {
    return path + (path.indexOf("?") === -1 ? "?" : "&") + "v=" + encodeURIComponent(version);
  }

  function injectAsset_(asset, version, anchorScript) {
    const path = withVersion_(asset.path, version);
    const parent = anchorScript && anchorScript.parentNode ? anchorScript.parentNode : document.head;
    let element;

    if (asset.type === "style") {
      element = document.createElement("link");
      element.rel = "stylesheet";
      element.href = path;
    } else {
      element = document.createElement("script");
      element.src = path;
      element.async = false;
    }

    parent.insertBefore(element, anchorScript || null);
  }
})();
