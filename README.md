# CSV Search App (GitHub Pages demo)

This repository contains a small client-side web app that can load a CSV file and provide quick search across all columns. It's intended to be deployed using GitHub Pages (by serving the `docs/` folder).

Files of interest (served at the site root when Pages uses `docs/`):

- `docs/index.html` – main app
- `docs/app.js` – client-side logic (uses PapaParse via CDN)
- `docs/styles.css` – minimal styling
- `docs/Book1.csv` – sample CSV included for demo

How to use locally:

1. Open the `docs/index.html` in a browser (easiest by running a local server):

```bash
python3 -m http.server --directory docs 8000
# then open http://localhost:8000 in a browser
```

2. You can either use the included `Book1.csv` (click the "Use included Book1.csv" button) or upload your own CSV file using the file picker.

Deploy to GitHub Pages (quick):

1. Commit and push this repository to GitHub.
2. In the repository Settings → Pages, set the Source to the branch `main` (or your branch) and the folder to `/docs`.
3. Save — Pages will publish the site. The site URL will be shown in the Settings page.

Alternative: use a `gh-pages` branch or Actions if you prefer automated deployments.

Notes:
- The app uses PapaParse (included from CDN) so it handles quoted values and common CSV edge cases.
- Do not commit private or sensitive CSV data to a public repository.
