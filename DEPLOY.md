# Deploying Spend — free hosting, step by step

Three researched paths, all ₹0. Pick one:

| Path | Backend | Database | Sleeps? | Expiry risk |
|---|---|---|---|---|
| **A. Oracle Cloud + Docker** (most free, most control) | ARM VM, Docker Compose, always on | Your own Postgres container | **Never** | None — Always Free tier |
| **B. Render + Neon + pinger** (easiest) | Render free + cron-job.org pinger | Neon free (never expires) | No (while pinger runs) | None |
| **C. Cloud Run + Neon** (serverless container) | Cloud Run free (2M req/mo) | Neon free | Wakes in seconds | None |

> **Why not Render's free Postgres?** It is a 30-day trial — the database is
> deleted after that. Neon's free tier never expires, and it is still Postgres.

---

# PATH A — Oracle Cloud Always Free + Docker (recommended endgame)

Oracle's Always Free tier (not a trial — it never expires): ARM VM with
**2 OCPU / 12 GB RAM** (the enforced limit since Aug 2026 — size your instance
to this, not 4/24), **200 GB block storage, 10 TB/month egress**. The VM runs
24/7 — no pinger, no cold starts — and Postgres gets its storage from that
200 GB pool: a text ledger uses megabytes, so it cannot realistically fill up.

**Known friction (be ready, not scared):** signup needs a card for
verification (₹0 charged; some reports of rejections — retry or use a
different card); ARM instances sometimes hit "out of capacity" — keep
retrying or try every availability domain in your home region. Oracle may
reclaim *idle* instances (CPU/memory <20% over a week) — real app traffic and
the nightly backup cron keep you above that line. Note: in Aug 2026 Oracle
auto-disabled some over-limit instances — stay at 2 OCPU / 12 GB.

### 1. Create the VM
1. **oracle.com/cloud/free** → Start for free (pick your **home region**
   carefully — Always Free resources live there)
2. Compute → Create instance → image **Ubuntu 22.04** → shape
   **VM.Standard.A1.Flex** → **2 OCPU / 12 GB** → add your SSH public key →
   Create. Out of capacity? Retry later or switch availability domain.

### 2. Point a domain at it (needed for HTTPS)
Free option: create a **DuckDNS** subdomain (`spend.yourname.duckdns.org`) →
point it at the VM's public IP.

### 3. Open the ports (two places)
- Oracle console: your instance → Subnet → Security List → add ingress rules
  for TCP 80 and 443 (0.0.0.0/0)
- On the VM, the bootstrap script (below) handles `ufw`

### 4. One-command bootstrap
```bash
ssh ubuntu@<VM_PUBLIC_IP>
git clone https://github.com/himanshu2k16/spend-backend && cd spend-backend
bash scripts/oracle-bootstrap.sh
```
It installs Docker, opens `ufw`, clones the repo, prompts once for
`CLIENT_ORIGIN` (your Vercel URL) + `DOMAIN` (your DuckDNS name), generates
secrets, and starts **Postgres + the API + Caddy** (auto-HTTPS via Let's
Encrypt). Health check: `https://<domain>/api/health`.

### 5. Backups (2 min, do it)
`pgdata` lives in a Docker volume. Cron a nightly dump:
```
0 3 * * * cd ~/spend-backend && docker compose exec -T db pg_dump -U spend spend | gzip > ~/backups/spend-$(date +\%F).sql.gz
```

### 6. Frontend
Vercel Hobby (free, always on) → `NEXT_PUBLIC_API_URL=https://<domain>`.
Changed `CLIENT_ORIGIN`? `docker compose up -d` again.

---

# PATH B — Render + Neon + pinger (zero-ops)

## 1. Neon — create the database (5 min)
1. **neon.tech** → sign in with GitHub
2. Create project → name it `spend`
3. Copy the **connection string** (`postgresql://…neon.tech/spend?sslmode=require`)

## 2. Local schema push (1 min)
```bash
cd C:\Users\Himansu\Desktop\spend-backend
# paste your Neon URL into .env as DATABASE_URL, then:
npx prisma db push
```

## 3. Push the backend repo to GitHub
```bash
cd C:\Users\Himansu\Desktop\spend-backend
git init -b main
git add .
git commit -m "Spend backend API"
# create an empty repo named spend-backend on himanshu2k16, then:
git remote add origin git@github-personal:himanshu2k16/spend-backend.git
git push -u origin main
```

## 4. Render — deploy the backend (5 min)
1. **render.com** → sign in with GitHub
2. **New +** → **Blueprint** → select the `spend-backend` repo
   (Render reads `render.yaml`: build/start/health-check come pre-configured)
3. When prompted, fill the two `sync: false` variables:
   - `DATABASE_URL` → your Neon connection string
   - `CLIENT_ORIGIN` → your frontend URL (e.g. `https://spend-xxx.vercel.app` — deploy the frontend first if you don't have it yet, then edit this env and redeploy)
4. Deploy. `JWT_SECRET` is generated for you; `COOKIE_SAMESITE` is `none` so the
   frontend on a different domain stays logged in.
5. Note your API URL: `https://spend-backend-xxxx.onrender.com`
6. Sanity check: open `<api-url>/api/health` in a browser → `{"ok":true,…}`

## 5. Frontend on Vercel (5 min)
1. **vercel.com** → sign in with GitHub → import the `spend` (frontend) repo
2. Environment variable: `NEXT_PUBLIC_API_URL` = your Render API URL
3. Deploy → open the app → register → the ledger now syncs to Neon
4. If you deployed the frontend AFTER the backend: update `CLIENT_ORIGIN` on
   Render with the final Vercel URL and redeploy the backend.

## 6. The keep-alive robot (5 min)
Render free spins down after 15 idle minutes. Two-layer fix:

**Primary — cron-job.org (reliable 5-min pings):**
1. **cron-job.org** → free account → Create cronjob
2. URL: `https://spend-backend-xxxx.onrender.com/api/health`, every 5 minutes
3. Save. Done — it pings forever, even with your PC off.

(Alternative: **UptimeRobot**, free 5-min HTTP monitor — same idea.)

**Backup — the GitHub Actions watchdog (already in the repo):**
`.github/workflows/health-monitor.yml` pings every 15 min and marks a run as
failed if the API is down (red X + GitHub email if you watch the repo). After
the first deploy, add the repo secret `HEALTH_URL` = your `/api/health` URL and
enable the workflow on the Actions tab.

> GitHub's scheduler can lag 10–30 min under load, which is why it is the
> alarm, not the heartbeat.

## 7. Free-tier math (why this holds)
- Render free instance: 750 instance-hours/month; one always-on service ≈ 744 h
  → fits, but **only this one service**. Keep other Render services suspended.
- Neon free: 0.5 GB storage — a text-only ledger grows ~100 KB/year. Fine.
- Vercel Hobby: generous for a personal app (non-commercial).

# PATH C — Cloud Run + Neon (serverless container)

If you have a Google account willing to add a card (₹0 billed under free
limits): build the Docker image above, push to Artifact Registry, deploy to
**Cloud Run** (2M requests/month free, scales to zero but wakes in ~seconds —
no keep-alive robot needed). Set the same env vars at deploy time. DB: Neon.
This is the middle ground: Docker like Path A, zero-ops like Path B.

## Local development after hosting
Point `.env`'s `DATABASE_URL` at your cloud Postgres and both your local dev
server and the deployed one share the same live database.

