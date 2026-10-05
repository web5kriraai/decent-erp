-- Gap closure: BOM, audit archive, KPI scorecards, Wilcom artifact depth

ALTER TABLE "task_artifacts" ADD COLUMN IF NOT EXISTS "needle_count" INTEGER;
ALTER TABLE "task_artifacts" ADD COLUMN IF NOT EXISTS "color_count" INTEGER;
ALTER TABLE "task_artifacts" ADD COLUMN IF NOT EXISTS "hoop_size" VARCHAR(40);
ALTER TABLE "task_artifacts" ADD COLUMN IF NOT EXISTS "software_name" VARCHAR(80);
ALTER TABLE "task_artifacts" ADD COLUMN IF NOT EXISTS "stitch_density" DECIMAL(10,2);

CREATE TABLE IF NOT EXISTS "design_bom_lines" (
    "bom_line_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "parent_line_id" BIGINT,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "item_code" VARCHAR(60),
    "item_name" TEXT NOT NULL,
    "catalog_item_id" INTEGER,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'pcs',
    "waste_percent" DECIMAL(7,2),
    "estimated_unit_cost" DECIMAL(18,2),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_bom_lines_pkey" PRIMARY KEY ("bom_line_id")
);

CREATE INDEX IF NOT EXISTS "design_bom_lines_design_id_sequence_idx" ON "design_bom_lines"("design_id", "sequence");
CREATE INDEX IF NOT EXISTS "design_bom_lines_parent_line_id_idx" ON "design_bom_lines"("parent_line_id");

ALTER TABLE "design_bom_lines" DROP CONSTRAINT IF EXISTS "design_bom_lines_design_id_fkey";
ALTER TABLE "design_bom_lines" ADD CONSTRAINT "design_bom_lines_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "design_bom_lines" DROP CONSTRAINT IF EXISTS "design_bom_lines_parent_line_id_fkey";
ALTER TABLE "design_bom_lines" ADD CONSTRAINT "design_bom_lines_parent_line_id_fkey" FOREIGN KEY ("parent_line_id") REFERENCES "design_bom_lines"("bom_line_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "design_bom_lines" DROP CONSTRAINT IF EXISTS "design_bom_lines_catalog_item_id_fkey";
ALTER TABLE "design_bom_lines" ADD CONSTRAINT "design_bom_lines_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "audit_logs_archive" (
    "audit_archive_id" BIGSERIAL NOT NULL,
    "source_audit_id" BIGINT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "user_id" INTEGER NOT NULL,
    "at_utc" TIMESTAMP(3) NOT NULL,
    "correlation_id" TEXT,
    "archived_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_archive_pkey" PRIMARY KEY ("audit_archive_id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_archive_at_utc_idx" ON "audit_logs_archive"("at_utc");
CREATE INDEX IF NOT EXISTS "audit_logs_archive_entity_type_entity_id_idx" ON "audit_logs_archive"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_archive_source_audit_id_idx" ON "audit_logs_archive"("source_audit_id");

CREATE TABLE IF NOT EXISTS "kpi_scorecards" (
    "scorecard_id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role_id" INTEGER,
    "metric_weights" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_scorecards_pkey" PRIMARY KEY ("scorecard_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_scorecards_company_id_code_key" ON "kpi_scorecards"("company_id", "code");
CREATE INDEX IF NOT EXISTS "kpi_scorecards_company_id_active_idx" ON "kpi_scorecards"("company_id", "active");

ALTER TABLE "kpi_scorecards" DROP CONSTRAINT IF EXISTS "kpi_scorecards_company_id_fkey";
ALTER TABLE "kpi_scorecards" ADD CONSTRAINT "kpi_scorecards_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_scorecards" DROP CONSTRAINT IF EXISTS "kpi_scorecards_role_id_fkey";
ALTER TABLE "kpi_scorecards" ADD CONSTRAINT "kpi_scorecards_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kpi_scorecards" DROP CONSTRAINT IF EXISTS "kpi_scorecards_created_by_fkey";
ALTER TABLE "kpi_scorecards" ADD CONSTRAINT "kpi_scorecards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
