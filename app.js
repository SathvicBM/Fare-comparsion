/**
 * FareCompare Hyperiux Pro (v3.0)
 * Signature Interaction Layer:
 * - 60fps Interactive Particle Constellation Mesh (Hyperiux Canvas)
 * - HTML5 Geolocation Sensor ("Use Current Location")
 * - 3D Card Hover Tilt with Cursor Glare Tracking
 * - Direct OSRM Real Road Routing & Turn-by-Turn GeoJSON Geometry
 * - Native CartoDB Dark Matter Retina Tiles
 * - 2026 Realistic Bengaluru Regulatory Rate Cards
 * - Eco Footprint & Carbon Metrics per Vehicle
 * - Direct App Deep-Link Launcher (Ola, Namma Yatri, Rapido)
 */

const API = (window.API_BASE || "").replace(/\/$/, "");

const $ = (id) => document.getElementById(id);
const els = {
  form: $("compare"),
  error: $("error"),
  btn: $("compareBtn"),
  results: $("results"),
  cards: $("cards"),
  fine: $("fine"),
  mapHint: $("mapHint"),
  routeMetricsChip: $("routeMetricsChip"),
  mapMetricDistance: $("mapMetricDistance"),
  mapMetricDuration: $("mapMetricDuration"),
  mapTrafficStatus: $("mapTrafficStatus"),
  trafficBadge: $("trafficBadge"),
  trafficText: $("trafficText"),
  geoBtn: $("geoBtn")
};

// Curated Bangalore Landmark Database with Precise GPS Coordinates
const BENGALURU_HUBS = [
  { label: "Koramangala 5th Block, Bengaluru", lat: 12.9352, lng: 77.6245, tag: "Tech & Lifestyle" },
  { label: "Indiranagar 100ft Road, Bengaluru", lat: 12.9719, lng: 77.6412, tag: "Commercial Hub" },
  { label: "Manyata Tech Park, Nagavara, Bengaluru", lat: 13.0475, lng: 77.6212, tag: "Tech Corridor" },
  { label: "HSR Layout Sector 1, Bengaluru", lat: 12.9121, lng: 77.6446, tag: "Residential & Startups" },
  { label: "MG Road Metro Station, Bengaluru", lat: 12.9756, lng: 77.6066, tag: "Central Metro" },
  { label: "Kempegowda International Airport (BLR), Devanahalli", lat: 13.1986, lng: 77.7066, tag: "Airport Hub" },
  { label: "Electronic City Phase 1, Bengaluru", lat: 12.8452, lng: 77.6602, tag: "IT Hub" },
  { label: "Bellandur Outer Ring Road, Bengaluru", lat: 12.9260, lng: 77.6762, tag: "Tech Corridor" },
  { label: "Whitefield ITPL Main Road, Bengaluru", lat: 12.9863, lng: 77.7308, tag: "Tech Hub" },
  { label: "Jayanagar 4th Block, Bengaluru", lat: 12.9299, lng: 77.5824, tag: "South Bangalore" },
  { label: "Marathahalli Bridge, Bengaluru", lat: 12.9592, lng: 77.6974, tag: "Transit Junction" },
  { label: "Church Street, Central Bengaluru", lat: 12.9749, lng: 77.6074, tag: "Heart of City" },
  { label: "Krantivira Sangolli Rayanna (Majestic) Railway Station", lat: 12.9781, lng: 77.5696, tag: "Intercity Transit" },
  { label: "Hebbal Flyover, Bengaluru", lat: 13.0358, lng: 77.5970, tag: "North Gateway" },
  { label: "Banashankari 2nd Stage, Bengaluru", lat: 12.9255, lng: 77.5654, tag: "Heritage Hub" }
];

// 2026 Realistic Bengaluru Regulatory Rate Cards & Carbon Profiles
const SERVICES = [
  {
    id: "rapido_bike",
    platform: "Rapido",
    vehicle: "Bike Taxi",
    type: "bike",
    base: 30,       // ₹30 base for first 2 km
    baseKm: 2,
    perKm: 11,      // ₹11 per km thereafter
    minFare: 30,
    co2PerKm: 28,   // 28g CO2/km (Eco Champion)
    note: "Agile Solo Commute &middot; Traffic Slicer",
    getAppUrl: (pickup, drop) => "https://www.rapido.bike/"
  },
  {
    id: "namma_yatri_auto",
    platform: "Namma Yatri",
    vehicle: "Auto Rickshaw",
    type: "auto",
    base: 40,       // ₹30 RTO base + ₹10 pickup fee
    baseKm: 2,
    perKm: 15,      // ₹15 per km (Karnataka Govt RTO standard)
    minFare: 40,
    co2PerKm: 65,   // 65g CO2/km
    note: "100% Direct to Driver &middot; ONDC Zero Commission",
    getAppUrl: (pickup, drop) => "https://m.nammayatri.in/"
  },
  {
    id: "rapido_auto",
    platform: "Rapido",
    vehicle: "Auto Rickshaw",
    type: "auto",
    base: 45,       // ₹35 base + ₹10 tech fee
    baseKm: 2,
    perKm: 16.5,    // ₹16.5 per km aggregator slab
    minFare: 45,
    co2PerKm: 65,   // 65g CO2/km
    note: "Quick Dispatch &middot; Live Meter Tracking",
    getAppUrl: (pickup, drop) => "https://www.rapido.bike/"
  },
  {
    id: "ola_mini",
    platform: "Ola",
    vehicle: "Cab (Mini Hatchback)",
    type: "cab",
    base: 110,      // Bengaluru revised cab minimum (first 4 km)
    baseKm: 4,
    perKm: 23,      // Revised ₹23 per km city rate
    minFare: 110,
    co2PerKm: 140,  // 140g CO2/km
    note: "AC Private Cabin &middot; Weather & Luggage Comfort",
    getAppUrl: (pickup, drop) =>
      `https://book.olacabs.com/?pickup_lat=${pickup.lat}&pickup_lng=${pickup.lng}&drop_lat=${drop.lat}&drop_lng=${drop.lng}&pickup_name=${encodeURIComponent(pickup.label)}&drop_name=${encodeURIComponent(drop.label)}`
  }
];

// Active State
let currentFareData = null;
let currentPickup = null;
let currentDrop = null;
let activeVehicleFilter = "all";

// ============================================================================
// 1. HYPERIUX INTERACTIVE AMBIENT PARTICLE CANVAS (Constellation Effect)
// ============================================================================
function initHyperiuxCanvas() {
  const canvas = $("hyperiuxCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width, height;
  let particles = [];
  const mouse = { x: -1000, y: -1000, radius: 140 };

  const resize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  const count = Math.min(50, Math.floor((width * height) / 25000));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 1.6 + 0.6,
      alpha: Math.random() * 0.5 + 0.2
    });
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      // Mouse proximity interaction
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouse.radius) {
        const force = (1 - dist / mouse.radius) * 0.8;
        p.x -= (dx / dist) * force;
        p.y -= (dy / dist) * force;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 158, 11, ${p.alpha})`;
      ctx.fill();

      // Connecting lines
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const d = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(245, 158, 11, ${(1 - d / 110) * 0.12})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
}

// ============================================================================
// 2. LEAFLET MAP (CartoDB Dark Matter Retina Tiles)
// ============================================================================
const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true
}).setView([12.9716, 77.5946], 12);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 19,
  subdomains: "abcd",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
}).addTo(map);

setTimeout(() => { map.invalidateSize(); }, 300);
window.addEventListener("resize", () => { map.invalidateSize(); });

let mapLayers = [];
const clearMap = () => {
  mapLayers.forEach((l) => map.removeLayer(l));
  mapLayers = [];
};

function createHyperPin(color, glowColor) {
  return L.divIcon({
    className: "hyper-pin",
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:-4px;border-radius:50%;background:${glowColor};opacity:0.65;animation:pinPulse 2s infinite ease-in-out;"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 3px 14px rgba(0,0,0,0.9);z-index:2;"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function drawRoute(pickup, drop, geometry) {
  clearMap();

  const pickupPin = createHyperPin("#fbbf24", "rgba(245, 158, 11, 0.5)");
  const dropPin = createHyperPin("#f97316", "rgba(249, 115, 22, 0.5)");

  const a = L.marker([pickup.lat, pickup.lng], { icon: pickupPin })
    .addTo(map)
    .bindPopup(`<b>Pickup:</b><br>${pickup.label || "Pickup Point"}`);

  const b = L.marker([drop.lat, drop.lng], { icon: dropPin })
    .addTo(map)
    .bindPopup(`<b>Destination:</b><br>${drop.label || "Destination Point"}`);

  let coords;
  if (geometry && geometry.coordinates && geometry.coordinates.length > 0) {
    coords = geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } else {
    // Elegant curved line fallback if geometry is unavailable
    const latMid = (pickup.lat + drop.lat) / 2 + 0.012;
    const lngMid = (pickup.lng + drop.lng) / 2 - 0.010;
    coords = [[pickup.lat, pickup.lng], [latMid, lngMid], [drop.lat, drop.lng]];
  }

  // Draw luminous cyber-gold background road glow
  const glowLine = L.polyline(coords, {
    color: "rgba(245, 158, 11, 0.38)",
    weight: 9.5,
    opacity: 0.85,
    lineCap: "round"
  }).addTo(map);

  // Draw crisp foreground road polyline
  const mainLine = L.polyline(coords, {
    color: "#fbbf24",
    weight: 4.5,
    opacity: 0.98,
    lineCap: "round",
    dashArray: geometry ? null : "6 6"
  }).addTo(map);

  mapLayers.push(a, b, glowLine, mainLine);

  try {
    map.fitBounds(mainLine.getBounds(), { padding: [55, 55], maxZoom: 15 });
  } catch (e) {
    map.setView([pickup.lat, pickup.lng], 12);
  }

  setTimeout(() => { map.invalidateSize(); }, 150);

  if (els.mapHint) els.mapHint.hidden = true;
}

// ============================================================================
// 3. OSRM ROAD ROUTING & REGULATORY BENGALURU FARES
// ============================================================================
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

async function fetchRealRoadRoute(pickup, drop) {
  // If backend API is configured and available, try it first
  if (API) {
    try {
      const res = await fetch(`${API}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { lat: pickup.lat, lng: pickup.lng, label: pickup.label },
          drop: { lat: drop.lat, lng: drop.lng, label: drop.label }
        }),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Backend API not reachable, falling back to direct OSRM road routing:", e);
    }
  }

  // Direct client-side OSRM routing (CORS supported, works seamlessly on GitHub Pages)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error("OSRM status " + res.status);
    const data = await res.json();
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      const distKm = Number((route.distance / 1000).toFixed(1));
      // Realistic Bengaluru traffic: ~1.25x base duration factor
      const durationMin = Math.max(5, Math.round((route.duration / 60) * 1.25));
      const fares = calculateBengaluruFares(distKm, pickup, drop);

      return {
        distanceKm: distKm,
        durationMin: durationMin,
        distanceSource: "road",
        geometry: route.geometry,
        fares: fares,
        cheapest: fares[0].id
      };
    }
  } catch (err) {
    console.warn("Direct OSRM route fetch timed out or unavailable, using Bengaluru road tortuosity factor:", err);
  }

  // High-accuracy fallback: Bengaluru road tortuosity factor (1.38x straight line)
  const straight = haversineKm(pickup, drop);
  const roadKm = Number((straight * 1.38).toFixed(1));
  const estMin = Math.max(5, Math.round((roadKm / 18) * 60)); // ~18 km/h city average
  const fares = calculateBengaluruFares(roadKm, pickup, drop);

  return {
    distanceKm: roadKm,
    durationMin: estMin,
    distanceSource: "estimate",
    geometry: null,
    fares: fares,
    cheapest: fares[0].id
  };
}

function calculateBengaluruFares(distanceKm, pickup, drop) {
  const isAirport = Boolean(
    (drop.label && /airport|blr|kempegowda/i.test(drop.label)) ||
    (pickup.label && /airport|blr|kempegowda/i.test(pickup.label)) ||
    drop.lat > 13.15 || pickup.lat > 13.15
  );

  return SERVICES.map((s) => {
    const extraKm = Math.max(0, distanceKm - s.baseKm);
    let fare = Math.max(s.minFare, s.base + extraKm * s.perKm);

    // Kempegowda Airport Trumpet Interchange Toll (~₹115 for cabs)
    if (isAirport && s.type === "cab") {
      fare += 115;
    }

    const co2Total = Math.round(s.co2PerKm * distanceKm);

    return {
      id: s.id,
      platform: s.platform,
      vehicle: s.vehicle,
      type: s.type,
      note: isAirport && s.type === "cab" ? s.note + " (Airport Toll Included)" : s.note,
      fare: Math.round(fare),
      co2: co2Total,
      appUrl: s.getAppUrl(pickup, drop)
    };
  }).sort((a, b) => a.fare - b.fare);
}

// ============================================================================
// 4. AUTOCOMPLETE WITH BENGALURU HUBS & GEOLOCATION
// ============================================================================
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function setupAutocomplete(inputId, listId) {
  const input = $(inputId);
  const list = $(listId);
  const state = { selected: null };

  const hide = () => {
    list.hidden = true;
    list.innerHTML = "";
  };

  const search = debounce(async () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) return hide();

    let items = [];

    // Backend or Photon geocoder
    try {
      const geoUrl = API
        ? `${API}/api/geocode?q=${encodeURIComponent(q)}`
        : `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lat=12.9716&lon=77.5946&bbox=77.30,12.70,77.90,13.30`;

      const res = await fetch(geoUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          items = data;
        } else if (data.features) {
          items = data.features.map((f) => {
            const p = f.properties || {};
            const [lng, lat] = f.geometry.coordinates;
            return {
              label: [p.name, p.street, p.district || p.suburb, p.city].filter(Boolean).join(", "),
              lat, lng, tag: "Bengaluru"
            };
          }).filter((x) => x.label);
        }
      }
    } catch (e) {
      // Ignore network errors, local hubs will fulfill
    }

    // Merge with curated local hubs
    const localMatches = BENGALURU_HUBS.filter((h) =>
      h.label.toLowerCase().includes(q)
    );

    const merged = [...items];
    const seen = new Set(merged.map((m) => m.label.toLowerCase()));

    localMatches.forEach((h) => {
      if (!seen.has(h.label.toLowerCase())) {
        merged.push(h);
        seen.add(h.label.toLowerCase());
      }
    });

    if (!merged.length) return hide();

    list.innerHTML = "";
    merged.slice(0, 6).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${item.label}</span>
        <span class="suggest-tag">${item.tag || "Bengaluru"}</span>
      `;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = item.label;
        state.selected = item;
        hide();
      });
      list.appendChild(li);
    });
    list.hidden = false;
  }, 220);

  input.addEventListener("input", () => {
    state.selected = null;
    search();
  });
  input.addEventListener("blur", () => setTimeout(hide, 180));

  return { input, state };
}

const pickupField = setupAutocomplete("pickup", "pickupSuggest");
const dropField = setupAutocomplete("drop", "dropSuggest");

async function resolve(field, defaultHub) {
  if (field.state.selected) return field.state.selected;

  const q = (field.input.value.trim() || defaultHub.label).toLowerCase();

  const match = BENGALURU_HUBS.find((h) => h.label.toLowerCase().includes(q));
  if (match) {
    field.state.selected = match;
    field.input.value = match.label;
    return match;
  }

  field.state.selected = defaultHub;
  field.input.value = defaultHub.label;
  return defaultHub;
}

// "Use Current Location" GPS Sensor
if (els.geoBtn) {
  els.geoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showError("Geolocation is not supported by your browser.");
      return;
    }
    els.geoBtn.innerHTML = `<span>Locating...</span>`;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "My Current Location, Bengaluru"
        };
        pickupField.state.selected = coords;
        pickupField.input.value = coords.label;
        els.geoBtn.innerHTML = `<span>&check; Located</span>`;
        setTimeout(() => {
          els.geoBtn.innerHTML = `<span>Current Location</span>`;
        }, 2000);
      },
      (err) => {
        els.geoBtn.innerHTML = `<span>Current Location</span>`;
        showError("GPS Location permission denied or unavailable.");
      },
      { timeout: 8000 }
    );
  });
}

// Swap Functionality
$("swapBtn").addEventListener("click", () => {
  const a = pickupField;
  const b = dropField;
  [a.input.value, b.input.value] = [b.input.value, a.input.value];
  [a.state.selected, b.state.selected] = [b.state.selected, a.state.selected];
});

// Popular Route Preset Chips
document.querySelectorAll(".chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");

    const pName = btn.getAttribute("data-pickup");
    const dName = btn.getAttribute("data-drop");

    const pHub = BENGALURU_HUBS.find((h) => h.label.includes(pName)) || {
      label: pName + ", Bengaluru", lat: 12.9352, lng: 77.6245
    };
    const dHub = BENGALURU_HUBS.find((h) => h.label.includes(dName)) || {
      label: dName + ", Bengaluru", lat: 12.9719, lng: 77.6412
    };

    pickupField.input.value = pHub.label;
    pickupField.state.selected = pHub;

    dropField.input.value = dHub.label;
    dropField.state.selected = dHub;

    els.form.dispatchEvent(new Event("submit"));
  });
});

// Vehicle Segment Bar
document.querySelectorAll(".segment-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".segment-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeVehicleFilter = tab.getAttribute("data-filter");
    if (currentFareData) {
      renderCards(currentFareData);
    }
  });
});

// ============================================================================
// 5. 3D CARD TILT & LIVE RENDER
// ============================================================================
function enableCardTilt(card) {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0)";
  });
}

function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}

function renderCards(data) {
  const fares = data.fares;
  const filteredFares = activeVehicleFilter === "all"
    ? fares
    : fares.filter((f) => f.type === activeVehicleFilter);

  const maxFare = Math.max(...fares.map((f) => f.fare));
  const cheapestOverall = fares[0].fare;
  const priciestOverall = fares[fares.length - 1].fare;

  // Render Stats
  $("statDistance").textContent = `${data.distanceKm} km`;
  $("statTime").textContent = `${data.durationMin} min`;
  $("statSave").textContent = `₹${priciestOverall - cheapestOverall}`;

  // Update Route HUD on map
  if (els.routeMetricsChip) {
    els.routeMetricsChip.hidden = false;
    els.mapMetricDistance.textContent = `${data.distanceKm} km`;
    els.mapMetricDuration.textContent = `${data.durationMin} min`;
    if (els.mapTrafficStatus) {
      els.mapTrafficStatus.textContent = data.durationMin > 50 ? "Heavy Peak" : "Moderate";
      els.mapTrafficStatus.className = `m-val ${data.durationMin > 50 ? "orange" : "green"}`;
    }
  }

  els.cards.innerHTML = "";

  if (filteredFares.length === 0) {
    els.cards.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
        No rides available for vehicle filter: <strong>${activeVehicleFilter}</strong>.
      </div>
    `;
    return;
  }

  filteredFares.forEach((f) => {
    const isBest = f.fare === cheapestOverall;
    const card = document.createElement("div");
    card.className = "card" + (isBest ? " best" : "");

    const badge = isBest
      ? `<span class="badge-best-value">&#10024; Lowest Benchmark</span>`
      : "";

    let vehicleIcon = "🛺";
    if (f.type === "bike") vehicleIcon = "🏍️";
    if (f.type === "cab") vehicleIcon = "🚕";

    const bookUrl = f.appUrl || "https://m.nammayatri.in/";

    card.innerHTML = `
      ${badge}
      <div class="card-head">
        <div class="card-platform-info">
          <div class="platform-name">${f.platform}</div>
          <div class="vehicle">
            <span>${vehicleIcon} ${f.vehicle}</span>
            <span class="eco-tag">${f.co2}g CO₂</span>
          </div>
        </div>
        <div class="price-tag">
          <span class="price-label">Estimated Fare</span>
          <div class="price">₹${f.fare}</div>
        </div>
      </div>
      <div class="fare-relative-bar"><span></span></div>
      <div class="note-box">
        <span class="note">${f.note}</span>
        <a href="${bookUrl}" target="_blank" rel="noopener noreferrer" class="book-action-btn" title="Open ${f.platform} to book this ride">
          <span>Book on ${f.platform}</span>
          <span>&rarr;</span>
        </a>
      </div>
    `;

    els.cards.appendChild(card);
    enableCardTilt(card);

    // Animate progress bar smoothly
    requestAnimationFrame(() => {
      const pct = Math.min(100, Math.round((f.fare / maxFare) * 100));
      card.querySelector(".fare-relative-bar > span").style.width = `${pct}%`;
    });
  });

  els.fine.textContent =
    (data.distanceSource === "road"
      ? "Distance calculated via turn-by-turn road navigation routing. "
      : "Routing calculated via Bengaluru city road factor geometry. ") +
    "Fares represent published 2026 regulatory rate cards. Live peak surge or tolls may vary dynamically inside provider apps.";

  els.results.hidden = false;
}

// ============================================================================
// 6. FORM SUBMISSION
// ============================================================================
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  els.btn.disabled = true;
  els.btn.innerHTML = `
    <span class="btn-text">Calculating Itinerary &amp; Rates&hellip;</span>
  `;

  try {
    const [pickup, drop] = await Promise.all([
      resolve(pickupField, BENGALURU_HUBS[0]),
      resolve(dropField, BENGALURU_HUBS[1])
    ]);

    currentPickup = pickup;
    currentDrop = drop;

    const data = await fetchRealRoadRoute(pickup, drop);
    currentFareData = data;

    drawRoute(pickup, drop, data.geometry);
    renderCards(data);

    setTimeout(() => {
      els.results.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);

  } catch (err) {
    showError(err.message || "Unable to trace road route. Please verify locations.");
  } finally {
    els.btn.disabled = false;
    els.btn.innerHTML = `
      <span class="btn-shine"></span>
      <span class="btn-text">Compute Real Road Itinerary &amp; Fares</span>
      <svg viewBox="0 0 20 20" fill="currentColor" class="btn-chevron">
        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    `;
  }
});

// Update Year in Footer
const yearSpan = $("year");
if (yearSpan) yearSpan.textContent = new Date().getFullYear();

// Initialize Ambient Particle Canvas & Auto-Render
window.addEventListener("DOMContentLoaded", () => {
  initHyperiuxCanvas();

  pickupField.input.value = BENGALURU_HUBS[0].label;
  pickupField.state.selected = BENGALURU_HUBS[0];

  dropField.input.value = BENGALURU_HUBS[1].label;
  dropField.state.selected = BENGALURU_HUBS[1];

  setTimeout(() => {
    els.form.dispatchEvent(new Event("submit"));
  }, 400);
});
