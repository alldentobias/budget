#!/bin/bash
# Self-hosting setup script for Budget App
# Run on a fresh Ubuntu/Debian server or Raspberry Pi

set -e

echo "🚀 Budget App Self-Hosting Setup"
echo "================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./setup-selfhost.sh)"
  exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "🐳 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker $SUDO_USER 2>/dev/null || true
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
  echo "📦 Installing Docker Compose..."
  apt install -y docker-compose-plugin
fi

# Create app directory
APP_DIR="/opt/budget"
echo "📁 Setting up app in $APP_DIR..."
mkdir -p $APP_DIR
cd $APP_DIR

# Create environment file
if [ ! -f .env ]; then
  echo "🔐 Creating environment file..."
  
  # Generate secure secrets
  JWT_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  
  cat > .env << EOF
# Budget App Configuration
DATABASE_URL=postgres://budget:${POSTGRES_PASSWORD}@postgres:5432/budget
JWT_SECRET=${JWT_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF
  
  chmod 600 .env
  echo "✅ Created .env with secure secrets"
else
  echo "ℹ️  .env already exists, skipping..."
fi

# Create backup directory
mkdir -p backups

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy your budget app files to $APP_DIR"
echo "   Or clone: git clone https://github.com/yourusername/budget.git $APP_DIR"
echo ""
echo "2. Start the app:"
echo "   cd $APP_DIR"
echo "   docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "3. Access at: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "4. (Optional) Enable daily backups:"
echo "   docker compose -f docker-compose.prod.yml --profile backup up -d"
echo ""
echo "🔐 Your secrets are stored in $APP_DIR/.env"

