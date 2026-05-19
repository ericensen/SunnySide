(function (root) {
  function calculateSeatCount(camps, kids) {
    return asArray(camps).length * asArray(kids).length;
  }

  function calculateTotalDue(seatCount, pricePerKid) {
    return Number(seatCount || 0) * Number(pricePerKid || 0);
  }

  function isEligibleAge(age, minAge, maxAge) {
    const parsedAge = Number(age);

    return Number.isInteger(parsedAge) && parsedAge >= minAge && parsedAge <= maxAge;
  }

  function getIneligibleChildren(children, minAge, maxAge) {
    return asArray(children).filter(function (kid) {
      return !isEligibleAge(kid.age, minAge, maxAge);
    });
  }

  function getSoldOutSelections(camps, children, getCampStatus) {
    const requestedSeatsPerCamp = asArray(children).length;

    return asArray(camps).filter(function (camp) {
      const availability = getCampStatus ? getCampStatus(camp.slug) : { soldOut: false };

      return Boolean(availability.soldOut) || availability.remainingSpots < requestedSeatsPerCamp;
    });
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const api = {
    calculateSeatCount: calculateSeatCount,
    calculateTotalDue: calculateTotalDue,
    isEligibleAge: isEligibleAge,
    getIneligibleChildren: getIneligibleChildren,
    getSoldOutSelections: getSoldOutSelections
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  root.SUNNYSIDE_CHECKOUT_LOGIC = api;
})(typeof window !== "undefined" ? window : globalThis);
