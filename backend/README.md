# Backend API

Express API backed by PostgreSQL. HTTP handlers live in `src/controllers`, business validation and orchestration in `src/services`, SQL access in `src/repositories`, shared runtime settings in `src/config`, and endpoint registration in `src/routes`.

## Setup

From the repository root:

```bash
npm --prefix backend install
```

Copy `.env.example` to `.env`, set the database credentials, and apply `schema.sql` to the configured database.

## Run

```bash
npm --prefix backend run dev
```

The API listens on `http://localhost:3000` by default. `GET /api/health` reports API and database readiness. `CORS_ORIGIN` accepts a comma-separated list of allowed browser origins.

## Endpoints

- `GET /api/health`
- `GET /api/parties`
- `POST /api/deals`

## Tests

```bash
npm --prefix backend test
```
