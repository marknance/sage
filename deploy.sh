#!/usr/bin/env bash
set -euo pipefail

APP_NAME="sage"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
HEALTH_URL="http://localhost:3000/api/health"
HEALTH_TIMEOUT=60

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

usage() {
  cat <<EOF
Usage: ./deploy.sh [OPTION]

Deploy and manage Sage via Docker Compose.

Options:
  (none)       Build and start Sage
  --stop       Stop Sage containers
  --restart    Restart Sage containers
  --logs       Tail container logs (Ctrl+C to stop)
  --status     Show container status and health
  -h, --help   Show this help message
EOF
}

check_docker() {
  command -v docker >/dev/null 2>&1 || fail "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
  docker info >/dev/null 2>&1 || fail "Docker daemon is not running. Start Docker and try again."
  docker compose version >/dev/null 2>&1 || fail "Docker Compose is not available. Install Docker Compose v2."
}

ensure_env() {
  if [ ! -f "$ENV_FILE" ]; then
    if [ ! -f "$ENV_EXAMPLE" ]; then
      fail "Missing $ENV_EXAMPLE — cannot create $ENV_FILE."
    fi
    info "Creating $ENV_FILE from $ENV_EXAMPLE..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    # Auto-generate JWT_SECRET
    SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n' | head -c 64)
    # Portable sed: write to temp file instead of -i
    tmp=$(mktemp)
    sed "s/^JWT_SECRET=$/JWT_SECRET=${SECRET}/" "$ENV_FILE" > "$tmp" && mv "$tmp" "$ENV_FILE"
    ok "Generated JWT_SECRET automatically."
  fi

  # Validate JWT_SECRET length
  JWT_VAL=$(grep '^JWT_SECRET=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)
  if [ -z "$JWT_VAL" ]; then
    fail "JWT_SECRET is empty in $ENV_FILE. Set it to a value of at least 32 characters."
  fi
  if [ ${#JWT_VAL} -lt 32 ]; then
    fail "JWT_SECRET is only ${#JWT_VAL} characters. It must be at least 32 characters."
  fi
}

wait_healthy() {
  info "Waiting for Sage to become healthy (up to ${HEALTH_TIMEOUT}s)..."
  elapsed=0
  while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
      ok "Sage is healthy!"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  warn "Health check did not pass within ${HEALTH_TIMEOUT}s. Check logs with: ./deploy.sh --logs"
  return 1
}

print_credentials() {
  info "Checking for initial admin credentials..."
  CREDS=$(docker compose logs "$APP_NAME" 2>/dev/null | grep "SAGE SETUP" | tail -1 || true)
  if [ -n "$CREDS" ]; then
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  $CREDS${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
  fi
}

do_deploy() {
  check_docker
  ensure_env

  info "Building and starting Sage..."
  docker compose up -d --build

  if wait_healthy; then
    print_credentials
    echo ""
    ok "Sage is running at ${GREEN}http://localhost:3000${NC}"
    echo ""
    echo "  Manage with:"
    echo "    ./deploy.sh --logs      Tail logs"
    echo "    ./deploy.sh --stop      Stop Sage"
    echo "    ./deploy.sh --restart   Restart Sage"
    echo "    ./deploy.sh --status    Show status"
  fi
}

do_stop() {
  check_docker
  info "Stopping Sage..."
  docker compose down
  ok "Sage stopped."
}

do_restart() {
  check_docker
  info "Restarting Sage..."
  docker compose restart
  wait_healthy
  ok "Sage restarted at ${GREEN}http://localhost:3000${NC}"
}

do_logs() {
  check_docker
  docker compose logs -f "$APP_NAME"
}

do_status() {
  check_docker
  echo ""
  docker compose ps
  echo ""
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q "$APP_NAME" 2>/dev/null)" 2>/dev/null || echo "unknown")
  echo -e "Health: ${HEALTH}"
  echo ""
}

# ── Main ──────────────────────────────────────────

cd "$(dirname "$0")"

case "${1:-}" in
  --stop)    do_stop ;;
  --restart) do_restart ;;
  --logs)    do_logs ;;
  --status)  do_status ;;
  -h|--help) usage ;;
  "")        do_deploy ;;
  *)         echo "Unknown option: $1"; usage; exit 1 ;;
esac
