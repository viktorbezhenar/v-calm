# AGENTS.md

V-Calm is a zero-build static PWA: `app/` is deployed byte-for-byte (Cloudflare Pages output dir; also served by `docker/`). Read `README.md` for the product and layout; `npm run check` is the gate before every commit.

## Conventions the tooling won't tell you

- **Zero runtime dependencies, no bundler.** App code is plain ES modules loaded by the browser. npm packages are dev-only (lint, format). A feature that seems to need a library gets written small instead.
- **Strict CSP** (`app/_headers`, mirrored in `docker/nginx.conf`): scripts and styles come only from same-origin files. Build DOM with the `h()` helper in `main.js`; set dynamic styles through `el.style.setProperty(...)`; keep every asset self-hosted.
- **Pure core, thin shell.** `programs.js`, `timeline.js`, `streaks.js` stay DOM-free and are covered by `node:test`. Breathing-timing or streak logic lands there with a test; `main.js` only renders.
- **One clock.** The AudioContext clock drives both sound and animation; pause = `ctx.suspend()`. Timers and `Date.now()` drift against audio over a 5-minute session.
- **Releases:** bump the version in `package.json`, `app/sw.js` and `app/js/main.js` together, and list every new file under `app/` in `ASSETS` in `sw.js`. `test/sw-assets.test.js` goes red when either is missed. Add a `CHANGELOG.md` entry.
- **Breathing patterns are product decisions.** Change a program's phases only when the owner asks; the expected patterns are pinned in `test/timeline.test.js`.

## Originality

The app takes inspiration from Calm and Practico but ships only original work: synthesised sounds (`audio.js`), our own gradients and copy. Reference recordings and screenshots stay out of the repo. The product name and UI never use the Calm trademark beyond the generic word in "V-Calm".

## Verifying UI changes

Lint and unit tests cannot hear audio or see layout. Check UI changes in a 393×852 mobile viewport via `npm run dev`, and flag anything iOS-specific (audio session, wake lock, safe areas) for testing on a real iPhone home-screen install.
