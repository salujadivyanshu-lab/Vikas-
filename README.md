# Vikas Brokerage Platform

A monorepo with independently managed frontend and backend applications.

## Architecture

```text
frontend/                 Angular application, routes, UI, and frontend tests
backend/                  Express API, PostgreSQL integration, and backend tests
  src/
    config/               Runtime configuration and database connection
    controllers/          HTTP request/response handling
    repositories/         SQL access
    routes/               API route definitions
    services/              Business rules and transaction orchestration
```

The backend exposes its REST API under `/api`. The Party Master loads and saves party records through the backend; deal entry also loads parties from the API. Each application has its own `package.json`, lockfile, dependencies, and runtime configuration; shared development commands are defined in the repository root.

## Prerequisites

- Node.js and npm
- PostgreSQL with the schema in `backend/schema.sql` applied

For an existing database, reapply `backend/schema.sql` before starting the updated API. Its `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements add the Party Master contact, role, opening-balance, and creation-date fields without removing existing data.

## Install

From the repository root:

```bash
npm run install:all
```

For local PostgreSQL, copy `backend/.env.example` to `backend/.env` and set the database credentials. The backend also loads the root `.env.local` created by Neon CLI; keep that file private and uncommitted.

## Run locally

Start these in separate terminals from the repository root:

```bash
npm run dev:backend
npm run dev:frontend
```

The Angular app runs at `http://localhost:4200`; the API runs at `http://localhost:3000`.

Other commands:

```bash
npm run start:backend
npm run build
npm run test:frontend
```

The backend can also be managed independently with `npm --prefix backend run <script>`, and the frontend with `npm --prefix frontend run <script>`.

## Free hosting

GitHub Pages hosts the Angular frontend for free, but it does not run the Node API or PostgreSQL. The frontend-only preview deploys without Neon or Render; API-backed actions such as loading and saving records will not work until a backend is configured.

**Security warning:** do not use this public deployment with real business or customer records yet. The current login is enforced only in the browser, and the API endpoints have no server-side authentication; CORS does not prevent direct API access. Use test data until server-side authentication and authorization are added.

1. Push this repository to GitHub and enable **Settings > Pages > GitHub Actions**. The workflow at `.github/workflows/deploy-frontend.yml` builds and publishes the frontend on each push to `main`.
2. No API variable is required for a frontend-only preview. To enable data features later, deploy the backend using `render.yaml`, set its `DATABASE_URL` from Neon, then add the Render API URL ending in `/api` as the GitHub Actions repository variable `API_BASE_URL`.

Free backend/database plans have usage limits and may sleep. Keep database credentials in the Render dashboard or ignored `.env.local`, not in the repository.
