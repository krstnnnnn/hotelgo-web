# HOTELGO Web (React staff console)

The **front end** of HOTELGO. It is a separate project from the back end (`hotelgo-api`, the LavaLust API). It has no database and no PHP: every action is an HTTP request to the API, protected by a login token (JWT).

```
hotelgo-web (React, Render Static Site)  ──HTTP + token──►  hotelgo-api (LavaLust, Render Web Service)  ──►  Aiven MySQL
```

Screens: Login, Dashboard, Reservations (walk-in, check-in/out, cancel, edit), Guests, Availability, Room types, Rooms, Payments, Notifications, Reports, Staff, Settings, Audit log, My account, Logout. Staff see the front-desk screens; the owner also sees the Owner section.

## Run it on your computer

1. Start the API first (`php lava serve` in `hotelgo-api`, usually `http://localhost:8000`). In the API `.env` set `FRONTEND_URL=http://localhost:5173`.
2. In this folder:
   ```
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173` and sign in (`admin@hotelgo.ph`, temporary password `ChangeMe!2026`).

The API address is in `public/config.js` (`http://localhost:8000/api`), or set `API_URL` in a local `.env` (copy `.env.example`).

## Put it online (Render, free "Static Site")

1. Push this folder to its own GitHub repository (for example `hotelgo-web`).
2. Render → **New +** → **Static Site** → pick the repository.
3. **Build Command:** `npm install && npm run build`   **Publish Directory:** `dist`
4. **Environment variable:** `API_URL` = `https://YOUR-API-NAME.onrender.com/api`
5. Create it, then copy the website address Render gives you (for example `https://hotelgo-web.onrender.com`).
6. Go to the **API** service on Render → Environment → set `FRONTEND_URL` to that address (no slash at the end) → save. Without this the browser blocks the calls (CORS).

## Files

| File | Purpose |
|---|---|
| `src/main.jsx` | App shell, sidebar menu, routes |
| `src/api.js` | The only place that talks to the API (login, token refresh, requests) |
| `src/pages/` | One file per area (Auth, Dashboard, Bookings, Guests, Catalog, Owner) |
| `src/icons.jsx`, `src/ui.jsx`, `src/styles.css` | Icons, shared parts, design |
| `public/config.js` | Address of the API |
| `build.mjs` | Builds `dist/` with esbuild |

Security: nothing secret lives here (everything in a React app is public). The access token is kept in memory and the refresh token in `sessionStorage`. The API checks the role on every request, so hiding a menu item is only for convenience.


## The website and the hidden staff sign-in

`#/` is the public website (landing page, rooms, map, gallery, FAQ, contact) in the same design as the PHP site.
Guests search rooms here (data comes from the API). Sign in, booking and payment continue on the PHP site (the API address without `/api`).

The staff console has **no link anywhere** on the website. Staff open `https://YOUR-SITE.onrender.com/#/<STAFF_PATH>`:

* Local: `public/config.js` -> `staffPath` (default `door-local-7k3m`) -> http://localhost:5173/#/door-local-7k3m
* Render Static Site: add the environment variable `STAFF_PATH` (one secret word, 8+ letters/numbers) next to `API_URL`, then redeploy.
* Any other address (`#/admin`, `#/dashboard` ...) just shows the website to people who are not signed in.
