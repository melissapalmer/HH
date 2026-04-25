# CLAUDE.md — Project rules for Happy Hookers (hh)

A small static site for a golf social club, hosted on GitHub Pages. This file
captures rules that should be respected without being asked. Add to it whenever
the user gives feedback that should stick across sessions.

## Stack rules — non-negotiable

- **Plain HTML/CSS/JS only.** No frameworks (no React/Vue/Svelte/jQuery), no
  bundlers, no npm. Three files: `index.html`, `styles.css`, `app.js`.
- **No build step.** Files served directly by GitHub Pages. Anything you add
  must work as-is when opened over HTTP.
- **No external runtime dependencies** beyond the existing Google Fonts link
  (Anton + Inter). Don't pull in icon libraries, UI kits, analytics, etc.
  unless the user explicitly asks.

## Design rules

- **Palette is locked: black + `#2c76af`.** Don't introduce a third accent
  colour without asking.
- **Mobile-first, always.** Most members view on phones. After any UI change,
  mentally walk through 360px / 390px / 768px before declaring done. The
  failure mode to avoid: a layout that "works" on desktop but overflows or
  needs zooming on a phone.
- **Tap targets ≥ 44×44px.** Buttons, nav items, lightbox controls.
- **Use `clamp()` for type and padding.** Hard-coded `px` values that don't
  scale break the responsive feel.
- **Use `100dvh`/`100dvw` (not `vh`/`vw`) for full-screen overlays** so iOS
  Safari's URL bar doesn't clip the lightbox.
- **Layout is tab-based**, not anchor-scrolling. Tabs are Home, Upcoming Games,
  News, Photos. The countdown lives in the Home tab. (A Tee Times tab existed
  briefly but was removed — the user gets tee times the Friday before each
  game, so a permanent on-site section was overkill. Don't add it back without
  asking.)
- **The hero is compact** — logo on the left, club name + tagline on the
  right. Don't restore the big stacked centred hero.

## Content rules

- **All content lives in CSVs under `data/`** so non-developers can edit in a
  spreadsheet. When the user wants to change something content-shaped (game
  list, tee groups, photo captions, footer quotes), prefer adding/editing a
  CSV over hard-coding in HTML or JS.
- **Footer is the random golf quote only.** Don't add the patch image back or
  re-add a "Happy Hookers Golf Society" credit line — both were explicitly
  removed.
- **The 2026 schedule is curated** by the user (mostly last Saturdays, some
  exceptions noted in the `notes` column). Don't auto-generate dates — copy
  what the user gives. `data/games.csv` columns:
  `date,day,time,location,players_booked,carts_booked,notes`. Numeric fields
  may be blank or hold strings like `Cart sharing` / `tba`. The renderer
  displays `—` for blank cells.

## Logo handling

- The line-art logo is recoloured via a CSS `mask-image` over a transparent
  PNG (`images/logo-mask.png`) generated once with Pillow from `images/logo.jpg`.
- If the source logo changes, regenerate the mask with the same Pillow recipe
  (`ImageOps.invert` of grayscale, slight contrast curve, crop transparent
  borders). Don't switch to a different recolouring technique unless the mask
  is producing visible artifacts.

## Local preview

- **`python3 -m http.server 8765`** in the project root, then open
  `http://localhost:8765/`. The site uses `fetch()` to load CSVs, which
  browsers block on `file://` — never tell the user to "just double-click
  index.html". Always run a server.

## Git & deploy

- **Personal `melissapalmer` GitHub identity only.** This repo's local git
  config (`user.name`, `user.email`) is set explicitly — never override with
  the global config or push under any MIT identity. If you ever need to verify:
  `git config --local --get user.email` should be `melissa.palmer@gmail.com`.
- **Repo lives at `github.com/melissapalmer/hh`.** Site URL:
  `https://melissapalmer.github.io/hh/`.
- **Deploy is automatic** — every push to `main` redeploys via GitHub Pages.
- **First-time push instructions are in [README.md](README.md)** under
  *First-time setup*. Don't duplicate them here.

## When the user gives feedback

If the user corrects something or expresses a preference that would apply to
*future* changes (not just the current task), append a one-line rule to the
relevant section above. Keep rules short; longer than two lines means it's
probably better captured as a comment in the code.
