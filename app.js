const API = (window.API_BASE || "").replace(/\/$/, "");

const $ = (id) => document.getElementById(id);
const els = {
  form:    $("compare"),
  error:   $("error"),
  errorMsg: $("errorMsg"),
  btn:     $("compareBtn"),
  results: $("results"),
  cards:   $("cards"),
  fine:    $("fine"),
  mapHint: $("mapHint")
};

// ── Map ───────────────────────────────────────────────────────────────────────
// Using CartoDB Dark Matter tiles — proper dark theme, no CSS filter hack needed.
const map = L.map("map", { zoomControl: true }).setView([12.9716, 77.5946], 11);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 19,
  attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors © <a href='https://carto.com/attributions'>CARTO</a>"
}).addTo(map);

let mapLayers = [];
const clearMap = () => { mapLayers.forEach((l) => map.removeLayer(l)); mapLayers = []; };

function pin(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function drawRoute(pickup, drop, geometry) {
  clearMap();
  const a = L.marker([pickup.lat, pickup.lng], { icon: pin("#4fd1a5") }).addTo(map);
  const b = L.marker([drop.lat, drop.lng],   { icon: pin("#e88a5f") }).addTo(map);
  const coords = geometry
    ? geometry.coordinates.map(([lng, lat]) => [lat, lng])
    : [[pickup.lat, pickup.lng], [drop.lat, drop.lng]];
  const line = L.polyline(coords, { color: "#4fd1a5", weight: 5, opacity: 0.9, dashArray: geometry ? null : "8 8" }).addTo(map);
  mapLayers.push(a, b, line);
  map.fitBounds(line.getBounds(), { padding: [40, 40] });
  els.mapHint.hidden = true;
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function setupAutocomplete(inputId, listId) {
  const input = $(inputId);
  const list  = $(listId);
  const state = { selected: null };
  let activeIndex = -1;

  const hide = () => { list.hidden = true; list.innerHTML = ""; activeIndex = -1; };

  const search = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 3) return hide();
    try {
      const res   = await fetch(`${API}/api/geocode?q=${encodeURIComponent(q)}`);
      const items = await res.json();
      if (!Array.isArray(items) || !items.length) return hide();
      list.innerHTML = "";
      activeIndex = -1;
      items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item.label;
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value     = item.label;
          state.selected  = item;
          hide();
        });
        list.appendChild(li);
      });
      list.hidden = false;
    } catch { hide(); }
  }, 300);

  // ── Keyboard navigation in suggestions (↑ ↓ Enter Escape) ──
  input.addEventListener("keydown", (e) => {
    const items = [...list.querySelectorAll("li")];
    if (list.hidden || !items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      items[activeIndex].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      e.preventDefault();
      return;
    } else if (e.key === "Escape") {
      hide();
      return;
    } else {
      return; // other keys: let the input handle them
    }

    items.forEach((li, i) => li.classList.toggle("active", i === activeIndex));
  });

  input.addEventListener("input", () => { state.selected = null; search(); });
  input.addEventListener("blur",  () => setTimeout(hide, 150));

  return { input, state };
}

const pickupField = setupAutocomplete("pickup", "pickupSuggest");
const dropField   = setupAutocomplete("drop",   "dropSuggest");

// If the user typed but didn't tap a suggestion, resolve with the best match.
async function resolve(field) {
  if (field.state.selected) return field.state.selected;
  const q = field.input.value.trim();
  if (!q) throw new Error("Please enter both a pickup and a drop location.");
  const res   = await fetch(`${API}/api/geocode?q=${encodeURIComponent(q)}`);
  const items = await res.json();
  if (!Array.isArray(items) || !items.length) {
    throw new Error(`Couldn't find "${q}" in Bengaluru. Try adding a neighbourhood or landmark.`);
  }
  field.state.selected = items[0];
  field.input.value    = items[0].label;
  return items[0];
}

// ── Swap ──────────────────────────────────────────────────────────────────────
$("swapBtn").addEventListener("click", () => {
  const a = pickupField, b = dropField;
  [a.input.value, b.input.value]       = [b.input.value, a.input.value];
  [a.state.selected, b.state.selected] = [b.state.selected, a.state.selected];
});

// ── Hamburger (mobile nav) ────────────────────────────────────────────────────
const hamburger = $("hamburger");
const mobileNav  = $("mobileNav");
if (hamburger && mobileNav) {
  hamburger.addEventListener("click", () => {
    const open = !mobileNav.hidden;
    mobileNav.hidden = open;
    hamburger.setAttribute("aria-expanded", String(!open));
  });
  // Close mobile nav when any link inside is clicked
  mobileNav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      mobileNav.hidden = true;
      hamburger.setAttribute("aria-expanded", "false");
    });
  });
}

// ── Vehicle icons ─────────────────────────────────────────────────────────────
const VEHICLE_ICON = { auto: "🛺", bike: "🏍️", cab: "🚕" };

// ── Render ────────────────────────────────────────────────────────────────────
function showError(msg) {
  if (msg) {
    els.errorMsg.textContent = msg;
    els.error.hidden = false;
  } else {
    els.error.hidden = true;
  }
}

function showSkeleton() {
  els.results.hidden = false;
  els.cards.innerHTML = Array(4).fill('<div class="skeleton-card"></div>').join("");
  // Scroll to the stats bar (not the whole section) for a better mobile experience
  els.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function render(data) {
  const max      = Math.max(...data.fares.map((f) => f.fare));
  const cheapest = data.fares[0].fare;
  const priciest = data.fares[data.fares.length - 1].fare;

  $("statDistance").textContent = `${data.distanceKm} km`;
  $("statTime").textContent     = `${data.durationMin} min`;
  $("statSave").textContent     = `₹${priciest - cheapest}`;

  els.cards.innerHTML = "";
  data.fares.forEach((f, i) => {
    const card = document.createElement("div");
    card.className = "card" + (i === 0 ? " best" : "");

    const badge = i === 0 ? `<span class="badge">Cheapest</span>` : "";
    const icon  = VEHICLE_ICON[f.type] || "";

    card.innerHTML = `
      ${badge}
      <div class="card-head">
        <div>
          <div class="platform-name"></div>
          <div class="vehicle"></div>
        </div>
        <div class="price"></div>
      </div>
      <div class="bar"><span></span></div>
      <div class="note"></div>
    `;
    card.querySelector(".platform-name").textContent = f.platform;
    card.querySelector(".vehicle").textContent       = `${icon} ${f.vehicle}`;
    card.querySelector(".price").textContent         = `₹${f.fare}`;
    card.querySelector(".note").textContent          = f.note;
    els.cards.appendChild(card);

    // Animate the bar after insertion
    requestAnimationFrame(() => {
      card.querySelector(".bar > span").style.width = `${Math.round((f.fare / max) * 100)}%`;
    });
  });

  els.fine.textContent =
    (data.distanceSource === "road"
      ? "Distance is the real driving route. "
      : "Route service was unreachable, so distance is a straight-line estimate. ") +
    "Fares are estimates and exclude surge, tolls and waiting charges.";

  els.results.hidden = false;
}

// ── Submit ────────────────────────────────────────────────────────────────────
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  els.btn.disabled    = true;
  els.btn.textContent = "Comparing…";

  // Show skeletons immediately so the user knows something is happening
  showSkeleton();

  try {
    const [pickup, drop] = await Promise.all([resolve(pickupField), resolve(dropField)]);

    const res  = await fetch(`${API}/api/compare`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        pickup: { lat: pickup.lat, lng: pickup.lng },
        drop:   { lat: drop.lat,   lng: drop.lng   }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");

    drawRoute(pickup, drop, data.geometry);
    render(data);
  } catch (err) {
    // Hide skeleton on error
    els.results.hidden = true;
    showError(err.message || "Couldn't reach the server. Is the backend running?");
  } finally {
    els.btn.disabled    = false;
    els.btn.textContent = "Compare fares";
  }
});

$("year").textContent = new Date().getFullYear();
