# CAPTCHA & Rate Limiting — Setup Guide

Spam and brute-force protection for the three public auth routes: login, register, and forgot-password.

---

## What's in place

| Route | CAPTCHA | Rate limit |
|---|---|---|
| `/login` | ✅ Turnstile (env-gated) | ✅ 10 attempts / IP / 15 min |
| `/register` | ✅ Turnstile (env-gated) | ✅ 5 attempts / IP / 1 hour |
| `/forgot-password` | ✅ Turnstile (env-gated) | ✅ 5 attempts / IP / 15 min |

Both protections are independent — rate limiting is always active, CAPTCHA only activates when the env keys are set.

---

## Cloudflare Turnstile setup

### 1 — Create a Turnstile site

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** in the left sidebar
2. Click **Add site**
3. Enter a name (e.g. `LMS Pool`) and your production domain (e.g. `lmspool.com`)
4. Widget type: **Managed** (Cloudflare decides when to challenge)
5. Copy the **Site Key** and **Secret Key**

### 2 — Set environment variables

**.env (local dev):**
```bash
PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
TURNSTILE_SECRET_KEY=your_secret_key_here
```

**Netlify (production):**

Go to **Netlify → Site → Environment variables** and add both:

| Key | Value | Scope |
|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | your site key | Public (safe to expose) |
| `TURNSTILE_SECRET_KEY` | your secret key | Secret (server-only) |

### 3 — How it works

- When `PUBLIC_TURNSTILE_SITE_KEY` is set, the Turnstile widget renders on the form
- When `TURNSTILE_SECRET_KEY` is set, the server verifies the token before processing the form
- When neither key is set (local dev without keys), CAPTCHA is skipped entirely — forms work normally

The widget is invisible by default (Managed mode). Cloudflare silently validates most real users and only shows a challenge when it detects suspicious behaviour.

---

## Test keys (local development)

Cloudflare provides official test keys that work without a real domain:

| Purpose | Site Key | Secret Key |
|---|---|---|
| Always passes (invisible) | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Always blocks | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AB` |
| Forces visible challenge | `3x00000000000000000000FF` | `3x0000000000000000000000000000000FF` |

Use `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` in `.env` during development to confirm the widget loads and passes without needing a real domain.

---

## Rate limiting

Rate limiting is handled by `src/lib/server/rate-limit.ts` — an in-memory sliding-window limiter. No external dependency required.

### Limits

| Route | Key | Limit | Window |
|---|---|---|---|
| `/login` | `login:<ip>` | 10 requests | 15 minutes |
| `/register` | `register:<ip>` | 5 requests | 1 hour |
| `/forgot-password` | `forgot:<ip>` | 5 requests | 15 minutes |

### IP detection

The limiter reads the client IP from request headers in this order:

1. `cf-connecting-ip` — set by Cloudflare (most accurate on Netlify + Cloudflare)
2. `x-forwarded-for` — set by most proxies/load balancers
3. Falls back to `'unknown'` (all unknown-IP requests share one bucket)

On Netlify behind Cloudflare, `cf-connecting-ip` will always be present so IP detection is reliable.

### Known limitation

The rate limiter is **in-memory per process**. If Netlify spins up multiple function instances simultaneously, each has its own counter. For a pool with hundreds of users this is not a practical concern. If you scale to thousands of concurrent users, replace the store in `rate-limit.ts` with a shared Redis or Cloudflare KV store.

---

## Files changed

| File | Change |
|---|---|
| `src/lib/server/rate-limit.ts` | New — sliding-window limiter + IP helper |
| `src/routes/login/+page.server.ts` | Rate limit + Turnstile verification added |
| `src/routes/login/+page.svelte` | Turnstile widget added (env-gated) |
| `src/routes/register/+page.server.ts` | Rate limit added (Turnstile was already present) |
| `src/routes/forgot-password/+page.server.ts` | Rate limit added (Turnstile was already present) |

---

## Production checklist

- [ ] Turnstile site created at dash.cloudflare.com with your production domain
- [ ] `PUBLIC_TURNSTILE_SITE_KEY` set in Netlify environment variables
- [ ] `TURNSTILE_SECRET_KEY` set in Netlify environment variables
- [ ] Test keys removed from `.env` (or `.env` is not committed — it should not be)
- [ ] Verify `.env` is in `.gitignore`
