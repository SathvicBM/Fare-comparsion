// Realistic Fare Estimation based on official Karnataka Transport Department
// norms and actual live rate card benchmarks in Bengaluru (2025-2026).
// Fares account for base fare, per-km rates, platform convenience fees, and airport toll slabs.

const SERVICES = [
  {
    id: "rapido_bike",
    platform: "Rapido",
    vehicle: "Bike Taxi",
    type: "bike",
    base: 30,
    baseKm: 2,
    perKm: 11,
    minFare: 30,
    note: "Agile Solo Commute &middot; Traffic Saver",
    appUrl: "https://www.rapido.bike/"
  },
  {
    id: "namma_yatri_auto",
    platform: "Namma Yatri",
    vehicle: "Auto Rickshaw",
    type: "auto",
    base: 40,       // ₹30 RTO base + ₹10 driver pickup allowance
    baseKm: 2,
    perKm: 15,      // Bengaluru RTO standard ₹15/km
    minFare: 40,
    note: "100% Direct to Driver &middot; ONDC Zero Commission",
    appUrl: "https://m.nammayatri.in/"
  },
  {
    id: "rapido_auto",
    platform: "Rapido",
    vehicle: "Auto Rickshaw",
    type: "auto",
    base: 45,       // ₹35 base + ₹10 tech convenience fee
    baseKm: 2,
    perKm: 16.5,    // ₹16.5/km aggregator rate
    minFare: 45,
    note: "Quick Dispatch &middot; Live Meter Tracking",
    appUrl: "https://www.rapido.bike/"
  },
  {
    id: "ola_mini",
    platform: "Ola",
    vehicle: "Cab (Mini Hatchback)",
    type: "cab",
    base: 110,      // Bengaluru revised taxi base (first 4 km)
    baseKm: 4,
    perKm: 23,      // Revised ₹23/km city cab rate
    minFare: 110,
    note: "AC Private Cabin &middot; Weather & Luggage Comfort",
    appUrl: "https://book.olacabs.com/"
  }
];

function estimateFares(distanceKm, isAirport = false) {
  return SERVICES.map((s) => {
    const extraKm = Math.max(0, distanceKm - s.baseKm);
    let fare = Math.max(s.minFare, s.base + extraKm * s.perKm);

    // If destination is Kempegowda Airport, add toll bridge surcharge for cabs
    if (isAirport && s.type === "cab") {
      fare += 115; // Devanahalli Trumpet Toll
    }

    return {
      id: s.id,
      platform: s.platform,
      vehicle: s.vehicle,
      type: s.type,
      note: isAirport && s.type === "cab" ? s.note + " (Includes Airport Toll ₹115)" : s.note,
      fare: Math.round(fare),
      appUrl: s.appUrl
    };
  }).sort((a, b) => a.fare - b.fare);
}

module.exports = { estimateFares, SERVICES };
