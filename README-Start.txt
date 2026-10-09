Research Master Web App

Requirements:
- Windows or macOS
- Node.js LTS: https://nodejs.org/

macOS:
- Double-click Start-Mac.command.
- The browser opens http://localhost:4173/.
- Keep the Terminal window open while using the local app; closing it stops the local server.
- If the local server is already running, you can also double-click 開啟本機版.html.

Windows:
- Double-click Start-Windows.bat.
- The browser opens http://localhost:4173/.
- If the local server is already running, you can also double-click 開啟本機版.html or 本機網址.url.

Sync model:
- The local app and deployed site use the same index.html, app.js, and styles.css.
- Update this cloud folder first, then publish the same files to the public site.

Cloud login:
- Login uses Firebase Authentication with the Google provider.
- This app never asks for or stores a Google password.
- After Firebase is configured, each user's library syncs to Firestore:
  users/{uid}/libraries/default.

Usage:
- Searching and selecting only previews a source.
- Press Copy on a citation card to save it into the personal library.
- Open Library Editor, select references, then press Apply to Output List.
- The bibliography output panel then formats the applied references.
