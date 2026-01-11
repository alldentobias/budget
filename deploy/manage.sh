#!/bin/bash
#
# Budget App Management Script
# Run from /opt/budget on your server
#
# Usage: ./deploy/manage.sh [command]

set -e

APP_DIR="/opt/budget"
COMPOSE_FILE="docker-compose.hetzner.yml"

cd "$APP_DIR"

case "${1:-help}" in
    start)
        echo "Starting Budget App..."
        docker compose -f $COMPOSE_FILE up -d
        ;;
    stop)
        echo "Stopping Budget App..."
        docker compose -f $COMPOSE_FILE down
        ;;
    restart)
        echo "Restarting Budget App..."
        docker compose -f $COMPOSE_FILE restart
        ;;
    logs)
        docker compose -f $COMPOSE_FILE logs -f ${2:-}
        ;;
    status)
        docker compose -f $COMPOSE_FILE ps
        ;;
    update)
        echo "Updating Budget App..."
        git pull
        docker compose -f $COMPOSE_FILE up -d --build
        echo "Update complete!"
        ;;
    backup)
        BACKUP_FILE="backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz"
        echo "Creating backup: $BACKUP_FILE"
        docker compose -f $COMPOSE_FILE exec -T postgres pg_dump -U budget budget | gzip > "$BACKUP_FILE"
        echo "Backup created: $BACKUP_FILE"
        ;;
    restore)
        if [ -z "$2" ]; then
            echo "Usage: $0 restore <backup-file>"
            echo "Available backups:"
            ls -la backups/
            exit 1
        fi
        echo "Restoring from: $2"
        echo "WARNING: This will overwrite all current data!"
        read -p "Continue? (y/N) " confirm
        if [ "$confirm" = "y" ]; then
            gunzip -c "$2" | docker compose -f $COMPOSE_FILE exec -T postgres psql -U budget budget
            echo "Restore complete!"
        fi
        ;;
    shell-db)
        echo "Connecting to PostgreSQL..."
        docker compose -f $COMPOSE_FILE exec postgres psql -U budget -d budget
        ;;
    shell-backend)
        docker compose -f $COMPOSE_FILE exec backend sh
        ;;
    migrate)
        echo "Running database migrations..."
        
        # Create migrations tracking table if it doesn't exist
        docker compose -f $COMPOSE_FILE exec -T postgres psql -U budget -d budget -c "
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
        "
        
        # Run each migration file
        for migration in scripts/migrations/*.sql; do
            if [ -f "$migration" ]; then
                migration_name=$(basename "$migration")
                
                # Check if already applied
                applied=$(docker compose -f $COMPOSE_FILE exec -T postgres psql -U budget -d budget -tAc \
                    "SELECT COUNT(*) FROM _migrations WHERE name = '$migration_name'")
                
                if [ "$applied" = "0" ]; then
                    echo "Applying: $migration_name"
                    docker compose -f $COMPOSE_FILE exec -T postgres psql -U budget -d budget < "$migration"
                    docker compose -f $COMPOSE_FILE exec -T postgres psql -U budget -d budget -c \
                        "INSERT INTO _migrations (name) VALUES ('$migration_name')"
                    echo "  ✓ Applied"
                else
                    echo "  Skipping: $migration_name (already applied)"
                fi
            fi
        done
        
        echo "Migrations complete!"
        ;;
    cleanup)
        echo "Cleaning up old Docker images..."
        docker system prune -af
        ;;
    help|*)
        echo "Budget App Management"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  start       Start all services"
        echo "  stop        Stop all services"
        echo "  restart     Restart all services"
        echo "  logs [svc]  View logs (optional: specific service)"
        echo "  status      Show service status"
        echo "  update      Pull latest code and rebuild"
        echo "  backup      Create database backup"
        echo "  restore     Restore database from backup"
        echo "  migrate     Run pending database migrations"
        echo "  shell-db    Open PostgreSQL shell"
        echo "  shell-backend  Open backend shell"
        echo "  cleanup     Remove old Docker images"
        echo ""
        ;;
esac



