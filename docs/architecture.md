# Architecture

```
www.yourdomain.com          api.yourdomain.com
  (Netlify)          HTTPS    (Railway)
  SvelteKit    ──────────►  PocketBase
  + Tailwind                 + SQLite
  + shadcn-svelte
```

## Frontend — Netlify

- SvelteKit with `@sveltejs/adapter-netlify`
- Deployed automatically from `main` branch via GitHub → Netlify CI
- Environment variable: `PUBLIC_POCKETBASE_URL`

## Backend — Railway

- PocketBase binary, persistent volume for SQLite
- Admin UI at `admin.yourdomain.com` (or Railway-provided URL)
- Environment variable: `ORIGIN=https://www.yourdomain.com`

## Suggested domains

| Subdomain | Purpose |
|-----------|---------|
| `www.yourdomain.com` | Player-facing app |
| `api.yourdomain.com` | PocketBase API |
| `admin.yourdomain.com` | PocketBase admin UI |

## Cron jobs

Managed via GitHub Actions or Railway scheduled jobs. See `scripts/README.md`.

## NFL data

Game schedule and results via [The Odds API](https://the-odds-api.com/) or ESPN unofficial API.
Required for: locking picks, auto-pick (biggest favourite), score imports.
