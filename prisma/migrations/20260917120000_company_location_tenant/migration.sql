-- Multi-company / location isolation (spec §16 org/company/location scope)

CREATE TABLE "companies" (
    "company_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("company_id")
);

CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

CREATE TABLE "locations" (
    "location_id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

CREATE UNIQUE INDEX "locations_company_id_code_key" ON "locations"("company_id", "code");
CREATE INDEX "locations_company_id_active_idx" ON "locations"("company_id", "active");

ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "companies" ("code", "name", "active", "created_at_utc", "updated_at_utc")
VALUES ('DECENT', 'Decent Technologies', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "locations" ("company_id", "code", "name", "active", "created_at_utc", "updated_at_utc")
SELECT c."company_id", 'HO', 'Head Office', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c WHERE c."code" = 'DECENT';

ALTER TABLE "employees" ADD COLUMN "company_id" INTEGER;
ALTER TABLE "employees" ADD COLUMN "location_id" INTEGER;

UPDATE "employees" e
SET "company_id" = c."company_id",
    "location_id" = l."location_id"
FROM "companies" c
JOIN "locations" l ON l."company_id" = c."company_id" AND l."code" = 'HO'
WHERE c."code" = 'DECENT';

ALTER TABLE "employees" ALTER COLUMN "company_id" SET NOT NULL;

ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "employees_company_id_active_idx" ON "employees"("company_id", "active");

ALTER TABLE "design_concepts" ADD COLUMN "company_id" INTEGER;
ALTER TABLE "design_concepts" ADD COLUMN "location_id" INTEGER;

UPDATE "design_concepts" d
SET "company_id" = e."company_id",
    "location_id" = e."location_id"
FROM "employees" e
WHERE e.id = d."created_by";

UPDATE "design_concepts" d
SET "company_id" = c."company_id",
    "location_id" = l."location_id"
FROM "companies" c
JOIN "locations" l ON l."company_id" = c."company_id" AND l."code" = 'HO'
WHERE c."code" = 'DECENT' AND d."company_id" IS NULL;

ALTER TABLE "design_concepts" ALTER COLUMN "company_id" SET NOT NULL;

ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "design_concepts_company_id_status_idx" ON "design_concepts"("company_id", "status");
