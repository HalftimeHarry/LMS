# Hosting on Bluehost

## The core problem

This app is a **server-side rendered SvelteKit application**. It runs Node.js on every request — it is not a static site. Bluehost shared hosting does not support persistent Node.js processes.

**Your options on Bluehost:**

| Plan | Node.js SSR? | Verdict |
|------|-------------|---------|
| Shared hosting | ❌ No | Won't work |
| VPS (unmanaged) | ✅ Yes | Works — requires manual setup |
| Cloud (managed VPS) | ✅ Yes | Works — easier |

If you are on a shared plan, you need to either upgrade to a Bluehost VPS or use a different host. The current stack (Netlify + Railway) is cheaper and simpler for this app — see the bottom of this doc.

---

## Option A — Bluehost VPS

### What you need

- Bluehost VPS plan (Ubuntu recommended)
- SSH access to the server
- A domain pointed at the VPS IP

### 1. Point your domain

In Bluehost DNS settings, set an A record for your domain (e.g. `lmspool.com`) pointing to your VPS IP address. Allow up to 24 hours for propagation.

### 2. Install Node.js on the VPS

SSH into the server, then:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v22.x
```

### 3. Install pnpm

```bash
npm install -g pnpm
```

### 4. Install and configure Nginx

Nginx acts as a reverse proxy — it receives HTTP/HTTPS traffic and forwards it to the Node.js process.

```bash
sudo apt-get install -y nginx
```

Create `/etc/nginx/sites-available/lms`:

```nginx
server {
    listen 80;
    server_name lmspool.com www.lmspool.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Install SSL (HTTPS)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lmspool.com -d www.lmspool.com
```

Certbot auto-renews. Verify with:

```bash
sudo certbot renew --dry-run
```

### 6. Switch the SvelteKit adapter

The app currently uses `@sveltejs/adapter-netlify`. For a Node.js VPS you need `@sveltejs/adapter-node`.

```bash
pnpm remove @sveltejs/adapter-netlify
pnpm add -D @sveltejs/adapter-node
```

Update `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-node';

const config = {
    kit: {
        adapter: adapter({ out: 'build' })
    }
};

export default config;
```

Remove `netlify.toml` (no longer needed).

### 7. Deploy the app

On the VPS, clone the repo and build:

```bash
git clone https://github.com/HalftimeHarry/LMS.git /var/www/lms
cd /var/www/lms
cp .env.example .env
# Edit .env with production values (see Environment Variables section below)
pnpm install --frozen-lockfile
pnpm build
```

### 8. Run with PM2 (process manager)

PM2 keeps the app running and restarts it on crash or reboot.

```bash
npm install -g pm2
pm2 start build/index.js --name lms -- --port 3000
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

Check it's running:

```bash
pm2 status
pm2 logs lms
```

### 9. Deploying updates

```bash
cd /var/www/lms
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart lms
```

---

## Option B — Keep Netlify + Railway (recommended)

The current setup already works and costs less than a Bluehost VPS:

| Service | Cost | What it runs |
|---------|------|-------------|
| Netlify (free tier) | $0/mo | SvelteKit frontend |
| Railway (hobby) | ~$5/mo | PocketBase backend |

If you want your domain on Bluehost DNS but host the app elsewhere:

1. In Bluehost DNS, add a CNAME record: `www` → `your-netlify-app.netlify.app`
2. Add an A record for the apex domain using Netlify's load balancer IPs (shown in Netlify domain settings)
3. Set your custom domain in Netlify → Site settings → Domain management

You keep the Bluehost domain registration and DNS, but the app runs on Netlify.

---

## Environment variables

These must be set on whichever host runs the app. On a VPS, put them in `/var/www/lms/.env`. On Netlify, set them in Site settings → Environment variables.

| Variable | Where to get it |
|----------|----------------|
| `PUBLIC_POCKETBASE_URL` | Your Railway PocketBase URL |
| `PUBLIC_APP_URL` | Your production domain, e.g. `https://lmspool.com` |
| `POCKETBASE_ADMIN_EMAIL` | PocketBase admin account email |
| `POCKETBASE_ADMIN_PASSWORD` | PocketBase admin account password |
| `ODDS_API_KEY` | [the-odds-api.com](https://the-odds-api.com) |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile dashboard |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile dashboard |
| `PUBLIC_EMAILJS_PUBLIC_KEY` | EmailJS dashboard |
| `EMAILJS_PRIVATE_KEY` | EmailJS dashboard |
| `EMAILJS_SERVICE_ID` | EmailJS dashboard |
| `EMAILJS_WELCOME_TEMPLATE_ID` | EmailJS dashboard |

**Never commit `.env` to git.** It is already in `.gitignore`.

---

## PocketBase (backend)

PocketBase is a separate binary — it is not part of the SvelteKit build. It currently runs on Railway. If you want to move it to the same Bluehost VPS:

1. Download the PocketBase binary for Linux from [pocketbase.io](https://pocketbase.io/docs/)
2. Upload it to the VPS: `scp pocketbase user@your-vps-ip:/var/www/pocketbase/`
3. Make it executable: `chmod +x /var/www/pocketbase/pocketbase`
4. Run it with PM2:
   ```bash
   pm2 start /var/www/pocketbase/pocketbase --name pocketbase -- serve --http=0.0.0.0:8090
   pm2 save
   ```
5. Add a second Nginx server block proxying `pb.lmspool.com` → `localhost:8090`
6. Update `PUBLIC_POCKETBASE_URL` to `https://pb.lmspool.com`
7. In PocketBase admin → Settings → Application URL, set `https://pb.lmspool.com`

Back up the PocketBase data directory (`pb_data/`) regularly — it contains the SQLite database.

---

## Pre-launch checklist

- [ ] Domain DNS pointing to host
- [ ] SSL certificate installed and auto-renewing
- [ ] All environment variables set
- [ ] `PUBLIC_APP_URL` matches the live domain exactly
- [ ] PocketBase `ORIGIN` setting matches the live domain
- [ ] Cloudflare Turnstile site key registered for the live domain
- [ ] EmailJS templates tested with a real send
- [ ] PocketBase admin password changed from default
- [ ] PocketBase `pb_data/` backup scheduled
- [ ] PM2 startup hook enabled (app survives VPS reboot)
