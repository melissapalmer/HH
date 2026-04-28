# Happy Hookers — Golf Society Site

A small static website for the Happy Hookers golf social club: upcoming games, short news notes, and photos from past rounds. Single-page site with tab-style navigation. Hosted on GitHub Pages — no build step, no frameworks.

## Editing the site each month

Almost everything you'll change lives in the `data/` folder. Open these in a spreadsheet (Excel, Numbers, Google Sheets), edit, **Save As → CSV**, then commit + push.

| File | What it controls |
|---|---|
| `data/games.csv` | Upcoming games — `date, day, time, location, notes` |
| `data/news.csv` | Short dated notes (welcome-backs, club announcements, etc.) — `date,author,text`, newest shown first |
| `data/winners.csv` | Monthly winners — `date,event,winner,score,notes`, newest shown first |
| `data/photos.csv` | One row per photo: `filename,date,event,caption` (filename must exist in `images/photos/`). Photos group by year, then by `event` |

Adding a new photo:
1. Drop the JPG into `images/photos/` (e.g. `2026-05-club-champs.jpg`).
2. Add a row to `data/photos.csv`:
   `2026-05-club-champs.jpg,2026-05-30,Club Champs day,Maple Ridge winners shot`
   (`event` groups multiple shots from the same outing; `caption` is per-photo and optional.)
3. Commit + push.

## Previewing locally

The site uses `fetch()` to load the CSVs, which most browsers block when you double-click `index.html` directly. Use a tiny local web server instead:

```bash
cd /home/melissa/work/mp/repository/GOLF/HH
python3 -m http.server 8765
```

Then open <http://localhost:8765/> in any browser.

## First-time setup: push to GitHub & enable Pages

The repo is already initialised locally with the personal `melissapalmer` git identity. These steps publish it to **github.com/melissapalmer/HH** and turn on GitHub Pages.

> ⚠️ Use the **personal** `melissapalmer` GitHub account — **not** the MIT account (`github.mit.edu`).

```bash
cd /home/melissa/work/mp/repository/GOLF/HH

# 1. Drop any stale token from the environment so gh uses the keyring
unset GITHUB_TOKEN

# 2. Sign in to public github.com as melissapalmer
gh auth login --hostname github.com --git-protocol ssh --web
#   pick: GitHub.com → SSH → opens a browser, sign in as melissapalmer

# 3. Sanity check — should show github.com active as melissapalmer
gh auth status

# 4. Create the public repo and push (one command, uses gh auth)
gh repo create melissapalmer/HH --public --source=. --remote=origin --push

# 5. Verify origin
git remote -v
#   expect: origin  git@github.com:melissapalmer/HH.git

# 6. Enable GitHub Pages (deploy from the main branch root)
gh api -X POST repos/melissapalmer/HH/pages -f source.branch=main -f source.path=/

# 7. Open the live site (give Pages 30–60 seconds for the first build)
xdg-open https://melissapalmer.github.io/HH/
```

If you'd rather use the GitHub web UI instead of `gh`:
1. Create a new public repo at <https://github.com/new> named `HH` under your `melissapalmer` account. Don't add a README — we already have one here.
2. Back in this directory: `git remote add origin git@github.com:melissapalmer/HH.git && git push -u origin main`
3. On GitHub: **Settings → Pages → Source → Deploy from a branch → main / / (root) → Save**.
4. Wait ~1 minute, then visit <https://melissapalmer.github.io/HH/>.

## Day-to-day update flow

Once Pages is set up, every push to `main` redeploys automatically (~30 seconds):

```bash
git add data/games.csv data/news.csv               # whatever you edited
git commit -m "May news + games update"
git push
```

## File map

```
HH/
├── index.html          # Page markup (hero, tab nav, four tab panels, lightbox)
├── styles.css          # Black + #2c76af palette, mobile-first, tab styles
├── app.js              # CSV loader, tab switcher, countdown, photo lightbox
├── data/
│   ├── games.csv
│   ├── news.csv
│   └── photos.csv
├── images/
│   ├── logo.jpg        # Original line-art logo
│   ├── logo-mask.png   # Transparent PNG used as a CSS mask (recoloured to #2c76af)
│   ├── patch.jpg       # Embroidered patch photo (kept for reference, not currently displayed)
│   └── photos/         # Round photos referenced by photos.csv
└── .nojekyll           # Tells GitHub Pages to skip Jekyll processing
```

`index.html`, `styles.css`, and `app.js` only need editing if you want to change the site itself (colours, layout, new tab, etc.).
