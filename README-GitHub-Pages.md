# Research Master GitHub Pages Deployment

This project can run in two modes.

## Local full mode

Run `node server.mjs` and open `http://localhost:4173/`.

Local full mode uses the Node backend for:

- faster multi-source metadata discovery
- footnote parsing endpoint
- reverse citation expansion endpoint
- local prepared bibliography files under `data/`

## GitHub Pages static mode

Upload the contents of `dist/github-pages/` to a GitHub Pages repository.

Static mode cannot run `server.mjs`, so the browser uses direct API fallback for:

- Crossref
- DataCite
- Semantic Scholar
- Europe PMC
- PubMed / NCBI E-utilities
- DOAJ
- Google Books
- Open Library
- Library of Congress

OpenAlex is still free, but current documentation says formal API use requires a free API key. Without a key it should only be treated as a low-volume fallback.

Static mode still provides database route links for Airiti, Google Scholar, Semantic Scholar, JSTOR, Project MUSE, ERIC, PubMed, CNKI, Wanfang, WorldCat, NDLTD Taiwan, NDDS, DOAJ, and other sources.

## Free API policy

This app is designed to avoid paid APIs. Sources with no free public metadata API are used only as outbound search routes, not as hidden paid integrations:

- Airiti Library: route only
- Google Scholar: route only; no official free API
- CNKI / Wanfang / JSTOR / Project MUSE / WorldCat: route only unless the user opens the database directly
- OpenAlex: free API key recommended; no paid key required

## Firebase sign-in and cloud library

The public site uses Firebase Authentication and Firestore for user accounts and cloud bibliography storage.

Create a Firebase project, add a Web App, enable Authentication > Google provider, and enable Firestore Database. Then add the GitHub Pages domain as an authorized domain:

`https://YOUR-GITHUB-USER.github.io`

Copy the Firebase Web App config into `firebase-config.js`.

The app stores each user's bibliography at:

`users/{uid}/libraries/default`

If Firebase is not configured, the site still works in browser-session storage mode, but saved bibliography data is not cloud-synced.
# Research Master GitHub Pages Deployment

This project can run in two modes.

## Local full mode

Run `node server.mjs` and open `http://localhost:4173/`.

Local full mode uses the Node backend for:

- faster multi-source metadata discovery
- footnote parsing endpoint
- reverse citation expansion endpoint
- local prepared bibliography files under `data/`

## GitHub Pages static mode

Upload the contents of `dist/github-pages/` to a GitHub Pages repository.

Static mode cannot run `server.mjs`, so the browser uses direct API fallback for:

- Crossref
- OpenAlex
- DataCite
- Google Books
- Open Library

Static mode still provides database route links for Airiti, Google Scholar, Semantic Scholar, JSTOR, Project MUSE, ERIC, PubMed, CNKI, Wanfang, WorldCat, NDLTD Taiwan, NDDS, DOAJ, and other sources.

## Google sign-in

Google sign-in requires a real Google OAuth Client ID.

For GitHub Pages, create an OAuth client in Google Cloud Console and add the GitHub Pages origin, for example:

`https://YOUR-GITHUB-USER.github.io`

Then paste the Client ID into the login panel in the web app.

The app must use Google's official OAuth popup. It must not collect or store a user's Google password inside this page.
