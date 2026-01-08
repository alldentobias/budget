# Hetzner Cloud Deployment Guide

Complete guide to deploy Budget App on Hetzner Cloud (🇩🇪 Germany).

**Cost: €3.79/month** for everything (server + bandwidth + backups)

---

## Step 1: Create Hetzner Account & Server

### 1.1 Sign up at [hetzner.cloud](https://hetzner.cloud)

### 1.2 Create a new project

### 1.3 Add your SSH key
- Go to **Security** → **SSH Keys** → **Add SSH Key**
- Paste your public key (`cat ~/.ssh/id_rsa.pub`)

### 1.4 Create server
- Click **Add Server**
- **Location**: Falkenstein (fsn1) or Nuremberg (nbg1)
- **Image**: Ubuntu 24.04
- **Type**: CX22 (€3.79/month) - 2 vCPU, 4GB RAM, 40GB SSD
- **SSH Key**: Select your key
- **Name**: `budget-app`
- Click **Create & Buy**

### 1.5 Note the IP address
Your server's IP will be shown (e.g., `95.216.xxx.xxx`)

---

## Step 2: Configure Your Domain

Point your domain to the Hetzner server:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | budget | 95.216.xxx.xxx | 300 |

Or for root domain:
| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 95.216.xxx.xxx | 300 |

**Wait 5-10 minutes** for DNS to propagate.

Verify with: `ping budget.yourdomain.com`

---

## Step 3: Deploy

### Option A: Automated (Recommended)

SSH into your server and run:

```bash
# SSH into server
ssh root@95.216.xxx.xxx

# Download and run setup script
curl -sSL https://raw.githubusercontent.com/YOUR_USER/budget/main/deploy/hetzner-setup.sh -o setup.sh
chmod +x setup.sh
./setup.sh budget.yourdomain.com https://github.com/YOUR_USER/budget.git
```

### Option B: Manual

```bash
# SSH into server
ssh root@95.216.xxx.xxx

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone repository
git clone https://github.com/YOUR_USER/budget.git /opt/budget
cd /opt/budget

# Create environment file
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

cat > .env << EOF
DATABASE_URL=postgres://budget:${POSTGRES_PASSWORD}@postgres:5432/budget
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
EOF

# Update Caddyfile with your domain
sed -i 's/YOUR_DOMAIN/budget.yourdomain.com/g' Caddyfile

# Start everything
docker compose -f docker-compose.hetzner.yml up -d --build
```

---

## Step 4: Verify Deployment

1. Open `https://budget.yourdomain.com` in your browser
2. You should see the login page with valid SSL certificate
3. Login with test credentials:
   - Email: `test@example.com`
   - Password: `password123`

---

## Post-Deployment

### Change Default Password

⚠️ **Important**: Change the test user password immediately!

1. Login with test credentials
2. Go to Settings
3. (Or directly update in database)

### Create Your Own User

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Connect to database
cd /opt/budget
docker compose -f docker-compose.hetzner.yml exec postgres psql -U budget -d budget

# In psql, create new user (use a bcrypt hash for password)
# Generate hash at: https://bcrypt-generator.com/
INSERT INTO users (email, password_hash, name) 
VALUES ('your@email.com', '$2a$10$YOUR_BCRYPT_HASH', 'Your Name');

# Exit
\q
```

### View Logs

```bash
cd /opt/budget

# All services
docker compose -f docker-compose.hetzner.yml logs -f

# Specific service
docker compose -f docker-compose.hetzner.yml logs -f backend
docker compose -f docker-compose.hetzner.yml logs -f frontend
docker compose -f docker-compose.hetzner.yml logs -f postgres
```

### Update Application

```bash
cd /opt/budget
git pull
docker compose -f docker-compose.hetzner.yml up -d --build
```

### Restart Services

```bash
cd /opt/budget
docker compose -f docker-compose.hetzner.yml restart
```

### Backup Database Manually

```bash
cd /opt/budget
docker compose -f docker-compose.hetzner.yml exec postgres pg_dump -U budget budget > backup.sql
```

### Restore Database

```bash
cd /opt/budget
cat backup.sql | docker compose -f docker-compose.hetzner.yml exec -T postgres psql -U budget budget
```

---

## Maintenance

### Automatic Backups

Backups are created automatically every 24 hours and stored in `/opt/budget/backups/`.
Backups older than 7 days are automatically deleted.

### System Updates

```bash
# Update Ubuntu
apt update && apt upgrade -y

# Update Docker images
cd /opt/budget
docker compose -f docker-compose.hetzner.yml pull
docker compose -f docker-compose.hetzner.yml up -d
```

### SSL Certificate

Caddy automatically obtains and renews Let's Encrypt certificates. No action needed!

---

## Firewall (Optional)

Hetzner Cloud has a built-in firewall. Recommended rules:

| Direction | Protocol | Port | Source |
|-----------|----------|------|--------|
| Inbound | TCP | 22 | Your IP only |
| Inbound | TCP | 80 | Any |
| Inbound | TCP | 443 | Any |
| Outbound | All | All | Any |

Setup in Hetzner Console → Firewalls → Create Firewall

---

## Troubleshooting

### Site not loading

```bash
# Check if containers are running
docker compose -f docker-compose.hetzner.yml ps

# Check logs
docker compose -f docker-compose.hetzner.yml logs

# Restart everything
docker compose -f docker-compose.hetzner.yml down
docker compose -f docker-compose.hetzner.yml up -d
```

### SSL certificate error

```bash
# Check Caddy logs
docker compose -f docker-compose.hetzner.yml logs caddy

# Common issues:
# - DNS not pointing to server yet (wait and retry)
# - Domain name typo in Caddyfile
# - Port 80/443 blocked by firewall
```

### Database connection error

```bash
# Check postgres is healthy
docker compose -f docker-compose.hetzner.yml ps postgres

# Check postgres logs
docker compose -f docker-compose.hetzner.yml logs postgres

# Verify DATABASE_URL in .env matches POSTGRES_PASSWORD
```

---

## Cost Breakdown

| Item | Monthly Cost |
|------|--------------|
| CX22 Server | €3.79 |
| Bandwidth (20TB included) | €0.00 |
| Backups (local) | €0.00 |
| SSL Certificate | €0.00 (Let's Encrypt) |
| **Total** | **€3.79** |

---

## Security Checklist

- [ ] Changed default test user password
- [ ] Created personal user account
- [ ] SSH key authentication only (disable password auth)
- [ ] Firewall configured (Hetzner Console)
- [ ] Regular system updates scheduled
- [ ] Verified backups are working


