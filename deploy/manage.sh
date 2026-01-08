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
        echo "  shell-db    Open PostgreSQL shell"
        echo "  shell-backend  Open backend shell"
        echo "  cleanup     Remove old Docker images"
        echo ""
        ;;
esac


