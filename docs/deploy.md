# Deploying V-Calm

Production runs on **Cloudflare Pages (free plan)** at `https://breathe.viktorbezhenar.in.ua`.
Pages serves `app/` as static files and redeploys on every push to `main`; pull requests get preview URLs.

## One-time setup

### 1. Create the Pages project

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) (a free account is enough).
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Authorise the Cloudflare GitHub app for the `viktorbezhenar/v-calm` repository only.
4. Build settings:

   | Setting                | Value           |
   | ---------------------- | --------------- |
   | Production branch      | `main`          |
   | Framework preset       | None            |
   | Build command          | _(leave empty)_ |
   | Build output directory | `app`           |

5. **Save and Deploy.** The site goes live at `v-calm.pages.dev` (or similar).

### 2. Custom domain (DNS at imena.ua)

The order matters: add the domain in Cloudflare first, then create the DNS record.

1. In the Pages project: **Custom domains → Set up a custom domain** → `breathe.viktorbezhenar.in.ua` → Continue. Cloudflare shows the CNAME target (the `*.pages.dev` hostname).
2. In the imena.ua control panel → DNS for `viktorbezhenar.in.ua` → add a record:

   | Type  | Name / Host | Value / Target        | TTL     |
   | ----- | ----------- | --------------------- | ------- |
   | CNAME | `breathe`   | `<project>.pages.dev` | default |

3. Back in Cloudflare, wait for the domain to show **Active** (minutes, sometimes up to an hour). Cloudflare issues the HTTPS certificate automatically.

The root site (`viktorbezhenar.in.ua`, GitHub Pages) is untouched; only the `breathe` subdomain points to Cloudflare.

### 3. Check

- `https://breathe.viktorbezhenar.in.ua` loads with a padlock.
- Response headers include `Content-Security-Policy` (DevTools → Network → document).
- On iPhone: Safari → Share → **Add to Home Screen**. Open it from the icon, turn on airplane mode, open it again: it should still work.

## Releases

Push to `main`. Phones get the new version on their next launch after the update has downloaded (the service worker swaps caches when the version in `app/sw.js` changes).

## The address is permanent

Streaks are stored per web address. Changing the domain later would reset everyone's streak and require reinstalling the home-screen app. If hosting moves (for example to the Docker image), keep `breathe.viktorbezhenar.in.ua` pointing at it.

## Self-hosting with Docker

```bash
docker compose up -d --build   # http://127.0.0.1:8080
```

The container is nginx (unprivileged image), read-only, with all capabilities dropped and `no-new-privileges`, and it is bound to localhost. Put it behind a TLS-terminating tunnel (Cloudflare Tunnel or `tailscale serve`) for phone use; service workers and home-screen install need HTTPS.

## Costs

€0: Cloudflare Pages free plan (unlimited static requests and bandwidth, 500 builds/month), GitHub free, and a domain you already own.
