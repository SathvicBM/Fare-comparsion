// Fare estimation based on approximate published rate cards for Bengaluru.
// These are ESTIMATES, not live quotes. Edit the numbers below to tune them.
// Fare = max(minFare, base + (distanceKm - baseKm) * perKm)

const SERVICES = [
  {
    id: "namma_yatri_auto",
    platform: "Namma Yatri",
    vehicle: "Auto",
    type: "auto",
    base: 30, baseKm: 2, perKm: 15, minFare: 30,
    note: "Zero-commission ONDC network"
  },
  {
    id: "rapido_auto",
    platform: "Rapido",
    vehicle: "Auto",
    type: "auto",
    base: 30, baseKm: 2, perKm: 16, minFare: 30,
    note: "Estimated from rate card"
  },
  {
    id: "rapido_bike",
    platform: "Rapido",
    vehicle: "Bike",
    type: "bike",
    base: 20, baseKm: 2, perKm: 9, minFare: 20,
    note: "Estimated from rate card"
  },
  {
    id: "ola_mini",
    platform: "Ola",
    vehicle: "Cab (Mini)",
    type: "cab",
    base: 60, baseKm: 2, perKm: 14, minFare: 60,
    note: "Estimated from rate card"
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
