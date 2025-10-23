# Restaurant Chatbot

A simple Node.js + Express restaurant chatbot with PostgreSQL for session and order storage and Paystack integration for payments.

This repository contains a conversational ordering chatbot, REST endpoints, and deployment helpers (PM2, PipeOps config).

## Quick links
- `.env.example` — environment variables template
- `initDb.js` — database initialization script
- `server.js` — application entrypoint
- `ecosystem.config.js` — PM2 ecosystem file
- `pipeops.yaml` & `PIPEOPS_DEPLOY.md` — PipeOps deployment config and guide
- `DEPLOY.md` — general deployment instructions
- `DEPLOYMENT_STATUS.md` — current deployment status

## Requirements
- Node.js 14+ (recommended 18+)
- PostgreSQL 12+
- npm
- (Optional) PM2 for process management
- (Optional) PipeOps CLI for cloud deployment

## Environment variables
Copy `.env.example` to `.env` and set values:

- PORT — server port (default 3000)
- NODE_ENV — `production` or `development`
- DATABASE_URL — PostgreSQL connection string
- PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY — Paystack keys
- BASE_URL — app base URL in production

## Local development

1. Install dependencies

```powershell
npm install
```

2. Create and seed the database (if you haven't already)

```powershell
# create database in Postgres (example)
# psql -U postgres -c "CREATE DATABASE restaurantchatbot;"
node initDb.js
```

3. Run the app

```powershell
# run in development
$env:PORT=3000; node server.js
```

4. Health check

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/health' -Method Get
```

## Running in Production (PM2)

Install PM2 globally if you haven't:

```powershell
npm install -g pm2
```

Start using the ecosystem file:

```powershell
pm2 start ecosystem.config.js --env production
pm2 status
pm2 logs restaurantchatbot
```

To restart:

```powershell
pm2 restart restaurantchatbot
```

## Deploying to PipeOps
See `PIPEOPS_DEPLOY.md` and `pipeops.yaml` for a ready-to-use configuration and step-by-step instructions. In short:

1. Set environment variables in PipeOps dashboard (or use `.env.pipeops`)
2. `pipeops init` and `pipeops deploy`
3. Run `pipeops run "node initDb.js"` once to initialize the DB (or run migrations)

## Database

- `initDb.js` creates these tables (if not exists): `sessions`, `menu_items`, `current_orders`, etc.
- Use `node initDb.js` to initialize the DB schema.
- For backup/restore:

```powershell
pg_dump restaurantchatbot > backup.sql
psql restaurantchatbot < backup.sql
```

## Tests
- Project uses Jest + Supertest for unit/integration tests (if present). Run:

```powershell
npm test
```

## Files you may find useful
- `routes/chat.js` — chat flow and state handling
- `routes/payment.js` — payment routes and webhook handling
- `db.js` — Postgres connection and session helpers

## Security & Best Practices
- Never commit secrets: `.env` is ignored in `.gitignore` (already updated).
- Use HTTPS in production and secure database credentials.
- Rotate payment keys regularly and secure webhooks.

## Troubleshooting
- Port conflicts: run `netstat -aon | Select-String ':3000'` or check `Get-Process -Id <pid>` on Windows.
- DB errors: verify `DATABASE_URL`, check `pg_isready` or `psql` connectivity.
- Logs: use `pm2 logs` or check PipeOps logs when deployed.

## Contact / Next steps
If you'd like, I can:
- Add Dockerfile and `docker-compose.yml` for containerized deploys
- Create CI pipeline for tests and deployments
- Add database migrations (eg. with `node-pg-migrate`)

---

Generated on: October 24, 2025
