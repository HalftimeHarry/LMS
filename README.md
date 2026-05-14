# LMS — Last Man Standing Pool

NFL survivor pool app built with SvelteKit, PocketBase, and Tailwind.

## Stack

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | SvelteKit + Tailwind + shadcn-svelte | Netlify |
| Backend | PocketBase | Railway |
| Database | SQLite (via PocketBase) | Railway volume |

## Local development

```sh
cp .env.example .env   # fill in your local values
pnpm install
pnpm dev
```

PocketBase runs separately — see `pocketbase/README.md`.

## Deployment

**Frontend:** push to `main` → Netlify auto-deploys.
Set `PUBLIC_POCKETBASE_URL` in Netlify environment variables.

**Backend:** Railway service running PocketBase binary.
Set `ORIGIN=https://www.yourdomain.com` in Railway environment variables.

## Project structure

```
root/
├── src/
│   ├── lib/
│   │   ├── components/ui/   # shadcn-svelte components
│   │   ├── pocketbase.ts    # PocketBase client
│   │   └── utils.ts         # cn() helper
│   └── routes/
├── pocketbase/              # migrations, local binary
├── scripts/                 # cron jobs (picks lock, scores import)
├── docs/                    # architecture, schema
├── netlify.toml
├── components.json          # shadcn-svelte config
└── .env.example
```

See `docs/architecture.md` for the full architecture diagram.
