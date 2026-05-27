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

## Email configuration

The app sends two types of email:

### Welcome email (EmailJS)
Sent on registration. Set these in Netlify environment variables:

| Variable | Where to find it |
|---|---|
| `PUBLIC_EMAILJS_PUBLIC_KEY` | EmailJS dashboard → Account → Public Key |
| `EMAILJS_PRIVATE_KEY` | EmailJS dashboard → Account → Private Key |
| `EMAILJS_SERVICE_ID` | EmailJS dashboard → Email Services → Service ID |
| `EMAILJS_WELCOME_TEMPLATE_ID` | EmailJS dashboard → Email Templates → Template ID |

The welcome template receives `{{name}}`, `{{to_email}}`, and `{{app_url}}`.

### Password reset email (PocketBase SMTP)
Sent when a user requests a password reset. Configured directly in PocketBase — no Netlify env vars needed.

**To update the SMTP sender address:**

1. Go to the PocketBase admin panel: `https://<your-railway-url>/_/`
2. Navigate to **Settings → Mail settings**
3. Update the following fields:
   - **Sender name** — display name players see (e.g. `The Comish`)
   - **Sender address** — the Gmail address to send from
   - **SMTP host** — `smtp.gmail.com`
   - **SMTP port** — `587`
   - **Username** — the Gmail address
   - **Password** — a Gmail App Password (not your regular password)
4. Click **Save**
5. Use **Send test email** to confirm it works

**To generate a Gmail App Password:**

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Ensure 2-Step Verification is enabled on the account
3. Enter an app name (e.g. `PocketBase`) and click **Create**
4. Copy the 16-character password (remove spaces) and paste it into the PocketBase SMTP Password field

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
