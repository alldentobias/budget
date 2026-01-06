# Budget App Deployment Guide

## Option 1: Free Cloud Hosting (Recommended for simplicity)

### A. Fly.io + Neon PostgreSQL (~$0/month)

**Setup Neon Database (Free):**
1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string: `postgres://user:pass@ep-xxx.eu-central-1.aws.neon.tech/budget`

**Deploy to Fly.io:**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (first time)
fly launch --no-deploy

# Set secrets
fly secrets set DATABASE_URL="postgres://user:pass@ep-xxx.neon.tech/budget"
fly secrets set JWT_SECRET="your-secure-secret-key-min-32-chars"

# Deploy
fly deploy --dockerfile Dockerfile.fly

# Open app
fly open
```

**Estimated cost:** $0/month (within free tier)

---

### B. Railway (~$5/month)

Railway offers a simpler deployment with built-in PostgreSQL.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Add PostgreSQL
railway add --plugin postgresql

# Deploy
railway up
```

**Estimated cost:** ~$5/month (usage-based)

---

### C. Render + Supabase (~$0-7/month)

1. **Database:** Create free Supabase project at [supabase.com](https://supabase.com)
2. **Backend:** Deploy as Web Service on [render.com](https://render.com)
3. **Frontend:** Deploy on Vercel or Cloudflare Pages (free)

---

## Option 2: Cheap VPS (~$4-6/month)

Best for more control and reliability.

### Recommended Providers:

| Provider | Specs | Price |
|----------|-------|-------|
| **Hetzner Cloud** | 2 vCPU, 2GB RAM, 20GB SSD | €3.79/month (~$4) |
| **Netcup** | 2 vCPU, 2GB RAM, 40GB SSD | €2.99/month (~$3.20) |
| **DigitalOcean** | 1 vCPU, 1GB RAM, 25GB SSD | $6/month |
| **Vultr** | 1 vCPU, 1GB RAM, 25GB SSD | $5/month |
| **Linode** | 1 vCPU, 1GB RAM, 25GB SSD | $5/month |

### VPS Setup Script:

```bash
#!/bin/bash
# Run on fresh Ubuntu 22.04 VPS

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Install Docker Compose
apt install -y docker-compose-plugin

# Clone your repo
git clone https://github.com/yourusername/budget.git /opt/budget
cd /opt/budget

# Create environment file
cat > .env << 'EOF'
DATABASE_URL=postgres://budget:your_secure_password@postgres:5432/budget
JWT_SECRET=your-very-secure-secret-key-at-least-32-characters
POSTGRES_PASSWORD=your_secure_password
EOF

# Start services
docker compose up -d

# Setup automatic SSL with Caddy (optional)
apt install -y caddy
cat > /etc/caddy/Caddyfile << 'EOF'
budget.yourdomain.com {
    reverse_proxy localhost:5173
    
    handle /api/* {
        reverse_proxy localhost:8000
    }
}
EOF
systemctl restart caddy
```

---

## Option 3: Self-Hosting Hardware

### A. Raspberry Pi 4/5 (Best value)

| Model | Price | Notes |
|-------|-------|-------|
| **Raspberry Pi 4 (4GB)** | ~$55 | Sufficient for this app |
| **Raspberry Pi 5 (4GB)** | ~$60 | Better performance |
| **+ 32GB SD Card** | ~$10 | Or use SSD for reliability |
| **+ Power Supply** | ~$15 | Official recommended |
| **+ Case** | ~$10-20 | Optional but recommended |

**Total: ~$90-100 one-time**

**Pi Setup:**
```bash
# Install Raspberry Pi OS Lite (64-bit)
# Then SSH in and run:

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install docker-compose
sudo apt install -y docker-compose

# Clone and run
git clone https://github.com/yourusername/budget.git
cd budget
docker-compose up -d
```

### B. Used Mini PCs (More powerful, quiet)

Great options from eBay/Amazon Renewed:

| Model | Specs | Used Price |
|-------|-------|------------|
| **Dell OptiPlex 3040/3050 Micro** | i5-6500T, 8GB, 256GB SSD | $80-120 |
| **HP ProDesk 400 G3 Mini** | i5-6500T, 8GB, 256GB SSD | $70-100 |
| **Lenovo ThinkCentre M710q Tiny** | i5-7500T, 8GB, 256GB SSD | $90-130 |
| **Intel NUC7i3** | i3-7100U, 8GB, 128GB SSD | $80-120 |

**Total: ~$70-130 one-time**

These are:
- ✅ Very quiet (no fan noise)
- ✅ Low power (~15-35W)
- ✅ x86 compatible (all Docker images work)
- ✅ More powerful than Raspberry Pi

### C. Old Laptop

Any laptop from ~2015+ with:
- 4GB+ RAM
- 64GB+ storage
- Works great, free if you have one!

---

## Power Consumption & Costs

| Device | Power Draw | Monthly Electric Cost* |
|--------|------------|------------------------|
| Raspberry Pi 4 | 3-7W | ~$0.50 |
| Mini PC (idle) | 8-15W | ~$1.20 |
| Mini PC (load) | 25-35W | ~$2.50 |
| Old Laptop | 15-30W | ~$2.00 |

*Assuming $0.15/kWh, 24/7 operation

---

## Recommended Setup for Self-Hosting

### Network Configuration

```
Internet → Router → [Your Server]
                         ↓
              Docker containers:
              - Frontend (port 5173)
              - Backend (port 8000)  
              - Python (port 8001)
              - PostgreSQL (port 5432)
```

### Port Forwarding (Router)
- Forward port 80 → server:80 (HTTP)
- Forward port 443 → server:443 (HTTPS)

### Dynamic DNS (Free)
If you don't have a static IP:
- [DuckDNS](https://www.duckdns.org/) - Free
- [No-IP](https://www.noip.com/) - Free tier
- [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) - Free, no port forwarding needed!

### Cloudflare Tunnel (Recommended for self-hosting)

No port forwarding needed, free SSL:

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create budget

# Configure
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: budget.yourdomain.com
    service: http://localhost:5173
  - hostname: budget.yourdomain.com
    path: /api/*
    service: http://localhost:8000
  - service: http_status:404
EOF

# Run as service
cloudflared service install
systemctl start cloudflared
```

---

## Cost Comparison Summary

| Option | Monthly Cost | Setup Effort | Reliability |
|--------|--------------|--------------|-------------|
| Fly.io + Neon | $0 | Low | High |
| Hetzner VPS | $4 | Medium | High |
| Raspberry Pi | $0.50 (electric) | Medium | Medium |
| Mini PC | $1.50 (electric) | Medium | High |
| Old Laptop | $2 (electric) | Low | Medium |

---

## My Recommendation

**For simplicity:** Fly.io + Neon (free, zero maintenance)

**For control & learning:** Hetzner €3.79/month VPS

**For self-hosting:** Used Dell OptiPlex Micro (~$100 one-time, ~$1.50/month electric)

---

## European-Only Deployment (No US Companies)

For privacy-conscious users who want to avoid US cloud providers:

### European Cloud Providers

| Provider | Country | Price | Notes |
|----------|---------|-------|-------|
| **Hetzner Cloud** | 🇩🇪 Germany | €3.79/month | Best value |
| **Netcup** | 🇩🇪 Germany | €2.99/month | Cheapest |
| **OVHcloud** | 🇫🇷 France | €3.50/month | Large EU provider |
| **Scaleway** | 🇫🇷 France | €7.99/month | Good DX |
| **Infomaniak** | 🇨🇭 Switzerland | €5.75/month | Swiss privacy, eco-friendly |
| **Exoscale** | 🇨🇭 Switzerland | CHF 7/month | Swiss data protection |

### Quick Hetzner Deployment

```bash
# 1. Create CX22 server at hetzner.cloud (€3.79/month)
# 2. Point your domain to the server IP
# 3. SSH in and run:

curl -fsSL https://get.docker.com | sh
git clone <your-repo> /opt/budget
cd /opt/budget

# Edit Caddyfile - replace budget.example.com with your domain
nano Caddyfile

# Generate secrets and start
cat > .env << EOF
DATABASE_URL=postgres://budget:$(openssl rand -hex 16)@postgres:5432/budget
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
EOF

docker compose -f docker-compose.hetzner.yml up -d
```

### European DNS & Domains

| Service | Country |
|---------|---------|
| **Gandi** | 🇫🇷 France |
| **Infomaniak** | 🇨🇭 Switzerland |
| **OVH** | 🇫🇷 France |
| **Hetzner DNS** | 🇩🇪 Germany (free) |
- Best performance/watt ratio
- Silent operation
- Runs full x86 Docker
- Can run other services too (Pi-hole, Home Assistant, etc.)

