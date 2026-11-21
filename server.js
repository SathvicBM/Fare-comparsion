const express = require("express");
const cors = require("cors");
const path = require("path");
const { estimateFares } = require("./fare");
const { estimateBusFares } = require("./bus");
const gtfs = require("./gtfs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Bengaluru area: results are restricted to this box so addresses
// can't match a same-named place somewhere else in the world.
const BBOX = { minLon: 77.35, minLat: 12.75, maxLon: 77.85, maxLat: 13.25 };
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

// Real road distance + route shape from the public OSRM server.
// Falls back to straight-line distance x 1.3 if OSRM is unreachable.
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
      durationMin: route.duration / 60,
      geometry: route.geometry,
      source: "road"
    };
  } catch (err) {
    const km = haversineKm(a, b) * 1.3;
    return {
      distanceKm: km,
      durationMin: (km / 22) * 60,
      geometry: null,
      source: "estimate"
    };
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Is bus schedule data loaded? (handy while setting up the GTFS files)
app.get("/api/bus/status", (req, res) => res.json(gtfs.info()));

// GET /api/geocode?q=koramangala  ->  [{ label, lat, lng }]
app.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 3) return res.json([]);

  const bbox = `${BBOX.minLon},${BBOX.minLat},${BBOX.maxLon},${BBOX.maxLat}`;
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5` +
    `&lat=${CENTER.lat}&lon=${CENTER.lng}&bbox=${bbox}`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "FareCompare/1.0 (student project)" },
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

// POST /api/compare  { pickup: {lat,lng}, drop: {lat,lng}, departAt?: ISO time }
app.post("/api/compare", async (req, res) => {
  const { pickup, drop, departAt } = req.body || {};

  if (!inBengaluru(pickup) || !inBengaluru(drop)) {
    return res
      .status(400)
      .json({ error: "Pickup and drop must both be inside Bengaluru." });
  }
  if (departAt !== undefined && Number.isNaN(new Date(departAt).getTime())) {
    return res.status(400).json({ error: "departAt must be a valid date-time." });
  }

  const route = await getRoute(pickup, drop);

  // Buses: scheduled direct services (from GTFS) plus an estimated fare.
  const transit = gtfs.findDirectBuses(pickup, drop, gtfs.istNow(departAt));
  let busFares = estimateBusFares(route.distanceKm).map((f) => ({
    ...f,
    availability: transit.status !== "ready" ? "unchecked" : transit.options.length ? "scheduled" : "none"
  }));
  if (transit.status === "ready" && !transit.options.length) busFares = []; // no direct bus, so don't list one

  const fares = [...estimateFares(route.distanceKm), ...busFares].sort((a, b) => a.fare - b.fare);

  res.json({
    distanceKm: Number(route.distanceKm.toFixed(1)),
    durationMin: Math.round(route.durationMin),
    distanceSource: route.source,
    geometry: route.geometry,
    fares,
    cheapest: fares[0].id,
    transit
  });
});

// Serve the frontend from the same server (handy for one-click deploys).
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.listen(PORT, () => {
  console.log(`FareCompare running at http://localhost:${PORT}`);
  gtfs.load(); // loads bus schedules in the background if backend/data/gtfs exists
});
