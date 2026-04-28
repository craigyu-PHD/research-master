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
