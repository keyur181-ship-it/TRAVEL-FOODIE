/*
 * Travel Foodie India — front-end logic.
 *
 * Everything runs in the browser. Places are saved in localStorage on the
 * user's own device (no server, no account). Photos are stored as compressed
 * JPEG data URLs so they fit within the browser's storage limit.
 */

"use strict";

const STORAGE_KEY = "tf_places";

// --- Grab the elements we need from the page ---
const form = document.getElementById("place-form");
const nameInput = document.getElementById("name");
const areaInput = document.getElementById("area");
const locationInput = document.getElementById("location");

const gpsBtn = document.getElementById("gps-btn");
const gpsStatus = document.getElementById("gps-status");

const openCameraBtn = document.getElementById("open-camera");
const cameraWrap = document.getElementById("camera-wrap");
const video = document.getElementById("video");
const captureBtn = document.getElementById("capture-btn");
const cancelCameraBtn = document.getElementById("cancel-camera");
const fileInput = document.getElementById("file-input");
const canvas = document.getElementById("canvas");

const previewWrap = document.getElementById("preview-wrap");
const preview = document.getElementById("preview");
const removePhotoBtn = document.getElementById("remove-photo");
const ocrBtn = document.getElementById("ocr-btn");
const ocrStatus = document.getElementById("ocr-status");
const ocrText = document.getElementById("ocr-text");
const ocrTextContent = document.getElementById("ocr-text-content");

const starInput = document.getElementById("star-input");
const reviewInput = document.getElementById("review");
const itemsList = document.getElementById("items-list");
const addItemBtn = document.getElementById("add-item");

const placesEl = document.getElementById("places");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchInput = document.getElementById("search");

const detailModal = document.getElementById("detail-modal");
const detailBody = document.getElementById("detail-body");
const detailClose = document.getElementById("detail-close");

const nearbyBtn = document.getElementById("nearby-btn");
const nearbyArea = document.getElementById("nearby-area");
const nearbyTypes = document.getElementById("nearby-types");
const nearbySaved = document.getElementById("nearby-saved");
const nearbyResults = document.getElementById("nearby-results");
const nearbyStatus = document.getElementById("nearby-status");

// --- In-memory state for the form ---
let photoDataUrl = null; // the captured/selected photo (data URL) or null
let coords = null; // { lat, lng } from GPS, or null
let cameraStream = null; // active MediaStream while camera is open

// =====================================================================
// STAR RATING WIDGET (reusable)
// =====================================================================
// Builds 5 clickable stars inside `el`. The chosen value (0-5) is stored
// on el.dataset.value so we can read it back when saving.
function buildStars(el, initial) {
  el.dataset.value = String(initial || 0);
  el.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "star";
    star.textContent = "★";
    star.setAttribute("aria-label", i + " star" + (i > 1 ? "s" : ""));
    star.addEventListener("click", () => {
      // Click the same star again to clear it back to 0.
      const current = Number(el.dataset.value);
      const next = current === i ? 0 : i;
      el.dataset.value = String(next);
      paintStars(el);
    });
    el.appendChild(star);
  }
  paintStars(el);
}

function paintStars(el) {
  const value = Number(el.dataset.value);
  [...el.children].forEach((star, idx) => {
    star.classList.toggle("on", idx < value);
  });
}

function getStars(el) {
  return Number(el.dataset.value) || 0;
}

buildStars(starInput, 0);

// =====================================================================
// FOOD ITEM ROWS (name + stars + note)
// =====================================================================
addItemBtn.addEventListener("click", () => addItemRow());

function addItemRow(data) {
  const row = document.createElement("div");
  row.className = "item-row";

  const name = document.createElement("input");
  name.type = "text";
  name.className = "item-name";
  name.placeholder = "Dish name (e.g. Pani Puri)";
  if (data) name.value = data.name || "";

  const stars = document.createElement("div");
  stars.className = "stars-input item-stars";
  buildStars(stars, data ? data.rating : 0);

  const note = document.createElement("input");
  note.type = "text";
  note.className = "item-note";
  note.placeholder = "Note (optional)";
  if (data) note.value = data.note || "";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-item";
  remove.textContent = "✕";
  remove.setAttribute("aria-label", "Remove this item");
  remove.addEventListener("click", () => row.remove());

  row.append(name, stars, note, remove);
  itemsList.appendChild(row);
}

// Read all item rows into a clean array, dropping empty ones.
function collectItems() {
  const rows = [...itemsList.querySelectorAll(".item-row")];
  return rows
    .map((row) => ({
      name: row.querySelector(".item-name").value.trim(),
      rating: getStars(row.querySelector(".item-stars")),
      note: row.querySelector(".item-note").value.trim(),
    }))
    .filter((it) => it.name || it.rating || it.note);
}

// =====================================================================
// LIVE LOCATION (GPS)
// =====================================================================
gpsBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    gpsStatus.textContent = "Location not supported on this device.";
    return;
  }
  gpsStatus.textContent = "Getting location…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gpsStatus.textContent = `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    },
    (err) => {
      coords = null;
      gpsStatus.textContent =
        err.code === err.PERMISSION_DENIED
          ? "Location permission denied."
          : "Could not get location.";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// =====================================================================
// LIVE CAMERA CAPTURE
// =====================================================================
openCameraBtn.addEventListener("click", async () => {
  try {
    // Prefer the rear ("environment") camera on phones.
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    video.srcObject = cameraStream;
    cameraWrap.classList.remove("hidden");
    openCameraBtn.classList.add("hidden");
  } catch (err) {
    // No camera / permission denied → fall back to the file picker,
    // which on phones still opens the camera.
    alert(
      "Couldn't open the live camera (" +
        (err.name || "error") +
        "). Use “Choose / upload” instead — on a phone it opens your camera too."
    );
  }
});

captureBtn.addEventListener("click", () => {
  // Draw the current video frame onto a canvas, scaled down to save space.
  const maxW = 1024;
  const scale = Math.min(1, maxW / video.videoWidth || 1);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  photoDataUrl = canvas.toDataURL("image/jpeg", 0.7);
  showPreview(photoDataUrl);
  stopCamera();
});

cancelCameraBtn.addEventListener("click", stopCamera);

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  video.srcObject = null;
  cameraWrap.classList.add("hidden");
  openCameraBtn.classList.remove("hidden");
}

// File upload fallback (also used on phones to open the camera).
fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    // Downscale uploaded images too, so storage doesn't fill up.
    shrinkImage(reader.result, 1024, (smaller) => {
      photoDataUrl = smaller;
      showPreview(photoDataUrl);
    });
  };
  reader.readAsDataURL(file);
});

function shrinkImage(dataUrl, maxW, done) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    done(canvas.toDataURL("image/jpeg", 0.7));
  };
  img.src = dataUrl;
}

function showPreview(url) {
  preview.src = url;
  previewWrap.classList.remove("hidden");
  // Automatically try to read the signboard and fill the name.
  runOcr(url, /* auto */ true);
}

// =====================================================================
// READ TEXT FROM THE PHOTO (OCR) AND AUTO-FILL THE NAME
// =====================================================================
let ocrRunning = false;

ocrBtn.addEventListener("click", () => {
  if (photoDataUrl) runOcr(photoDataUrl, /* auto */ false);
});

async function runOcr(imageUrl, auto) {
  if (ocrRunning) return;
  if (typeof Tesseract === "undefined") {
    setOcrStatus("⚠️ Text reader not loaded — check your internet and try “Read name from photo”.");
    return;
  }
  ocrRunning = true;
  ocrBtn.disabled = true;
  setOcrStatus("🔎 Reading the signboard… (first time can take a few seconds)");

  try {
    const { data } = await Tesseract.recognize(imageUrl, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setOcrStatus("🔎 Reading the signboard… " + Math.round(m.progress * 100) + "%");
        }
      },
    });

    const fullText = (data.text || "").trim();
    const guess = pickPlaceName(data);

    if (fullText) {
      ocrTextContent.textContent = fullText;
      ocrText.classList.remove("hidden");
    } else {
      ocrText.classList.add("hidden");
    }

    if (guess) {
      // Don't overwrite something the user already typed unless they
      // explicitly pressed the button.
      if (!nameInput.value.trim() || !auto) {
        nameInput.value = guess;
        setOcrStatus('✅ Filled the name from the photo: “' + guess + '”. Edit it if it\'s wrong.');
      } else {
        setOcrStatus('💡 Detected “' + guess + '”. Your typed name was kept.');
      }
    } else {
      setOcrStatus("🤔 Couldn't read a clear name. Please type it in.");
    }
  } catch (err) {
    setOcrStatus("⚠️ Couldn't read the photo (" + (err.name || "error") + "). Please type the name.");
  } finally {
    ocrRunning = false;
    ocrBtn.disabled = false;
  }
}

function setOcrStatus(msg) {
  ocrStatus.textContent = msg;
  ocrStatus.classList.remove("hidden");
}

// Pick the most likely place name from the OCR result.
// When we have per-line position + size (bbox), the name is usually the
// biggest text near the top — and signboard names often wrap onto a couple
// of lines, so we join the tallest line with its similar-sized neighbours.
// Without bbox we fall back to scoring lines as plain text.
function pickPlaceName(data) {
  const hasLines = Array.isArray(data.lines) && data.lines.length;

  let lines = (hasLines
    ? data.lines.map((l, i) => ({
        text: cleanLine(l.text),
        conf: typeof l.confidence === "number" ? l.confidence : 50,
        height: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0,
        idx: i,
      }))
    : (data.text || "")
        .split("\n")
        .map((t, i) => ({ text: cleanLine(t), conf: 55, height: 0, idx: i }))
  ).filter((c) => c.text.length >= 2 && c.conf >= 35 && digitRatio(c.text) < 0.5);

  if (!lines.length) return "";

  if (hasLines) {
    // The tallest line is almost always part of the name.
    const tallest = lines.reduce((a, b) => (b.height > a.height ? b : a));
    const H = tallest.height || 1;
    // Join it with nearby lines (in reading order) of similar size.
    const group = lines
      .filter((c) => Math.abs(c.idx - tallest.idx) <= 2 && c.height >= 0.65 * H)
      .sort((a, b) => a.idx - b.idx);
    const name = group.map((g) => g.text).join(" ").replace(/\s+/g, " ").trim();
    return name || tallest.text;
  }

  // Plain-text fallback: score each line and take the best.
  lines.forEach((c, i) => {
    const letters = (c.text.match(/[A-Za-z]/g) || []).length;
    const len = c.text.length;
    const upperRatio =
      letters > 0 ? (c.text.match(/[A-Z]/g) || []).length / letters : 0;
    c.score = c.conf * 0.4 + upperRatio * 18 + Math.min(len, 22) - i * 3;
  });
  lines.sort((a, b) => b.score - a.score);
  return lines[0].text;
}

function digitRatio(s) {
  if (!s.length) return 0;
  return (s.match(/[0-9]/g) || []).length / s.length;
}

function cleanLine(s) {
  return (s || "")
    .replace(/[^\p{L}\p{N}&'’.\- ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

removePhotoBtn.addEventListener("click", () => {
  photoDataUrl = null;
  preview.src = "";
  previewWrap.classList.add("hidden");
  fileInput.value = "";
  ocrStatus.classList.add("hidden");
  ocrText.classList.add("hidden");
});

// =====================================================================
// SAVE + STORAGE
// =====================================================================
function loadPlaces() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function savePlaces(places) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const place = {
    id: Date.now().toString(),
    name: nameInput.value.trim(),
    area: areaInput.value.trim(),
    location: locationInput.value.trim(),
    coords: coords,
    photo: photoDataUrl,
    rating: getStars(starInput),
    review: reviewInput.value.trim(),
    items: collectItems(),
    createdAt: new Date().toISOString(),
  };

  const places = loadPlaces();
  places.unshift(place); // newest first

  try {
    savePlaces(places);
  } catch (err) {
    alert(
      "Couldn't save — your device storage may be full. Try removing some older places."
    );
    return;
  }

  resetForm();
  render();
});

function resetForm() {
  form.reset();
  photoDataUrl = null;
  coords = null;
  previewWrap.classList.add("hidden");
  gpsStatus.textContent = "";
  ocrStatus.classList.add("hidden");
  ocrText.classList.add("hidden");
  buildStars(starInput, 0);
  itemsList.innerHTML = "";
  stopCamera();
}

// =====================================================================
// RENDER THE LIST
// =====================================================================
function render() {
  const query = searchInput.value.trim().toLowerCase();
  const places = loadPlaces().filter((p) => {
    if (!query) return true;
    const haystack = [
      p.name,
      p.area,
      p.location,
      p.review,
      ...(p.items || []).map((it) => it.name + " " + it.note),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  countEl.textContent = loadPlaces().length;
  placesEl.innerHTML = "";

  if (places.length === 0) {
    emptyEl.classList.remove("hidden");
    emptyEl.textContent = query
      ? "No matches for your search."
      : "No places yet. Add your first food spot above! 🍲";
    return;
  }
  emptyEl.classList.add("hidden");

  for (const p of places) {
    placesEl.appendChild(renderCard(p));
  }
}

function renderCard(p) {
  const card = document.createElement("article");
  card.className = "place";

  const img = document.createElement("img");
  img.alt = p.name;
  img.src =
    p.photo ||
    "data:image/svg+xml;utf8," +
      encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><rect width='100%' height='100%' fill='%23f3e7da'/><text x='50%' y='50%' font-size='48' text-anchor='middle' dominant-baseline='middle'>🍽️</text></svg>"
      );
  card.appendChild(img);

  const body = document.createElement("div");
  body.className = "place-body";

  const name = document.createElement("h3");
  name.className = "place-name";
  name.textContent = p.name;
  body.appendChild(name);

  const area = document.createElement("div");
  area.className = "place-area";
  area.textContent = p.area;
  body.appendChild(area);

  if (p.location) {
    const loc = document.createElement("div");
    loc.className = "place-loc";
    loc.textContent = p.location;
    body.appendChild(loc);
  }

  if (p.rating) {
    const rate = document.createElement("div");
    rate.className = "place-rating";
    rate.innerHTML =
      '<span class="stars">' + starString(p.rating) + "</span> " + p.rating + "/5";
    body.appendChild(rate);
  }

  if (p.review) {
    const rev = document.createElement("p");
    rev.className = "place-review";
    rev.textContent = "“" + p.review + "”";
    body.appendChild(rev);
  }

  if (p.items && p.items.length) {
    const list = document.createElement("ul");
    list.className = "place-items";
    p.items.forEach((it) => {
      const li = document.createElement("li");
      const stars = it.rating ? " " + starString(it.rating) : "";
      const note = it.note ? " — " + it.note : "";
      li.innerHTML =
        "<strong>" + escapeHtml(it.name || "Dish") + "</strong>" +
        '<span class="stars">' + stars + "</span>" +
        escapeHtml(note);
      list.appendChild(li);
    });
    body.appendChild(list);
  }

  const meta = document.createElement("div");
  meta.className = "place-meta";

  if (p.coords) {
    const mapLink = document.createElement("a");
    mapLink.href = `https://www.google.com/maps?q=${p.coords.lat},${p.coords.lng}`;
    mapLink.target = "_blank";
    mapLink.rel = "noopener";
    mapLink.textContent = "📍 Map";
    mapLink.addEventListener("click", (e) => e.stopPropagation());
    meta.appendChild(mapLink);
  } else {
    meta.appendChild(document.createElement("span"));
  }

  const del = document.createElement("button");
  del.className = "del-btn";
  del.textContent = "Delete";
  del.addEventListener("click", (e) => {
    e.stopPropagation(); // don't open the detail popup
    deletePlace(p);
  });
  meta.appendChild(del);

  body.appendChild(meta);
  card.appendChild(body);

  // Tapping the card opens the full detail view.
  card.classList.add("clickable");
  card.addEventListener("click", () => openDetail(p));
  return card;
}

function deletePlace(p) {
  if (!confirm(`Delete "${p.name}"?`)) return;
  savePlaces(loadPlaces().filter((x) => x.id !== p.id));
  render();
}

// =====================================================================
// PLACE DETAIL POPUP
// =====================================================================
function openDetail(p) {
  const photo = p.photo
    ? `<img class="detail-photo" src="${p.photo}" alt="${escapeHtml(p.name)}">`
    : "";
  const loc = [p.area, p.location].filter(Boolean).map(escapeHtml).join(", ");
  const rating = p.rating
    ? `<div class="detail-rating"><span class="stars">${starString(p.rating)}</span> ${p.rating}/5</div>`
    : "";
  const review = p.review
    ? `<p class="detail-review">“${escapeHtml(p.review)}”</p>`
    : "";
  const items =
    p.items && p.items.length
      ? `<h4 class="detail-h">Dishes tried</h4><ul class="detail-items">` +
        p.items
          .map(
            (it) =>
              `<li><strong>${escapeHtml(it.name || "Dish")}</strong>` +
              ` <span class="stars">${it.rating ? starString(it.rating) : ""}</span>` +
              `${it.note ? " — " + escapeHtml(it.note) : ""}</li>`
          )
          .join("") +
        `</ul>`
      : "";
  const map = p.coords
    ? `<a class="detail-map" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${p.coords.lat},${p.coords.lng}">📍 Open in Google Maps</a>`
    : "";
  const date = p.createdAt
    ? `<div class="detail-date">Added ${formatDate(p.createdAt)}</div>`
    : "";

  detailBody.innerHTML =
    photo +
    `<h2 class="detail-name">${escapeHtml(p.name)}</h2>` +
    (loc ? `<div class="detail-loc">${loc}</div>` : "") +
    rating +
    review +
    items +
    map +
    date +
    `<button type="button" class="btn del-detail">Delete this place</button>`;

  detailBody.querySelector(".del-detail").addEventListener("click", () => {
    deletePlace(p);
    if (!loadPlaces().some((x) => x.id === p.id)) closeDetail();
  });

  detailModal.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // stop background scrolling
}

function closeDetail() {
  detailModal.classList.add("hidden");
  detailBody.innerHTML = "";
  document.body.style.overflow = "";
}

detailClose.addEventListener("click", closeDetail);
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) closeDetail(); // click outside the card
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !detailModal.classList.contains("hidden")) {
    closeDetail();
  }
});

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function starString(n) {
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  return "★".repeat(v) + "☆".repeat(5 - v);
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

searchInput.addEventListener("input", render);

// =====================================================================
// NEAR ME — area detection + nearby food discovery (free, OpenStreetMap)
// =====================================================================
let nearbyType = "restaurant";
let nearbyCoords = null;

const TYPE_LABELS = {
  restaurant: "Restaurants",
  cafe: "Cafés",
  fast_food: "Street food",
  bakery: "Bakeries",
};
const TYPE_ICONS = {
  restaurant: "🍽️",
  cafe: "☕",
  fast_food: "🥡",
  bakery: "🧁",
};

nearbyBtn.addEventListener("click", startNearby);

// Type chips switch what we look for.
nearbyTypes.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  nearbyType = chip.dataset.type;
  [...nearbyTypes.children].forEach((c) => c.classList.toggle("on", c === chip));
  if (nearbyCoords) showDiscovered(nearbyCoords.lat, nearbyCoords.lng);
});

function startNearby() {
  if (!navigator.geolocation) {
    setNearbyStatus("Location isn't supported on this device.");
    return;
  }
  setNearbyStatus("📍 Getting your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      nearbyCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      loadNearby(nearbyCoords.lat, nearbyCoords.lng);
    },
    (err) => {
      setNearbyStatus(
        err.code === err.PERMISSION_DENIED
          ? "Location permission denied — allow it to find food near you."
          : "Couldn't get your location. Try again."
      );
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function loadNearby(lat, lng) {
  nearbyTypes.classList.remove("hidden");
  showArea(lat, lng);
  showSavedNearby(lat, lng);
  showDiscovered(lat, lng);
}

// 1) Reverse-geocode to name the current area.
async function showArea(lat, lng) {
  nearbyArea.textContent = "📍 Finding your area…";
  try {
    const r = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&addressdetails=1&lat=${lat}&lon=${lng}`,
      10000
    );
    const a = r.address || {};
    const area =
      a.suburb || a.neighbourhood || a.quarter || a.village || a.town || a.city_district || "";
    const city = a.city || a.town || a.county || a.state_district || a.state || "";
    const label = [area, city].filter(Boolean).join(", ");
    nearbyArea.textContent = label ? "📍 You're near " + label : "📍 You're here.";
  } catch {
    nearbyArea.textContent = "📍 You're here (couldn't name the area).";
  }
}

// 2) Best of the user's OWN saved + rated places near them.
function showSavedNearby(lat, lng) {
  const mine = loadPlaces()
    .filter((p) => p.coords)
    .map((p) => ({ p, d: distanceKm(lat, lng, p.coords.lat, p.coords.lng) }))
    .filter((x) => x.d <= 5)
    .sort((a, b) => (b.p.rating || 0) - (a.p.rating || 0) || a.d - b.d)
    .slice(0, 5);

  if (!mine.length) {
    nearbySaved.innerHTML = "";
    return;
  }
  nearbySaved.innerHTML =
    '<h3 class="nearby-h">⭐ Your best spots nearby</h3>' +
    mine
      .map(
        (x) =>
          `<button type="button" class="nearby-row" data-id="${x.p.id}">` +
          `<span class="nearby-name">${escapeHtml(x.p.name)}</span>` +
          `<span class="nearby-meta">${x.p.rating ? starString(x.p.rating) + " · " : ""}${fmtDist(x.d)}</span>` +
          `</button>`
      )
      .join("");

  nearbySaved.querySelectorAll(".nearby-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      const place = loadPlaces().find((p) => p.id === btn.dataset.id);
      if (place) openDetail(place);
    });
  });
}

// 3) Discover real nearby places from OpenStreetMap (no ratings available).
async function showDiscovered(lat, lng) {
  const label = TYPE_LABELS[nearbyType];
  setNearbyStatus("🔎 Finding " + label.toLowerCase() + " near you…");
  nearbyResults.innerHTML = "";
  try {
    const sel =
      nearbyType === "bakery"
        ? 'node["shop"="bakery"]'
        : `node["amenity"="${nearbyType}"]`;
    const query = `[out:json][timeout:20];(${sel}(around:1200,${lat},${lng}););out body 30;`;
    const r = await fetchJson(
      "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query),
      20000
    );
    const list = (r.elements || [])
      .map((e) => ({
        name: e.tags && e.tags.name,
        cuisine: e.tags && e.tags.cuisine,
        lat: e.lat,
        lng: e.lon,
        d: distanceKm(lat, lng, e.lat, e.lon),
      }))
      .filter((x) => x.name && isFinite(x.d))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);

    if (!list.length) {
      nearbyResults.innerHTML =
        '<p class="hint">No ' + label.toLowerCase() + " found within ~1 km.</p>";
      setNearbyStatus("");
      return;
    }
    nearbyResults.innerHTML =
      `<h3 class="nearby-h">${TYPE_ICONS[nearbyType]} ${label} near you</h3>` +
      list
        .map(
          (x) =>
            `<a class="nearby-row" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${x.lat},${x.lng}">` +
            `<span class="nearby-name">${escapeHtml(x.name)}</span>` +
            `<span class="nearby-meta">${fmtDist(x.d)}${x.cuisine ? " · " + escapeHtml(x.cuisine.replace(/[_;]/g, " ")) : ""}</span>` +
            `</a>`
        )
        .join("");
    setNearbyStatus("From OpenStreetMap. ⭐ ratings come only from your own saved reviews.");
  } catch (err) {
    nearbyResults.innerHTML = "";
    setNearbyStatus("Couldn't load nearby places (slow network or busy server). Try again in a moment.");
  }
}

function setNearbyStatus(msg) {
  nearbyStatus.textContent = msg;
}

// Distance between two lat/lng points, in km (haversine).
function distanceKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((n) => typeof n === "number")) return Infinity;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function fmtDist(km) {
  if (!isFinite(km)) return "";
  return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km";
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs || 12000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// If the user already granted location before, auto-run on load.
if (navigator.permissions && navigator.permissions.query) {
  navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      if (status.state === "granted") startNearby();
    })
    .catch(() => {});
}

// First paint
render();
