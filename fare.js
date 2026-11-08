// Fare estimation based on published rate cards for Bengaluru (updated 2025).
// These are ESTIMATES, not live quotes. Edit the numbers below to tune them.
// Formula: fare = max(minFare, base + (distanceKm - baseKm) * perKm)
//
// Sources:
//   Namma Yatri / Auto meter: Karnataka RTA revised rate (Aug 2025) —
//     ₹36 for first 2 km, ₹18/km thereafter.
//   Rapido Auto: approx ₹46 min fare, ₹16/km after base.
//   Rapido Bike: approx ₹25 base, ₹7/km — Karnataka Transport Dept data.
//   Ola Mini: Karnataka cab fare regulation (Feb 2024) —
//     ₹100 for first 4 km, ₹24/km thereafter.

const SERVICES = [
  {
    id: "namma_yatri_auto",
    platform: "Namma Yatri",
    vehicle: "Auto",
    type: "auto",
    base: 36, baseKm: 2, perKm: 18, minFare: 36,
    note: "Karnataka govt meter rate · zero commission"
  },
  {
    id: "rapido_auto",
    platform: "Rapido",
    vehicle: "Auto",
    type: "auto",
    base: 46, baseKm: 2, perKm: 16, minFare: 46,
    note: "Estimated from Rapido rate card"
  },
  {
    id: "rapido_bike",
    platform: "Rapido",
    vehicle: "Bike",
    type: "bike",
    base: 25, baseKm: 2, perKm: 7, minFare: 25,
    note: "Estimated from Rapido rate card"
  },
  {
    id: "ola_mini",
    platform: "Ola",
    vehicle: "Cab (Mini)",
    type: "cab",
    base: 100, baseKm: 4, perKm: 24, minFare: 100,
    note: "Karnataka regulated cab fare (Feb 2024)"
  }
];

function estimateFares(distanceKm) {
  return SERVICES.map((s) => {
    const extraKm = Math.max(0, distanceKm - s.baseKm);
    const fare = Math.max(s.minFare, s.base + extraKm * s.perKm);
    return {
      id: s.id,
      platform: s.platform,
      vehicle: s.vehicle,
      type: s.type,
      note: s.note,
      fare: Math.round(fare)
    };
  }).sort((a, b) => a.fare - b.fare);
}

module.exports = { estimateFares };
