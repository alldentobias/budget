#!/bin/bash
#
# Create a new user for the Budget App
#
# Usage:
#   ./scripts/create-user.sh email@example.com mypassword
#
# For Docker deployment:
#   docker compose exec postgres psql -U budget -d budget -c "..."
#

set -e

EMAIL="${1:-}"
PASSWORD="${2:-}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
    echo "Usage: $0 <email> <password>"
    echo ""
    echo "Example:"
    echo "  $0 user@example.com secretpassword123"
    exit 1
fi

# Generate bcrypt hash using Python (available in most systems)
# Cost factor 10 for compatibility
HASH=$(python3 -c "
import bcrypt
password = '${PASSWORD}'.encode('utf-8')
salt = bcrypt.gensalt(rounds=10)
hashed = bcrypt.hashpw(password, salt)
print(hashed.decode('utf-8'))
" 2>/dev/null || echo "")

if [ -z "$HASH" ]; then
    echo "Error: Could not generate password hash."
    echo "Make sure Python 3 and bcrypt are installed:"
    echo "  pip install bcrypt"
    exit 1
fi

# Generate the SQL
SQL="
-- Create user
INSERT INTO users (email, password_hash) 
VALUES ('${EMAIL}', '${HASH}')
ON CONFLICT (email) DO UPDATE SET password_hash = '${HASH}'
RETURNING id, email;
"

echo "============================================"
echo "User Creation SQL"
echo "============================================"
echo ""
echo "Run this SQL in your database:"
echo ""
echo "$SQL"
echo ""
echo "============================================"
echo ""
echo "For Docker deployment, run:"
echo ""
echo "docker compose -f docker-compose.hetzner.yml exec postgres psql -U budget -d budget -c \"INSERT INTO users (email, password_hash) VALUES ('${EMAIL}', '${HASH}') ON CONFLICT (email) DO UPDATE SET password_hash = '${HASH}';\""
echo ""

