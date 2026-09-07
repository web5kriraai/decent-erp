-- H1–H6 R&D schema: sample decision, expected MRP, cost categories, masters, concept targets

CREATE TYPE "SampleDecision" AS ENUM ('PASS', 'HOLD', 'REJECT');
CREATE TYPE "CostCategory" AS ENUM ('FABRIC', 'EMBROIDERY', 'STITCHING', 'SALARY', 'OTHER');

CREATE TABLE IF NOT EXISTS "fabrics" (
  "fabric_id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "machines" (
  "machine_id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "stitching_types" (
  "stitching_type_id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "design_grades" (
  "design_grade_id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "correction_reasons" (
  "correction_reason_id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "concept_targets" (
  "concept_target_id" SERIAL PRIMARY KEY,
  "period_year" INTEGER NOT NULL,
  "period_month" INTEGER NOT NULL,
  "target_count" INTEGER NOT NULL,
  "season_id" INTEGER,
  "product_type_id" INTEGER,
  "note" TEXT,
  "created_by" INTEGER NOT NULL,
  "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "concept_targets_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "concept_targets_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "concept_targets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "concept_targets_period_year_period_month_season_id_product_type_id_key"
  ON "concept_targets"("period_year", "period_month", "season_id", "product_type_id");
CREATE INDEX IF NOT EXISTS "concept_targets_period_year_period_month_idx"
  ON "concept_targets"("period_year", "period_month");

ALTER TABLE "design_concepts"
  ADD COLUMN IF NOT EXISTS "design_grade_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "fabric_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "machine_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "stitching_type_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "expected_mrp" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "sample_decision" "SampleDecision",
  ADD COLUMN IF NOT EXISTS "sample_decision_remark" TEXT,
  ADD COLUMN IF NOT EXISTS "sample_decision_at_utc" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'design_concepts_design_grade_id_fkey') THEN
    ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_design_grade_id_fkey"
      FOREIGN KEY ("design_grade_id") REFERENCES "design_grades"("design_grade_id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'design_concepts_fabric_id_fkey') THEN
    ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_fabric_id_fkey"
      FOREIGN KEY ("fabric_id") REFERENCES "fabrics"("fabric_id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'design_concepts_machine_id_fkey') THEN
    ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_machine_id_fkey"
      FOREIGN KEY ("machine_id") REFERENCES "machines"("machine_id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'design_concepts_stitching_type_id_fkey') THEN
    ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_stitching_type_id_fkey"
      FOREIGN KEY ("stitching_type_id") REFERENCES "stitching_types"("stitching_type_id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "design_costs" ADD COLUMN IF NOT EXISTS "cost_category" "CostCategory";
