(function () {
  const config = window.SUNNYSIDE_CONFIG || {};
  const data = window.SUNNYSIDE_DATA;
  let capacityMap = {};
  let loadPromise = null;

  function defaultCampStatus(slug) {
    const camp = data && typeof data.getCamp === "function" ? data.getCamp(slug) : null;
    return {
      slug: slug,
      title: camp ? camp.title : "",
      date: camp ? camp.shortDate : "",
      registeredSeats: 0,
      paidSeats: 0,
      pendingSeats: 0,
      remainingSpots: data && typeof data.maxOpenings === "number" ? data.maxOpenings : 20,
      soldOut: false,
      status: "Open"
    };
  }

  function load(forceRefresh) {
    if (!config.registrationWebhook) {
      capacityMap = {};
      return Promise.resolve(capacityMap);
    }

    if (!forceRefresh && loadPromise) {
      return loadPromise;
    }

    loadPromise = requestJsonp_("capacity")
      .then(function (result) {
        capacityMap = result && result.ok && result.capacity ? result.capacity : {};
        return capacityMap;
      })
      .catch(function () {
        capacityMap = {};
        return capacityMap;
      })
      .then(function (result) {
        window.dispatchEvent(
          new CustomEvent("sunnyside:capacity", {
            detail: result
          })
        );
        return result;
      });

    return loadPromise;
  }

  function getCampStatus(slug) {
    return capacityMap[slug] || defaultCampStatus(slug);
  }

  function requestJsonp_(action) {
    return new Promise(function (resolve, reject) {
      const callbackName = "__sunnySideCapacity" + Date.now() + Math.floor(Math.random() * 1000);
      const script = document.createElement("script");
      const url = new URL(config.registrationWebhook);
      const timeoutId = window.setTimeout(function () {
        cleanup();
        reject(new Error("Capacity request timed out."));
      }, 12000);

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("Capacity request failed."));
      };

      url.searchParams.set("action", action);
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

  window.SUNNYSIDE_CAPACITY = {
    load: load,
    getCampStatus: getCampStatus
  };
})();
