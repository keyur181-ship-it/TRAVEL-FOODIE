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

const placesEl = document.getElementById("places");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchInput = document.getElementById("search");

// --- In-memory state for the form ---
let photoDataUrl = null; // the captured/selected photo (data URL) or null
let coords = null; // { lat, lng } from GPS, or null
let cameraStream = null; // active MediaStream while camera is open

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
}

removePhotoBtn.addEventListener("click", () => {
  photoDataUrl = null;
  preview.src = "";
  previewWrap.classList.add("hidden");
  fileInput.value = "";
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
  stopCamera();
}

// =====================================================================
// RENDER THE LIST
// =====================================================================
function render() {
  const query = searchInput.value.trim().toLowerCase();
  const places = loadPlaces().filter((p) => {
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      p.area.toLowerCase().includes(query)
    );
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

  const meta = document.createElement("div");
  meta.className = "place-meta";

  if (p.coords) {
    const mapLink = document.createElement("a");
    mapLink.href = `https://www.google.com/maps?q=${p.coords.lat},${p.coords.lng}`;
    mapLink.target = "_blank";
    mapLink.rel = "noopener";
    mapLink.textContent = "📍 Map";
    meta.appendChild(mapLink);
  } else {
    meta.appendChild(document.createElement("span"));
  }

  const del = document.createElement("button");
  del.className = "del-btn";
  del.textContent = "Delete";
  del.addEventListener("click", () => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    savePlaces(loadPlaces().filter((x) => x.id !== p.id));
    render();
  });
  meta.appendChild(del);

  body.appendChild(meta);
  card.appendChild(body);
  return card;
}

searchInput.addEventListener("input", render);

// First paint
render();
