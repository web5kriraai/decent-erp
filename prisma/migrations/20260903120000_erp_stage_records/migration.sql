-- In-app ERP manufacturing chain (Phase F0/F1+ MVP)
CREATE TABLE IF NOT EXISTS "erp_stage_records" (
    "stage_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "design_number" TEXT NOT NULL,
    "erp_module" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "qty" INTEGER NOT NULL DEFAULT 0,
    "wastage_qty" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lot_ref" TEXT,
    "invoice_ref" TEXT,
    "remark" TEXT,
    "started_at_utc" TIMESTAMPTZ,
    "completed_at_utc" TIMESTAMPTZ,
    "completed_by" INTEGER,
    "created_at_utc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_stage_records_pkey" PRIMARY KEY ("stage_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "erp_stage_records_design_id_erp_module_key"
  ON "erp_stage_records"("design_id", "erp_module");

CREATE INDEX IF NOT EXISTS "erp_stage_records_status_erp_module_idx"
  ON "erp_stage_records"("status", "erp_module");

CREATE INDEX IF NOT EXISTS "erp_stage_records_design_number_idx"
  ON "erp_stage_records"("design_number");

ALTER TABLE "erp_stage_records"
  ADD CONSTRAINT "erp_stage_records_design_id_fkey"
  FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "erp_stage_records"
  ADD CONSTRAINT "erp_stage_records_completed_by_fkey"
  FOREIGN KEY ("completed_by") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
