# Budget Tracker

A comprehensive personal budgeting application with expense tracking, asset management, stock portfolio monitoring, and CSV import capabilities.

## Features

- **Dashboard**: Net worth, debt-to-asset ratio, stock portfolio overview
- **Monthly Expenses**: Track and categorize expenses per month
- **CSV Import**: Import bank statements with Python extraction scripts
- **Asset Tracking**: Stocks (with Yahoo Finance price updates), property, cash
- **Loan Management**: Track loans with ownership splits
- **Multi-user Auth**: JWT-based authentication
- **Data Export**: Full backup to JSON/CSV

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, Vite, shadcn/ui, Tailwind CSS, TanStack Query, Recharts |
| Backend | Deno, Hono, Drizzle ORM |
| Python Service | FastAPI, pandas, uvicorn |
| Database | PostgreSQL 16 |
| Stock Data | Yahoo Finance |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for frontend development)
- Deno 1.40+ (for backend development)
- Python 3.11+ (for extractor service)

### Development Setup

1. **Start the database**:
   ```bash
   docker compose up postgres -d
   ```

2. **Start the Python service**:
   ```bash
   cd python-service
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8001
   ```

3. **Start the backend**:
   ```bash
   cd backend
   deno task dev
   ```

4. **Start the frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open http://localhost:5173

### Production (Docker Compose)

```bash
docker compose up --build
```

Access at http://localhost:3000

## Project Structure

```
budget/
├── docker-compose.yml
├── frontend/           # React + Vite app
│   ├── src/
│   │   ├── components/ # UI components (shadcn/ui)
│   │   ├── pages/      # Page components
│   │   ├── lib/        # API client, utilities
│   │   └── hooks/      # Custom React hooks
├── backend/            # Deno + Hono API
│   └── src/
│       ├── routes/     # API endpoints
│       ├── db/         # Drizzle schema
│       └── middleware/ # Auth middleware
├── python-service/     # FastAPI extraction service
│   ├── app/
│   │   ├── extractors/ # Bank-specific parsers
│   │   └── schemas.py  # Pydantic models
│   └── scripts/        # Custom extraction scripts
└── scripts/
    └── init.sql        # DB initialization
```

## Adding Custom Bank Extractors

1. Create a new file in `python-service/app/extractors/`
2. Use the `@register_extractor` decorator:

```python
from app.extractors import register_extractor
from app.schemas import ExtractedTransaction

@register_extractor(
    name="my_bank",
    description="My Bank CSV format",
    formats=["csv"]
)
def extract_my_bank(file_content: bytes, filename: str) -> List[ExtractedTransaction]:
    # Your extraction logic here
    pass
```

## Environment Variables

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `PYTHON_SERVICE_URL`: URL of the Python extraction service

### Frontend
- API calls proxied to backend via Vite config

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Login |
| `GET /api/dashboard/summary` | Dashboard data |
| `GET /api/assets` | List assets |
| `GET /api/loans` | List loans |
| `GET /api/expenses?yearMonth=202401` | Monthly expenses |
| `POST /api/import/upload` | Upload CSV for extraction |
| `GET /api/export/all` | Export all data |

## License

This project is licensed under the **PolyForm Noncommercial License 1.0.0**.

### You CAN:
- ✅ Use for personal budgeting
- ✅ Modify and customize for yourself
- ✅ Share with attribution
- ✅ Use for educational purposes
- ✅ Use in non-profit organizations

### You CANNOT:
- ❌ Sell this software
- ❌ Use in commercial products
- ❌ Offer as a paid service
- ❌ Remove attribution

See [LICENSE](LICENSE) for full details.

© 2025 Tobias Alldén — [github.com/alldentobias](https://github.com/alldentobias)


