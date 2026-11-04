# Jawa Profit Tracker

Track items you **bought**, organize them into **PCs (pieces)** and sell them **individually** — profit tracked per row and synced to your own Google Sheet.

Built with the same idea as the QR Scout project: a static website that submits entries, plus a small Node.js backend that writes to Google Sheets through a service account (no shared Google passwords).

## Structure

- `index.html` — Home / overview
- `tracker.html` — Log a bought item (item, store, cost, qty PCs, sell price)
- `sheet.html` — Edit the sheet: PCs Sold, Status, Notes; profit & PCs remaining recalculate
- `guide.html` — Step-by-step setup guide
- `assets/css/styles.css` — shared styles
- `assets/js/app.js` — shared API helpers (`API_BASE`, `api()`, `showToast()`)
- `backend/server.js` — Express backend: `GET /api/sheet`, `POST /api/sheet`, `PUT /api/sheet/:id`, `GET /health`
- `render.yaml` — Render.com web service definition
- `.github/workflows/pages.yml` — GitHub Pages deployment (static site)

## Quick start (local)

```bash
npm install
cp .env.example .env
# fill in .env with your Google Sheet ID + service account credentials
npm start            # backend on http://localhost:3001
# Serve the folder over HTTP (not file://) and open index.html.
# Point API_BASE in assets/js/app.js at http://localhost:3001/api
```

## Deployment (frontend + backend)

1. **Backend (Render.com):** create a Web Service connected to this repo, or deploy via `render.yaml`. Set these environment variables on Render:
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `SHEET_NAME` (default `Jawa Profit`)
   - `PORT` (default `3001`)
   See `guide.html` / "Set up the new Render service" below for full details.

2. **Frontend (GitHub Pages):** push to `main`. The `pages.yml` workflow deploys the static site automatically.

3. **Connect them:** set `API_BASE` in `assets/js/app.js` to your Render URL, e.g.
   `https://jawa-profit-tracker.onrender.com/api`, then commit and push.

## Google Sheets setup

1. Create a sheet (`sheets.new`) and add the header row:
   `ID, Date, Item, Store, Total Cost, Qty PCs, Cost per PC, Sell Price per PC, PCs Sold, PCs Remaining, Revenue, Profit, Status, Notes`
2. Create a Google Cloud service account, enable the Sheets API, generate a JSON key.
3. Share the sheet with the service account `client_email` as **Editor**.
4. Put `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY` into `.env` (local) / Render env vars (deployed).

## Set up the new Render service

1. In Render, click **New → Web Service** and connect the `Home-Grown-Code/Jawa-Profit-Tracker` repository.
2. Runtime: **Node**, Build command: `npm install`, Start command: `npm start`.
3. Add the environment variables listed above under the service **Environment** tab. For `GOOGLE_PRIVATE_KEY`, paste the whole private key block including `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----`, keeping the `\n` line escapes exactly as they appear in the JSON key file.
4. Save and deploy. Wait for the build, then open `<your-service>.onrender.com/health` — expect `{"ok":true}`.
5. Copy the service URL and set it as `API_BASE` in `assets/js/app.js`, then push to redeploy the GitHub Pages frontend.

## Repo

https://github.com/Home-Grown-Code/Jawa-Profit-Tracker
