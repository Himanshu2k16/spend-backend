#!/usr/bin/env bash
# Oracle Cloud Always Free VM bootstrap for the Spend stack.
# Run ONCE on a fresh Ubuntu 22.04 ARM instance as a sudo-capable user:
#   bash scripts/oracle-bootstrap.sh
set -euo pipefail

echo "== Spend backend bootstrap =="

REPO_URL="${REPO_URL:-https://github.com/himanshu2k16/spend-backend.git}"
APP_DIR="${APP_DIR:-$HOME/spend-backend}"

# 1. Docker + compose plugin
if ! command -v docker >/dev/null; then
  echo "-- installing docker"
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-v2
  sudo usermod -aG docker "$USER"
fi

# 2. Firewall (OS level; Oracle Security List must also allow 80/443 — see DEPLOY.md)
echo "-- configuring ufw (80, 443, ssh)"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 3. Code
if [ ! -d "$APP_DIR" ]; then
  echo "-- cloning $REPO_URL"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# 4. Environment (prompts once, writes .env used by docker-compose.yml)
if [ ! -f .env ]; then
  echo "-- generating .env"
  read -rp "JWT_SECRET (enter to auto-generate): " JWT_SECRET
  [ -z "$JWT_SECRET" ] && JWT_SECRET=$(openssl rand -hex 48)
  read -rp "CLIENT_ORIGIN (your Vercel frontend URL): " CLIENT_ORIGIN
  read -rp "DOMAIN (e.g. spend.yourname.duckdns.org): " DOMAIN
  POSTGRES_PASSWORD=$(openssl rand -hex 24)

  cat > .env <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
CLIENT_ORIGIN=$CLIENT_ORIGIN
DOMAIN=$DOMAIN
EOF
  chmod 600 .env
fi

# 5. Up (fresh sessions may not have the docker group yet — fall back to sudo)
DC="docker compose"
if ! docker info >/dev/null 2>&1; then
  DC="sudo docker compose"
fi
echo "-- starting stack (postgres + api + caddy)"
$DC up -d
$DC ps

cat <<'EOF'

== Done ==
  API:        https://$DOMAIN/api/health  (first cert issuance takes ~30s)
  Tip:        run `newgrp docker` (or re-login) to use docker without sudo
  Logs:       cd ~/spend-backend && (docker compose || sudo docker compose) logs -f api
EOF
