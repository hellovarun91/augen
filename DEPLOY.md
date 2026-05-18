# Deploying Augen

Recommended path: **Railway** for closed-beta. SQLite on a persistent volume + Next.js. Migrate to GCP / Cloud Run + Cloud SQL when you outgrow it.

## Option A — Railway via web UI (15 min)

### 1. Create the project

1. Sign in at https://railway.app.
2. **New Project → Deploy from GitHub repo → `hellovarun91/augen`**.
3. Railway detects Next.js and runs `npm install && npm run build`.

## Option B — Railway via CLI (10 min if comfortable in terminal)

```bash
# Install
brew install railway        # macOS — or: npm i -g @railway/cli

# Sign in
railway login               # opens browser
# or for headless / SSH sessions:
railway login --browserless # prints a URL + pastes a token

# Verify
railway whoami

# In the repo root:
cd /Users/vsaini/Desktop/augen

# Link to an existing project (or create one)
railway init                # creates a new project, asks for a name
# or: railway link          # if the project already exists in your dashboard

# Set environment variables (see "Set environment variables" below)
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set GEMINI_API_KEY=...
railway variables set AUGEN_ALLOWED_EMAILS="alice@x.com,bob@y.com"
# ...or in bulk from your .env.local:
railway variables --from-file .env.local

# Add the two volumes (one-time, via dashboard or CLI):
#   /app/data        (1 GB, for the SQLite file)
#   /app/public/refs (5 GB, for uploaded images)
# CLI flag in newer railway-cli versions:
#   railway volumes create --mount-path /app/data 1
#   railway volumes create --mount-path /app/public/refs 5
# If your CLI version doesn't have `volumes`, add them via the dashboard:
#   Service → Settings → Volumes → New Volume

# Deploy
railway up                  # streams logs while building
# or: railway up --detach   # fire-and-forget

# Generate a public domain
railway domain              # prints a https://*.up.railway.app URL

# Stream logs from the deployed service
railway logs

# Open a one-off shell on the deployed container
railway shell

# Run the seed inside the deployed container (creates 3 demo brands)
railway run npm run seed
```

### 2. Add a persistent volume

The SQLite database lives at `data/augen.db`; uploaded brand references at `public/refs/`. Both must survive deploys.

1. In your service → **Settings → Volumes**.
2. **New Volume** mounted at `/app/data` (size 1 GB is plenty).
3. **New Volume** mounted at `/app/public/refs` (size 5 GB).

If your repo is in a subdirectory or your build path differs, adjust mount points to match.

### 3. Set environment variables

Open **Variables** and paste from `.env.example`:

**Required for real AI:**
- `ANTHROPIC_API_KEY` — Claude (Strategist / Copywriter / Critic / Art Director / token extraction)
- `GEMINI_API_KEY` — image generation
- `PEXELS_API_KEY` — stock photos (optional)
- `FIGMA_PERSONAL_ACCESS_TOKEN` — token sync (optional)

**Closed-beta auth:**
- `AUGEN_ALLOWED_EMAILS=alice@x.com,bob@y.com` — only these emails can sign in

**Cost safety:**
- `ANTHROPIC_BUDGET_USD=50` — automatic fallback to mock past this monthly spend

**Observability (highly recommended for first users):**
- `NEXT_PUBLIC_POSTHOG_KEY` — session replay + funnels
- `NEXT_PUBLIC_SENTRY_DSN` (and `SENTRY_DSN` for server-side) — error tracking

**Production runtime:**
- `NODE_ENV=production`
- `PORT=3000` (Railway sets this automatically)

### 4. First deploy

1. Hit **Deploy**. Watch the build logs.
2. When healthy, **Settings → Networking → Generate Domain** for a public URL.
3. Visit `https://your-app.up.railway.app/signin` and sign in with one of the allowed emails.
4. The DB auto-migrates on first boot. No manual setup.

### 5. Seed (optional)

To pre-populate three demo brands so first testers see something:

```bash
railway run npm run seed
```

(Or just onboard a real brand from the UI.)

---

## Day-2: real-time visibility

### PostHog (session replay)
Sign up at https://posthog.com → Project Settings → API Key → paste into `NEXT_PUBLIC_POSTHOG_KEY`. You'll see:
- Session recordings of every tester's flow
- Funnel: sign-in → onboard brand → first generation → first approval
- Custom events: `generate_ads`, `spin_variants`, etc. (server-side captures)

### Sentry (errors)
Sign up at https://sentry.io → New Project (Next.js) → DSN → paste into `NEXT_PUBLIC_SENTRY_DSN` AND `SENTRY_DSN`. Errors land in the dashboard with full stack traces and (with PostHog wired) session replay links.

### Railway logs
Built-in. **Service → Deployments → Logs**. Filter by `error` or `warn`. Stream in real-time.

---

## Cost expectations

At Sonnet 4.6 + Nano Banana 2 prices, with default credit pricing:

| Activity | Real cost | Credits charged | Retail |
|---|---|---|---|
| Generate 8 ads (Claude only) | ~$0.40 | 40 | $0.80 |
| Generate 8 ads (Claude + Gemini) | ~$0.80 | 80 | $1.60 |
| Spin 8 copy variants | ~$0.02 | 2 | $0.04 |
| Token extraction | ~$0.03 | 5 | $0.10 |

`ANTHROPIC_BUDGET_USD` is a hard cap — once breached, the chain silently falls back to mock for new calls. Existing chains in flight complete.

---

## When to migrate off Railway

Railway is great until:
- You need a different region than Railway offers
- You need formal SOC2 / HIPAA paperwork
- You have >50 concurrent users (SQLite + single writer becomes the bottleneck)
- Your team has standardized on GCP / AWS

Migration path:
1. Export `data/augen.db` → Postgres via the SQLite browser
2. Swap `lib/db.ts` to use `pg` instead of `better-sqlite3` (same query shape — most repos take a few hours)
3. Move `public/refs/` to GCS / S3 / R2
4. Deploy to Cloud Run / ECS / Fly

The data model is portable; the rest follows.

---

## Local development

```bash
git clone https://github.com/hellovarun91/augen.git
cd augen
npm install
cp .env.example .env.local
# fill in keys you have
npm run seed
npm run dev
```

http://localhost:3000

```bash
npm test           # run critical-path tests
npm run typecheck  # TypeScript check
```
