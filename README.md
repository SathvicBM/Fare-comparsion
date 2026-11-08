# Fare-comparsion
This is all about # FareCompare

Compare estimated auto, bike and cab fares across **Namma Yatri, Rapido and Ola** in Bengaluru.
Type a pickup and a drop, see the route on a map and the cheapest ride first.

```
farecompare/
├── frontend/          # the website (HTML, CSS, JS)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── config.js      # set API_BASE if the backend is hosted elsewhere
├── backend/           # the API (Node.js + Express)
│   ├── server.js      # /api/geocode, /api/compare
│   ├── fare.js        # editable rate cards
│   └── package.json
└── README.md
```

## Run locally

Needs [Node.js 18+](https://nodejs.org).

```bash
cd backend
npm install
npm start
```

Open http://localhost:3000 (the backend also serves the frontend).

## API

| Method | Endpoint | What it does |
| --- | --- | --- |
| GET | `/api/geocode?q=koramangala` | Address suggestions inside Bengaluru |
| POST | `/api/compare` | Body: `{ "pickup": {lat,lng}, "drop": {lat,lng} }`. Returns distance, time, route and ranked fares |

## Push to GitHub

```bash
cd farecompare
git init
git add .
git commit -m "FareCompare: frontend and backend"
git branch -M main
git remote add origin https://github.com/<your-username>/farecompare.git
git push -u origin main
```

Create the empty `farecompare` repository on github.com first (no README), then run the commands above.

## Deploy (free)

**Simplest: one deploy on [Render](https://render.com)**
- New Web Service, connect the repo
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

The backend serves the frontend too, so you get one public link that works on mobile.

**Or host separately:** put `frontend/` on Netlify or GitHub Pages and set
`window.API_BASE = "https://your-backend.onrender.com"` in `frontend/config.js`.

## Important notes

- Fares are **estimates** from approximate public rate cards (edit `backend/fare.js`). Rapido, Ola and Namma Yatri do not offer public live-fare APIs, so these are not live quotes and exclude surge.
- Geocoding uses [Photon](https://photon.komoot.io) and routing uses the public [OSRM](https://project-osrm.org) demo server. Both are free community services meant for light use. For heavy traffic, switch to a paid provider.
- Map data &copy; OpenStreetMap contributors.
comparing fares of cabs among different apps and select the best one 
[README.md](https://github.com/user-attachments/files/34542957/README.md)
