#!/bin/sh
# Run all migrations in order
# This script is designed to be run on every container startup
# Uses standard PG* environment variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE)

set -e

MIGRATIONS_DIR="/migrations"

echo "Running migrations..."

for migration in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
    echo "Applying: $(basename $migration)"
    psql -f "$migration" 2>&1 || true
done

echo "Migrations complete."
