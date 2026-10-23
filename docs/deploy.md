# Deploying V-Calm

V-Calm is a static site: deploy the `app/` folder anywhere that serves files over HTTPS.
The recommended host is **Cloudflare Pages** (free plan): it applies the security headers in `app/_headers`, redeploys on every push, and builds preview URLs for pull requests.

## Cloudflare Pages

### 1. Create the project

1. In the [Cloudflare dashboard](https://dash.cloudflare.com): **Workers & Pages → Create**, then choose **Pages** (the "Looking to deploy Pages?" link) → **Import an existing Git repository**.
2. Select your fork of this repository.
3. Build settings:

   | Setting                | Value           |
   | ---------------------- | --------------- |
   | Production branch      | `main`          |
   | Framework preset       | None            |
   | Build command          | _(leave empty)_ |
   | Build output directory | `app`           |

4. **Save and Deploy.** The site goes live at `<project>.pages.dev`.

Use **Pages**, not a Worker: a Worker custom domain requires the whole zone on Cloudflare, while Pages accepts a plain CNAME from any DNS provider.

### 2. Custom domain (optional)

The order matters: add the domain in Cloudflare first, then create the DNS record.

1. In the Pages project: **Custom domains → Set up a custom domain** → enter e.g. `breathe.example.com` → **My DNS provider → Begin CNAME setup**.
2. At your DNS provider, add the record Cloudflare shows:

   | Type  | Name      | Target                |
   | ----- | --------- | --------------------- |
   | CNAME | `breathe` | `<project>.pages.dev` |

3. Cloudflare verifies the record (usually within minutes) and issues the HTTPS certificate automatically.

### 3. Check

- The site loads over HTTPS and the response includes a `Content-Security-Policy` header (DevTools → Network → document).
- On a phone: open it in the browser → **Add to Home Screen**. Open it from the icon, switch on airplane mode, and open it again: it should still work.

## Releases

Push to `main`. Phones get the new version on their next launch after the update has downloaded (the service worker swaps caches when `VERSION` in `app/sw.js` changes).

## Choose the address once

Streaks are stored in the browser per web address (origin). Moving to a different domain later resets everyone's streak and requires reinstalling the home-screen app. If you change hosts, keep the same address pointing at the new host.

## Self-hosting with Docker

```bash
docker compose up -d --build   # http://127.0.0.1:8080
```

The container is unprivileged nginx with a read-only filesystem, all capabilities dropped and `no-new-privileges`, bound to localhost. `docker/nginx.conf` mirrors the headers in `app/_headers`. For phone use, put it behind a TLS-terminating proxy or tunnel (e.g. Cloudflare Tunnel, Caddy, `tailscale serve`): service workers and home-screen install require HTTPS.

## Cost

€0 on the Cloudflare Pages free plan (unlimited static requests and bandwidth, 500 builds/month).
