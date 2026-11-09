/**
 * FareCompare – Luxury Frontend Application Logic
 * Integrates Leaflet Mapping, Photon Geocoding with Curated Fallback,
 * Route Profiling, and Real-Time Multi-Platform Fare Benchmarking.
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
  mapMetricDuration: $("mapMetricDuration")
};

// Curated Bangalore Landmark Database for Instant Autocomplete & Sandbox Resilience
const BENGALURU_HUBS = [
  { label: "Koramangala 5th Block, Bengaluru", lat: 12.9352, lng: 77.6245, tag: "Hub" },
  { label: "Indiranagar 100ft Road, Bengaluru", lat: 12.9719, lng: 77.6412, tag: "Commercial" },
  { label: "Manyata Tech Park, Nagavara, Bengaluru", lat: 13.0475, lng: 77.6212, tag: "Tech Park" },
  { label: "HSR Layout Sector 1, Bengaluru", lat: 12.9121, lng: 77.6446, tag: "Residential" },
  { label: "MG Road Metro Station, Bengaluru", lat: 12.9756, lng: 77.6066, tag: "Metro Hub" },
  { label: "Kempegowda International Airport (BLR), Devanahalli", lat: 13.1986, lng: 77.7066, tag: "Airport" },
  { label: "Electronic City Phase 1, Bengaluru", lat: 12.8452, lng: 77.6602, tag: "Tech Park" },
  { label: "Bellandur Outer Ring Road, Bengaluru", lat: 12.9260, lng: 77.6762, tag: "Tech Corridor" },
  { label: "Whitefield ITPL Main Road, Bengaluru", lat: 12.9863, lng: 77.7308, tag: "Tech Park" },
  { label: "Jayanagar 4th Block, Bengaluru", lat: 12.9299, lng: 77.5824, tag: "Shopping Hub" },
  { label: "Marathahalli Bridge, Bengaluru", lat: 12.9592, lng: 77.6974, tag: "Junction" },
  { label: "Church Street, Central Bengaluru", lat: 12.9749, lng: 77.6074, tag: "Lifestyle" },
  { label: "Krantivira Sangolli Rayanna (Majestic) Railway Station", lat: 12.9781, lng: 77.5696, tag: "Transit" },
  { label: "Hebbal Flyover, Bengaluru", lat: 13.0358, lng: 77.5970, tag: "Transit" },
  { label: "Banashankari 2nd Stage, Bengaluru", lat: 12.9255, lng: 77.5654, tag: "Residential" }
];

// Active State
let currentFareData = null;
let activeVehicleFilter = "all";

// ---------- Map Initialization with Luxury Aesthetic ----------
const map = L.map("map", { zoomControl: true }).setView([12.9716, 77.5946], 11);

// High-contrast OpenStreetMap tiles styled via CSS filter
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors &middot; FareCompare"
}).addTo(map);

let mapLayers = [];
const clearMap = () => {
  mapLayers.forEach((l) => map.removeLayer(l));
  mapLayers = [];
};

function createLuxuryPin(color, glowColor) {
  return L.divIcon({
    className: "custom-luxury-pin",
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:-4px;border-radius:50%;background:${glowColor};opacity:0.6;animation:pinPulse 2s infinite ease-in-out;"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 3px 12px rgba(0,0,0,0.7);z-index:2;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function drawRoute(pickup, drop, geometry) {
  clearMap();

  const pickupPin = createLuxuryPin("#e5c07b", "rgba(229, 192, 123, 0.45)");
  const dropPin = createLuxuryPin("#e08244", "rgba(224, 130, 68, 0.45)");

  const a = L.marker([pickup.lat, pickup.lng], { icon: pickupPin })
    .addTo(map)
    .bindPopup(`<b>Pickup:</b><br>${pickup.label || "Pickup Point"}`);

  const b = L.marker([drop.lat, drop.lng], { icon: dropPin })
    .addTo(map)
    .bindPopup(`<b>Destination:</b><br>${drop.label || "Destination Point"}`);

  const coords = geometry && geometry.coordinates
    ? geometry.coordinates.map(([lng, lat]) => [lat, lng])
    : [[pickup.lat, pickup.lng], [drop.lat, drop.lng]];

  // Draw background route glow
  const glowLine = L.polyline(coords, {
    color: "rgba(229, 192, 123, 0.35)",
    weight: 9,
    opacity: 0.8,
    lineCap: "round"
  }).addTo(map);

  // Draw crisp foreground polyline
  const mainLine = L.polyline(coords, {
    color: "#e5c07b",
    weight: 4,
    opacity: 0.95,
    lineCap: "round",
    dashArray: geometry ? null : "6 6"
  }).addTo(map);

  mapLayers.push(a, b, glowLine, mainLine);
  map.fitBounds(mainLine.getBounds(), { padding: [50, 50] });

  if (els.mapHint) els.mapHint.hidden = true;
}

// ---------- Autocomplete with Geocoding & Local Fallback ----------
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

    // First try backend photon geocoder
    try {
      const res = await fetch(`${API}/api/geocode?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        items = await res.json();
      }
    } catch {
      // Backend or network unavailable; proceed to local hubs
    }

    // Merge with curated local Bengaluru hubs matching query
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
  }, 250);

  input.addEventListener("input", () => {
    state.selected = null;
    search();
  });
  input.addEventListener("blur", () => setTimeout(hide, 180));

  return { input, state };
}

const pickupField = setupAutocomplete("pickup", "pickupSuggest");
const dropField = setupAutocomplete("drop", "dropSuggest");

// Helper to resolve input text into geo coordinates
async function resolve(field, defaultQuery) {
  if (field.state.selected) return field.state.selected;

  const q = (field.input.value.trim() || defaultQuery || "").toLowerCase();
  if (!q) throw new Error("Please specify both a pickup and destination drop.");

  // Check local hubs first for exact or fuzzy match
  const localMatch = BENGALURU_HUBS.find((h) => h.label.toLowerCase().includes(q));
  if (localMatch) {
    field.state.selected = localMatch;
    field.input.value = localMatch.label;
    return localMatch;
  }

  // Try backend geocoding
  try {
    const res = await fetch(`${API}/api/geocode?q=${encodeURIComponent(q)}`);
    const items = await res.json();
    if (Array.isArray(items) && items.length > 0) {
      field.state.selected = items[0];
      field.input.value = items[0].label;
      return items[0];
    }
  } catch (err) {
    // Ignore and fallback below
  }

  // If still not matched, use closest known hub or coordinate anchor
  const fallback = BENGALURU_HUBS[0];
  return { label: field.input.value || fallback.label, lat: fallback.lat, lng: fallback.lng };
}

// ---------- Swap Functionality ----------
$("swapBtn").addEventListener("click", () => {
  const a = pickupField;
  const b = dropField;
  [a.input.value, b.input.value] = [b.input.value, a.input.value];
  [a.state.selected, b.state.selected] = [b.state.selected, a.state.selected];
});

// ---------- Popular Route Chips ----------
document.querySelectorAll(".route-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    const pickupName = btn.getAttribute("data-pickup");
    const dropName = btn.getAttribute("data-drop");

    const pickupHub = BENGALURU_HUBS.find((h) => h.label.includes(pickupName)) || {
      label: pickupName,
      lat: 12.9352,
      lng: 77.6245
    };
    const dropHub = BENGALURU_HUBS.find((h) => h.label.includes(dropName)) || {
      label: dropName,
      lat: 12.9719,
      lng: 77.6412
    };

    pickupField.input.value = pickupHub.label;
    pickupField.state.selected = pickupHub;

    dropField.input.value = dropHub.label;
    dropField.state.selected = dropHub;

    // Trigger comparison immediately
    els.form.dispatchEvent(new Event("submit"));
  });
});

// ---------- Vehicle Filter Tabs ----------
document.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeVehicleFilter = tab.getAttribute("data-filter");
    if (currentFareData) {
      renderCards(currentFareData);
    }
  });
});

// ---------- Client-side Fare Calculation (Fallback & Resiliency) ----------
const CLIENT_SERVICES = [
  {
    id: "namma_yatri_auto",
    platform: "Namma Yatri",
    vehicle: "Auto",
    type: "auto",
    base: 30,
    baseKm: 2,
    perKm: 15,
    minFare: 30,
    note: "100% Direct to Driver &middot; ONDC"
  },
  {
    id: "rapido_auto",
    platform: "Rapido",
    vehicle: "Auto",
    type: "auto",
    base: 30,
    baseKm: 2,
    perKm: 16,
    minFare: 30,
    note: "Quick Auto Dispatch"
  },
  {
    id: "rapido_bike",
    platform: "Rapido",
    vehicle: "Bike",
    type: "bike",
    base: 20,
    baseKm: 2,
    perKm: 9,
    minFare: 20,
    note: "Agile Solo Commute &middot; Traffic Saver"
  },
  {
    id: "ola_mini",
    platform: "Ola",
    vehicle: "Cab (Mini)",
    type: "cab",
    base: 60,
    baseKm: 2,
    perKm: 14,
    minFare: 60,
    note: "Air-Conditioned Private Cabin"
  }
];

function calculateFaresClientSide(distanceKm) {
  return CLIENT_SERVICES.map((s) => {
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

// ---------- Render Results ----------
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
  }

  els.cards.innerHTML = "";

  if (filteredFares.length === 0) {
    els.cards.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
        No ride matches found for vehicle filter: <strong>${activeVehicleFilter}</strong>.
      </div>
    `;
    return;
  }

  filteredFares.forEach((f, i) => {
    const isBest = f.fare === cheapestOverall;
    const card = document.createElement("div");
    card.className = "card" + (isBest ? " best" : "");

    const badge = isBest
      ? `<span class="badge-best-value">&#10024; Lowest Fare</span>`
      : "";

    // Vehicle icon picker
    let vehicleIcon = "🛺";
    if (f.type === "bike") vehicleIcon = "🏍️";
    if (f.type === "cab") vehicleIcon = "🚕";

    card.innerHTML = `
      ${badge}
      <div class="card-head">
        <div class="card-platform-info">
          <div class="platform-name">${f.platform}</div>
          <div class="vehicle">${vehicleIcon} ${f.vehicle}</div>
        </div>
        <div class="price-tag">
          <span class="price-label">Estimated</span>
          <div class="price">₹${f.fare}</div>
        </div>
      </div>
      <div class="fare-relative-bar"><span></span></div>
      <div class="note-box">
        <span class="note">${f.note}</span>
        <span class="book-hint-link">Book in App &rarr;</span>
      </div>
    `;

    els.cards.appendChild(card);

    // Animate the relative progress bar
    requestAnimationFrame(() => {
      const pct = Math.min(100, Math.round((f.fare / maxFare) * 100));
      card.querySelector(".fare-relative-bar > span").style.width = `${pct}%`;
    });
  });

  els.fine.textContent =
    (data.distanceSource === "road"
      ? "Distance measured via authentic road-network navigation routing. "
      : "Routing server was unreachable; distance determined via Bengaluru road-factor geometric calculation. ") +
    "Fares represent regulatory rate card baselines. Peak surge, road tolls, and wait times are excluded.";

  els.results.hidden = false;
}

// ---------- Form Submit Handler ----------
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  els.btn.disabled = true;
  els.btn.innerHTML = `
    <span class="btn-text">Calculating Route &amp; Rates&hellip;</span>
  `;

  try {
    const [pickup, drop] = await Promise.all([
      resolve(pickupField, "Koramangala 5th Block"),
      resolve(dropField, "Indiranagar 100ft Road")
    ]);

    let data = null;

    // Attempt backend comparison call
    try {
      const res = await fetch(`${API}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { lat: pickup.lat, lng: pickup.lng },
          drop: { lat: drop.lat, lng: drop.lng }
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.warn("Backend API unreachable, using resilient client calculations", err);
    }

    // Fallback if backend wasn't running or timed out
    if (!data) {
      const straightKm = haversineKm(pickup, drop);
      const roadKm = Number((straightKm * 1.32).toFixed(1));
      const estMin = Math.round((roadKm / 20) * 60);
      const fares = calculateFaresClientSide(roadKm);

      data = {
        distanceKm: roadKm,
        durationMin: estMin,
        distanceSource: "estimate",
        geometry: null,
        fares: fares,
        cheapest: fares[0].id
      };
    }

    currentFareData = data;
    drawRoute(pickup, drop, data.geometry);
    renderCards(data);

    // Smooth scroll to results
    setTimeout(() => {
      els.results.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);

  } catch (err) {
    showError(err.message || "An error occurred while evaluating ride options. Please verify locations.");
  } finally {
    els.btn.disabled = false;
    els.btn.innerHTML = `
      <span class="btn-text">Compare Fares with Precision</span>
      <svg viewBox="0 0 20 20" fill="currentColor" class="btn-arrow">
        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    `;
  }
});

// Update Year in Footer
const yearSpan = $("year");
if (yearSpan) yearSpan.textContent = new Date().getFullYear();
