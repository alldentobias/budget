#!/bin/bash
#
# Validate all code before committing
# Run from project root: ./scripts/validate.sh
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "  Budget App - Full Validation"
echo "============================================"
echo ""

# Backend (Deno)
echo -e "${YELLOW}[1/3] Validating Backend (Deno)...${NC}"
cd backend
if deno task check && deno task lint; then
    echo -e "${GREEN}✓ Backend passed${NC}"
else
    echo -e "${RED}✗ Backend failed${NC}"
    exit 1
fi
cd ..

# Frontend (React/TypeScript)
echo ""
echo -e "${YELLOW}[2/3] Validating Frontend (React)...${NC}"
cd frontend
if npm run typecheck && npm run build; then
    echo -e "${GREEN}✓ Frontend passed${NC}"
else
    echo -e "${RED}✗ Frontend failed${NC}"
    exit 1
fi
cd ..

# Python Service
echo ""
echo -e "${YELLOW}[3/3] Validating Python Service...${NC}"
cd python-service
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Check if ruff is installed
if command -v ruff &> /dev/null; then
    if ruff check app/ tests/ && ruff format --check app/ tests/; then
        echo -e "${GREEN}✓ Python linting passed${NC}"
    else
        echo -e "${RED}✗ Python linting failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Ruff not installed, skipping Python lint${NC}"
fi

if pytest -q; then
    echo -e "${GREEN}✓ Python tests passed${NC}"
else
    echo -e "${RED}✗ Python tests failed${NC}"
    exit 1
fi
cd ..

echo ""
echo "============================================"
echo -e "${GREEN}  ✓ All validations passed!${NC}"
echo "============================================"


