# Budget App Deployment Guide

## Option 1: European Cloud VPS (Recommended)

Best for privacy, GDPR compliance, and avoiding US cloud providers.

### Hetzner Cloud (Best Value) - €3.79/month

| Server | Specs | Price |
|--------|-------|-------|
| **CX22** | 2 vCPU, 4GB RAM, 40GB SSD | €3.79/month |
| **CX32** | 4 vCPU, 8GB RAM, 80GB SSD | €7.59/month |

**Quick Setup:**

```bash
# 1. Create CX22 server at hetzner.cloud (€3.79/month)
# 2. Point your domain to the server IP
# 3. SSH in and run the setup script:

curl -fsSL https://raw.githubusercontent.com/yourusername/budget/main/deploy/hetzner-setup.sh | bash
```

**Manual Setup:**

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Clone repo
git clone https://github.com/yourusername/budget.git /opt/budget
cd /opt/budget

# Generate secrets and create .env
cat > .env << EOF
DATABASE_URL=postgres://budget:$(openssl rand -hex 16)@postgres:5432/budget
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
EOF

# Start services
docker compose -f docker-compose.prod.yml up -d
```

See `deploy/HETZNER.md` for detailed instructions including SSL setup with Caddy.

---

### Other European Providers

| Provider | Country | Price | Notes |
|----------|---------|-------|-------|
| **Netcup** | 🇩🇪 Germany | €2.99/month | Cheapest option |
| **OVHcloud** | 🇫🇷 France | €3.50/month | Large EU provider |
| **Scaleway** | 🇫🇷 France | €7.99/month | Good developer experience |
| **Infomaniak** | 🇨🇭 Switzerland | €5.75/month | Swiss privacy, eco-friendly |
| **Exoscale** | 🇨🇭 Switzerland | CHF 7/month | Swiss data protection |

### European DNS & Domain Registrars

| Service | Country |
|---------|---------|
| **Gandi** | 🇫🇷 France |
| **Infomaniak** | 🇨🇭 Switzerland |
| **OVH** | 🇫🇷 France |
| **Hetzner DNS** | 🇩🇪 Germany (free with server) |

---

## Option 2: Self-Hosting Hardware

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
docker-compose -f docker-compose.prod.yml up -d
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

Benefits:
- ✅ Very quiet (no fan noise)
- ✅ Low power (~15-35W)
- ✅ x86 compatible (all Docker images work)
- ✅ More powerful than Raspberry Pi
- ✅ Can run other services (Pi-hole, Home Assistant, etc.)

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

## Network Setup for Self-Hosting

### Architecture
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
| Hetzner VPS | €3.79 (~$4) | Medium | High |
| Netcup VPS | €2.99 (~$3.20) | Medium | High |
| Raspberry Pi | $0.50 (electric) | Medium | Medium |
| Mini PC | $1.50 (electric) | Medium | High |
| Old Laptop | $2 (electric) | Low | Medium |

---

## Recommendation

**For most users:** Hetzner CX22 at €3.79/month
- European company, GDPR compliant
- Great performance for the price
- Automatic backups available
- See `deploy/HETZNER.md` for full setup guide

**For self-hosting:** Used Dell OptiPlex Micro (~$100 one-time, ~$1.50/month electric)
- Best performance/watt ratio
- Silent operation
- Runs full x86 Docker
- Can run other services too (Pi-hole, Home Assistant, etc.)
