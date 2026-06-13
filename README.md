# Travel Foodie India 🍴

A simple web app for food lovers on the road. Tag any food spot in India — a
roadside stall, a restaurant, anywhere — with a **live photo**, a **live GPS
location**, and **Name / Area / Location** tags. Everything is saved on your own
device, so there's no account and no server to run.

## ✨ Features

- 📷 **Live camera capture** right in the browser (with photo-upload fallback)
- 🔤 **Auto-fill the name from the signboard** — snap the board and on-device OCR
  (Tesseract.js) reads the name so you barely type anything
- 📍 **One-tap GPS location** (opens in Google Maps)
- 🏷️ Tag each place with **name, area, and location**
- 💾 Saved on your device (localStorage) — works offline after first load
- 🔎 Search your saved places by name or area
- 📱 Mobile-first design

## 🚀 Use it live

Once GitHub Pages is enabled, the app is live at:

**https://keyur181-ship-it.github.io/TRAVEL-FOODIE/**

> 📌 Camera and GPS only work over a secure `https://` link (like the Pages URL
> above) or on `localhost` — this is a browser security rule, not a bug.

## 🖥️ Run it on your own computer

No build step, no dependencies. Just serve the folder:

```bash
# Option A: Node (already installed)
npx serve .

# Option B: Python
python -m http.server 8000
```

Then open the printed `http://localhost:...` address. Use `localhost` (not a
file path) so the camera is allowed.

## 📁 Project layout

| Path | Purpose |
|------|---------|
| `index.html` | App structure |
| `styles.css` | Styling (mobile-first) |
| `app.js` | Camera, GPS, saving, and rendering logic |
| `src/recommend.js` | A small dish-recommendation helper (from the starter) |
| `test/` | Tests for the helper |

## 🔒 Privacy

Your photos and notes never leave your device — they're stored only in your
browser's local storage. Clearing your browser data will remove them.
