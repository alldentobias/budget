#!/bin/bash
#
# Hetzner Cloud Deployment Script for Budget App
# 
# Prerequisites:
#   1. Create a Hetzner Cloud account at https://hetzner.cloud
#   2. Create a CX22 server (€3.79/month) with Ubuntu 24.04
#   3. Point your domain's A record to the server's IP address
#   4. SSH into the server and run this script
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/YOUR_USER/budget/main/deploy/hetzner-setup.sh | sudo bash -s -- your.domain.com
#
#   Or download and run:
#   chmod +x hetzner-setup.sh
#   sudo ./hetzner-setup.sh your.domain.com

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOMAIN="${1:-}"
APP_DIR="/opt/budget"
REPO_URL="${2:-https://github.com/YOUR_USERNAME/budget.git}"

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Budget App - Hetzner Deployment                       ║"
echo "║     🇩🇪 100% European Hosting                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (sudo)${NC}"
    exit 1
fi

# Check domain argument
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}Usage: sudo $0 your.domain.com [git-repo-url]${NC}"
    echo ""
    echo "Example:"
    echo "  sudo $0 budget.example.com"
    echo "  sudo $0 budget.example.com https://github.com/user/budget.git"
    echo ""
    echo -e "${RED}Error: Domain is required${NC}"
    exit 1
fi

echo -e "${GREEN}[1/7]${NC} Updating system packages..."
apt update && apt upgrade -y

echo -e "${GREEN}[2/7]${NC} Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "Docker already installed"
fi

echo -e "${GREEN}[3/7]${NC} Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
else
    echo "Docker Compose already installed"
fi

echo -e "${GREEN}[4/7]${NC} Setting up application directory..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/backups"
cd "$APP_DIR"

echo -e "${GREEN}[5/7]${NC} Cloning repository..."
if [ -d ".git" ]; then
    echo "Repository exists, pulling latest..."
    git pull
else
    git clone "$REPO_URL" .
fi

echo -e "${GREEN}[6/7]${NC} Generating secure credentials..."
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Create .env file
cat > .env << EOF
# Budget App Configuration
# Generated on $(date)

DATABASE_URL=postgres://budget:${POSTGRES_PASSWORD}@postgres:5432/budget
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
EOF
chmod 600 .env

# Update Caddyfile with domain
sed -i "s/YOUR_DOMAIN/${DOMAIN}/g" Caddyfile

echo -e "${GREEN}[7/7]${NC} Starting services..."
docker compose -f docker-compose.hetzner.yml up -d --build

# Wait for services to start
echo ""
echo "Waiting for services to initialize..."
sleep 10

# Check if services are running
if docker compose -f docker-compose.hetzner.yml ps | grep -q "Up"; then
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ✅ Deployment successful!                             ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Your app is now available at: ${GREEN}https://${DOMAIN}${NC}"
    echo ""
    echo "Default test login:"
    echo "  Email:    test@example.com"
    echo "  Password: password123"
    echo ""
    echo -e "${YELLOW}⚠️  Change the test password immediately after first login!${NC}"
    echo ""
    echo "Useful commands:"
    echo "  View logs:      cd $APP_DIR && docker compose -f docker-compose.hetzner.yml logs -f"
    echo "  Restart:        cd $APP_DIR && docker compose -f docker-compose.hetzner.yml restart"
    echo "  Stop:           cd $APP_DIR && docker compose -f docker-compose.hetzner.yml down"
    echo "  Update:         cd $APP_DIR && git pull && docker compose -f docker-compose.hetzner.yml up -d --build"
    echo ""
    echo "Backups are saved daily to: $APP_DIR/backups/"
    echo "Credentials are stored in: $APP_DIR/.env"
else
    echo -e "${RED}Error: Some services failed to start${NC}"
    echo "Check logs with: docker compose -f docker-compose.hetzner.yml logs"
    exit 1
fi

