const express = require("express");
const cors = require("cors");
const path = require("path");
const { estimateFares } = require("./fare");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Bengaluru geographic bounding box
const BBOX = { minLon: 77.30, minLat: 12.70, maxLon: 77.90, maxLat: 13.30 };
const CENTER = { lat: 12.9716, lng: 77.5946 };

const inBengaluru = (p) =>
  p &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  p.lat >= BBOX.minLat && p.lat <= BBOX.maxLat &&
  p.lng >= BBOX.minLon && p.lng <= BBOX.maxLon;

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Real road distance + GeoJSON geometry from OSRM
async function getRoute(a, b) {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error("OSRM " + r.status);
    const data = await r.json();
    const route = data.routes && data.routes[0];
    if (!route) throw new Error("No route");
    return {
      distanceKm: route.distance / 1000,
      durationMin: (route.duration / 60) * 1.25, // 1.25 factor for realistic Bengaluru traffic
      geometry: route.geometry,
      source: "road"
    };
  } catch (err) {
    const straight = haversineKm(a, b);
    const km = straight * 1.38; // Real road factor in Bengaluru
    return {
      distanceKm: km,
      durationMin: (km / 18) * 60, // ~18 km/h city average
      geometry: null,
      source: "estimate"
    };
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true, version: "2.1-luxury" }));

// GET /api/geocode?q=koramangala
app.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json([]);

  const bbox = `${BBOX.minLon},${BBOX.minLat},${BBOX.maxLon},${BBOX.maxLat}`;
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6` +
    `&lat=${CENTER.lat}&lon=${CENTER.lng}&bbox=${bbox}`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "FareCompare/2.0 (Bengaluru Transit App)" },
      signal: AbortSignal.timeout(6000)
    });
    if (!r.ok) throw new Error("Photon " + r.status);
    const data = await r.json();

    const seen = new Set();
    const results = (data.features || [])
      .map((f) => {
        const p = f.properties || {};
        const [lng, lat] = f.geometry.coordinates;
        const label = [p.name, p.street, p.district || p.suburb, p.city]
          .filter(Boolean)
          .join(", ");
        return { label, lat, lng };
      })
      .filter((x) => x.label && inBengaluru(x))
      .filter((x) => (seen.has(x.label) ? false : seen.add(x.label)));

    res.json(results);
  } catch (err) {
    res.status(502).json({ error: "Address search is unavailable right now." });
  }
});

// POST /api/compare { pickup: {lat,lng,label}, drop: {lat,lng,label} }
app.post("/api/compare", async (req, res) => {
  const { pickup, drop } = req.body || {};

  if (!inBengaluru(pickup) || !inBengaluru(drop)) {
    return res
      .status(400)
      .json({ error: "Pickup and destination drop must both be within the Bengaluru metropolitan area." });
  }

  const isAirport = Boolean(
    (drop.label && /airport|blr|kempegowda/i.test(drop.label)) ||
    (pickup.label && /airport|blr|kempegowda/i.test(pickup.label)) ||
    drop.lat > 13.15 || pickup.lat > 13.15
  );

  const route = await getRoute(pickup, drop);
  const fares = estimateFares(route.distanceKm, isAirport);

  res.json({
    distanceKm: Number(route.distanceKm.toFixed(1)),
    durationMin: Math.max(5, Math.round(route.durationMin)),
    distanceSource: route.source,
    geometry: route.geometry,
    fares,
    cheapest: fares[0].id
  });
});

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.listen(PORT, () => {
  console.log(`FareCompare Server running at http://localhost:${PORT}`);
});
