# Deploying The Blizzard of Odds

## Stack

| Layer | Service | URL |
|-------|---------|-----|
| Frontend (SvelteKit) | Netlify | theblizzardofodds.com |
| Backend (PocketBase) | Railway | your-pocketbase.up.railway.app |

---

## 1. Deploy Frontend to Netlify

### Connect the repository

1. Push the project to GitHub (already done)
2. Log in to [netlify.com](https://netlify.com)
3. Click **Add new site → Import from GitHub**
4. Select the `LMS` repository

### Build settings

| Setting | Value |
|---------|-------|
| Base directory | *(leave blank)* |
| Build command | `npm run build` |
| Publish directory | `build` |

The `netlify.toml` in the repo root sets these automatically — Netlify will detect it.

### SvelteKit adapter

Already configured. `svelte.config.js` uses `@sveltejs/adapter-netlify` and `netlify.toml` is present.

---

## 2. Configure Custom Domain

In Netlify → **Site Settings → Domain Management**:

1. Click **Add a domain**
2. Add `theblizzardofodds.com`
3. Add `www.theblizzardofodds.com`

Netlify provisions SSL automatically via Let's Encrypt.

---

## 3. Configure DNS

### Option A — Netlify DNS (recommended)

1. In Netlify domain settings, click **Set up Netlify DNS**
2. Netlify provides 4 nameservers (e.g. `dns1.p01.nsone.net`)
3. At your domain registrar (Bluehost), replace the existing nameservers with the Netlify ones
4. Allow up to 24 hours for propagation

### Option B — Keep existing DNS provider

Add these records at your registrar:

| Type | Name | Value |
|------|------|-------|
| CNAME | `www` | `your-site.netlify.app` |
| A | `@` | *(Netlify load balancer IP — shown in Netlify dashboard)* |

---

## 4. Deploy PocketBase on Railway

PocketBase runs as a separate service from the SvelteKit frontend.

1. Create a new project at [railway.app](https://railway.app)
2. Deploy the PocketBase service (use the PocketBase template or deploy the binary)
3. Expose port `8090`
4. Note your generated domain, e.g.:
   ```
   https://pocketbase-production-2547.up.railway.app
   ```
5. In PocketBase admin → **Settings → Application URL**, set `https://theblizzardofodds.com`

---

## 5. Environment Variables

Set these in **Netlify → Site Settings → Environment Variables**.

| Variable | Description |
|----------|-------------|
| `PUBLIC_POCKETBASE_URL` | Railway PocketBase URL |
| `PUBLIC_APP_URL` | `https://theblizzardofodds.com` |
| `POCKETBASE_ADMIN_EMAIL` | PocketBase admin email |
| `POCKETBASE_ADMIN_PASSWORD` | PocketBase admin password |
| `ODDS_API_KEY` | [the-odds-api.com](https://the-odds-api.com) |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile (public) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (secret) |
| `PUBLIC_EMAILJS_PUBLIC_KEY` | EmailJS (public) |
| `EMAILJS_PRIVATE_KEY` | EmailJS (private) |
| `EMAILJS_SERVICE_ID` | EmailJS service ID |
| `EMAILJS_WELCOME_TEMPLATE_ID` | EmailJS welcome template ID |

See `.env.example` for the full template. Never commit `.env` to GitHub.

---

## 6. Continuous Deployment

Every push to `main` automatically deploys:

- **Frontend** → Netlify (build + CDN deploy)
- **Backend** → Railway (if connected to GitHub)

No manual SSH or server management required.

---

## Pre-launch Checklist

- [ ] Netlify build succeeds with no errors
- [ ] Custom domain added in Netlify and DNS propagated
- [ ] SSL certificate active (Netlify provisions automatically)
- [ ] All environment variables set in Netlify
- [ ] `PUBLIC_APP_URL` matches the live domain exactly
- [ ] PocketBase Application URL set to `https://theblizzardofodds.com`
- [ ] Cloudflare Turnstile site registered for `theblizzardofodds.com`
- [ ] EmailJS templates tested with a real send
- [ ] PocketBase admin password changed from default
- [ ] PocketBase `pb_data/` backup scheduled on Railway

---

## Why Netlify + Railway

| | Netlify + Railway | Traditional VPS |
|--|-------------------|-----------------|
| Deployments | Automatic on push | Manual SSH |
| SSL | Automatic | Manual (Certbot) |
| CDN | Included | Manual setup |
| Server maintenance | None | Full responsibility |
| Cost | ~$5/mo (Railway hobby) | $10–20/mo (VPS) |
| Scaling | Automatic | Manual |

A VPS (e.g. Bluehost Cloud) is only worth considering if you need heavy background jobs, WebSocket scaling, or custom server infrastructure. See `READMEHOST.md` (VPS section) for those instructions.
