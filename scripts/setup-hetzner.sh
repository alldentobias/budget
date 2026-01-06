#!/bin/bash
# Hetzner Cloud Setup Script for Budget App
# Run on a fresh Ubuntu 22.04/24.04 server
#
# Prerequisites:
# 1. Create Hetzner Cloud account at hetzner.cloud
# 2. Create CX22 server (€3.79/month) with Ubuntu 22.04
# 3. Point your domain to the server IP (A record)

set -e

DOMAIN="${1:-}"

echo "🇪🇺 Budget App - European Deployment (Hetzner)"
echo "=============================================="

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo ./setup-hetzner.sh yourdomain.com"
  exit 1
fi

if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo ./setup-hetzner.sh budget.yourdomain.com"
  echo ""
  echo "Make sure your domain points to this server's IP first!"
  exit 1
fi

echo "📦 Updating system..."
apt update && apt upgrade -y

echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "📦 Installing Docker Compose..."
apt install -y docker-compose-plugin

# Setup app directory
APP_DIR="/opt/budget"
echo "📁 Setting up in $APP_DIR..."
mkdir -p $APP_DIR/backups
cd $APP_DIR

# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Create .env
cat > .env << EOF
DATABASE_URL=postgres://budget:${POSTGRES_PASSWORD}@postgres:5432/budget
JWT_SECRET=${JWT_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF
chmod 600 .env

# Update Caddyfile with domain
cat > Caddyfile << EOF
${DOMAIN} {
    handle {
        reverse_proxy frontend:80
    }
    
    handle /api/* {
        reverse_proxy backend:8000
    }
    
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
    
    encode gzip
}
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy your app files to $APP_DIR"
echo "   scp -r . root@your-server-ip:$APP_DIR/"
echo ""
echo "2. Or clone your repo:"
echo "   git clone https://github.com/yourusername/budget.git $APP_DIR"
echo ""
echo "3. Start the app:"
echo "   cd $APP_DIR"
echo "   docker compose -f docker-compose.hetzner.yml up -d"
echo ""
echo "4. Your app will be available at: https://${DOMAIN}"
echo ""
echo "🔐 Secrets stored in $APP_DIR/.env"
echo "💾 Backups will be in $APP_DIR/backups/ (daily, kept 7 days)"

