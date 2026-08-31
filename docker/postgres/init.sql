-- PostgreSQL extensions and baseline setup for Decent ERP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Ensure UTC is used for timestamps
ALTER DATABASE decent_erp SET timezone TO 'UTC';
