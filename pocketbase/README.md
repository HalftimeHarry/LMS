# PocketBase

PocketBase runs on Railway at `https://api.yourdomain.com`.

## Local development

Download the PocketBase binary for your platform from https://pocketbase.io/docs/
and place it here, then run:

```sh
./pocketbase serve
```

Admin UI will be available at http://127.0.0.1:8090/_/

## Migrations

Schema migrations live in `pb_migrations/`. They are applied automatically on startup.

## Collections

See `docs/schema.md` for the full collection schema.
