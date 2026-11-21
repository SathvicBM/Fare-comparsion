const API = (window.API_BASE || "").replace(/\/$/, "");

const $ = (id) => document.getElementById(id);
const els = {
  form: $("compare"),
  error: $("error"),
  btn: $("compareBtn"),
  results: $("results"),
  cards: $("cards"),
  fine: $("fine"),
  mapHint: $("mapHint")
};

// ---------- Map ----------
const map = L.map("map", { zoomControl: true }).setView([12.9716, 77.5946], 11);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// ---------- Icons ----------
const ICONS = {
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16V9.5L5.5 6H14l2 3.5h2.2A2.8 2.8 0 0 1 21 12.3V16"/><path d="M3 16h2M9 16h6M19 16h2M14 6v3.5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
  bike: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="16.5" r="2.7"/><circle cx="18.5" cy="16.5" r="2.7"/><path d="M5.5 16.5 9 10.5h5.2l2.3 3.2 2 2.8M9 10.5 7.6 8H5.5M14.2 10.5l-.9-3H16"/></svg>',
  bus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="13" rx="2.5"/><path d="M4 11h16M8 17v2.5M16 17v2.5"/><circle cx="8" cy="14" r=".7"/><circle cx="16" cy="14" r=".7"/></svg>',
  walk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-6.5L9.5 12l2-4.5 3.5 2.5 2.5.5M11.5 14.5l3 2.2.8 4.3"/></svg>',
  cab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 14.5 6 10a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 10l1.5 4.5"/><rect x="3" y="14.5" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="16.5" r=".6"/><circle cx="16.5" cy="16.5" r=".6"/><path d="M6 18.5V20M18 18.5V20"/></svg>'
};
const icon = (type) => ICONS[type] || ICONS.cab;

// platform chips in the "Platforms" section
document.querySelectorAll(".chip[data-icon]").forEach((c) => {
  c.insertAdjacentHTML("afterbegin", icon(c.dataset.icon));
});

let mapLayers = [];
const clearMap = () => { mapLayers.forEach((l) => map.removeLayer(l)); mapLayers = []; };

function pin(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid #f4ebdf;box-shadow:0 0 0 5px ${color}44,0 4px 12px rgba(0,0,0,.6)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

function drawRoute(pickup, drop, geometry) {
  clearMap();
  const a = L.marker([pickup.lat, pickup.lng], { icon: pin("#d6b070") }).addTo(map);
  const b = L.marker([drop.lat, drop.lng], { icon: pin("#dc9494") }).addTo(map);
  const coords = geometry
    ? geometry.coordinates.map(([lng, lat]) => [lat, lng])
    : [[pickup.lat, pickup.lng], [drop.lat, drop.lng]];
  const line = L.polyline(coords, { color: "#e6c88f", weight: 5, opacity: 0.95, lineCap: "round", dashArray: geometry ? null : "8 10" }).addTo(map);
  mapLayers.push(a, b, line);
  map.fitBounds(line.getBounds(), { padding: [60, 60] });
  els.mapHint.hidden = true;
}

// ---------- Autocomplete ----------
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function setupAutocomplete(inputId, listId) {
  const input = $(inputId);
  const list = $(listId);
  const state = { selected: null };

  const hide = () => { list.hidden = true; list.innerHTML = ""; };

  const search = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 3) return hide();
    try {
      const res = await fetch(`${API}/api/geocode?q=${encodeURIComponent(q)}`);
      const items = await res.json();
      if (!Array.isArray(items) || !items.length) return hide();
      list.innerHTML = "";
      items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item.label;
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = item.label;
          state.selected = item;
          hide();
        });
        list.appendChild(li);
      });
      list.hidden = false;
    } catch { hide(); }
  }, 300);

  input.addEventListener("input", () => { state.selected = null; search(); });
  input.addEventListener("blur", () => setTimeout(hide, 150));

  return { input, state };
}

const pickupField = setupAutocomplete("pickup", "pickupSuggest");
const dropField = setupAutocomplete("drop", "dropSuggest");

// If the user typed but didn't tap a suggestion, use the best match.
async function resolve(field) {
  if (field.state.selected) return field.state.selected;
  const q = field.input.value.trim();
  if (!q) throw new Error("Please enter both a pickup and a drop location.");
  const res = await fetch(`${API}/api/geocode?q=${encodeURIComponent(q)}`);
  const items = await res.json();
  if (!Array.isArray(items) || !items.length) {
    throw new Error(`Couldn't find "${q}" in Bengaluru. Try adding a neighbourhood or landmark.`);
  }
  field.state.selected = items[0];
  field.input.value = items[0].label;
  return items[0];
}

// ---------- Swap ----------
$("swapBtn").addEventListener("click", () => {
  const a = pickupField, b = dropField;
  [a.input.value, b.input.value] = [b.input.value, a.input.value];
  [a.state.selected, b.state.selected] = [b.state.selected, a.state.selected];
});

// ---------- Buses ----------
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function busMessage(title, body) {
  const box = el("div", "bus-empty");
  box.insertAdjacentHTML("afterbegin", `<span class="stat-icon">${icon("bus")}</span>`);
  const t = el("div");
  t.append(el("strong", "", title), el("p", "", body));
  box.append(t);
  return box;
}

function renderBuses(transit) {
  const list = $("busList");
  list.innerHTML = "";

  if (!transit || transit.status !== "ready") {
    list.append(busMessage("Bus schedules are not loaded yet", "Add the BMTC schedule files to backend/data/gtfs to see routes and timings here."));
    return;
  }
  if (!transit.options.length) {
    list.append(busMessage("No direct bus on this route", "Nothing runs between stops within a short walk of both points. You would need a transfer."));
    return;
  }

  transit.options.forEach((o) => {
    const card = el("div", "bus-card");
    card.append(el("div", "route-chip", o.route));

    const main = el("div", "bus-main");
    if (o.headsign) main.append(el("div", "bus-head", `Towards ${o.headsign}`));

    const line = el("div", "trip-line");
    const walkSeg = (min) => {
      const s = el("span", "seg walk", min === 0 ? "At the stop" : `${min} min`);
      if (min > 0) s.insertAdjacentHTML("afterbegin", icon("walk"));
      s.title = min === 0 ? "Right at the stop" : `${min} min walk`;
      return s;
    };
    const ride = el("span", "seg ride", `${o.rideMin} min on bus`);
    line.append(walkSeg(o.board.walkMin), ride, walkSeg(o.alight.walkMin));
    main.append(line);

    const stops = el("div", "stops");
    stops.append(el("span", "", `Board at ${o.board.name}`), el("span", "", `Get off at ${o.alight.name}`));
    main.append(stops);
    card.append(main);

    const deps = el("div", "deps");
    if (o.departures.length) {
      o.departures.forEach((d, i) => {
        const chip = el("span", "dep" + (i === 0 ? " next" : ""));
        chip.append(el("b", "", d.inMin <= 0 ? "Now" : `${d.inMin} min`), el("small", "", d.time));
        deps.append(chip);
      });
    } else {
      deps.append(el("span", "dep none", `No more buses today (last ${o.lastBus})`));
    }
    card.append(deps);
    list.append(card);
  });
}

// ---------- Render ----------
function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}

function render(data) {
  const max = Math.max(...data.fares.map((f) => f.fare));
  const cheapest = data.fares[0].fare;
  const priciest = data.fares[data.fares.length - 1].fare;

  $("statDistance").textContent = `${data.distanceKm} km`;
  $("statTime").textContent = `${data.durationMin} min`;
  $("statSave").textContent = `₹${priciest - cheapest}`;

  els.cards.innerHTML = "";
  data.fares.forEach((f, i) => {
    const card = document.createElement("div");
    card.className = "card" + (i === 0 ? " best" : "");

    card.innerHTML = `
      <span class="card-icon">${icon(f.type)}</span>
      <div class="card-id">
        <div class="platform-name"><span class="pn"></span></div>
        <div class="vehicle"></div>
      </div>
      <div class="bar" role="img"><span></span></div>
      <div class="price-col">
        <div class="price"></div>
        <div class="extra"></div>
      </div>
    `;
    card.querySelector(".pn").textContent = f.platform;
    card.querySelector(".vehicle").textContent =
      f.vehicle + (f.availability === "unchecked" ? " (schedule not checked)" : "");
    card.querySelector(".price").textContent = `₹${f.fare}`;
    card.querySelector(".bar").setAttribute("aria-label", `${f.platform} ${f.vehicle}: ₹${f.fare}`);

    if (i === 0) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Cheapest";
      card.querySelector(".platform-name").appendChild(badge);
    } else if (f.fare > cheapest) {
      card.querySelector(".extra").textContent = `+₹${f.fare - cheapest}`;
    }
    els.cards.appendChild(card);

    // animate the bar after insertion
    requestAnimationFrame(() => {
      card.querySelector(".bar > span").style.width = `${Math.max(6, Math.round((f.fare / max) * 100))}%`;
    });
  });

  renderBuses(data.transit);

  els.fine.textContent =
    (data.distanceSource === "road"
      ? "Distance is the real driving route. "
      : "Route service was unreachable, so distance is a straight-line estimate. ") +
    "Fares are estimates and exclude surge, tolls and waiting charges.";

  els.results.hidden = false;
  els.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Submit ----------
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  els.btn.disabled = true;
  els.btn.textContent = "Comparing…";

  try {
    const [pickup, drop] = await Promise.all([resolve(pickupField), resolve(dropField)]);
    if (pickup.lat === drop.lat && pickup.lng === drop.lng) {
      throw new Error("Pickup and drop are the same place. Choose a different drop.");
    }

    const res = await fetch(`${API}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { lat: pickup.lat, lng: pickup.lng },
        drop: { lat: drop.lat, lng: drop.lng }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");

    drawRoute(pickup, drop, data.geometry);
    render(data);
  } catch (err) {
    showError(err.message || "Couldn't reach the server. Is the backend running?");
  } finally {
    els.btn.disabled = false;
    els.btn.textContent = "Compare fares";
  }
});

$("year").textContent = new Date().getFullYear();
