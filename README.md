# Decent ERP - Design Management

Production-ready Next.js 16.3 full-stack application with PostgreSQL (Docker), Redis, MinIO, and Nginx.

## Stack

- **Next.js 16.3.3** - App Router, Route Handlers, standalone Docker output
- **PostgreSQL 16** - primary database (Prisma ORM)
- **Redis 7** - BullMQ job queue
- **MinIO** - S3-compatible object storage for design files
- **NextAuth v5** - JWT auth with RBAC
- **TanStack Query** - server state on the frontend

## Quick start (local)

If ports **5432**, **6379**, or **9000** are already in use on your machine, the default `.env.example` uses alternate ports (**5433**, **6380**, **9002**) - no changes needed.

```bash
cp .env.example .env
docker compose up postgres redis minio minio-init -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000 - login with `admin@decent-erp.local` / `Admin@123`

## Quick start (full Docker)

```bash
cp .env.example .env
docker compose up --build
```

App: http://localhost:3000  
Nginx proxy: http://localhost:8080  
MinIO console: http://localhost:9001

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Place TLS certs in `docker/nginx/certs/` (`fullchain.pem`, `privkey.pem`).

## API surface

REST endpoints under `/api/` - see `.cursor/rules/30-api-surface.mdc` for the full contract.

## Database

- Migrations: `npm run db:migrate`
- Seed roles/permissions/admin: `npm run db:seed`
- Schema reference: `prisma/schema.prisma`

## Default admin

| Field | Value |
|---|---|
| Email | admin@decent-erp.local |
| Password | Admin@123 |

Change immediately in production.
