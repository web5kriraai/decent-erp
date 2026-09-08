-- Split KPI blame vs rework assignee on design corrections.
ALTER TABLE "design_corrections"
  ADD COLUMN IF NOT EXISTS "rework_assignee_employee_id" INTEGER;

-- Backfill: existing rows used responsible as rework assignee.
UPDATE "design_corrections"
SET "rework_assignee_employee_id" = "responsible_employee_id"
WHERE "rework_assignee_employee_id" IS NULL
  AND "responsible_employee_id" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'design_corrections_rework_assignee_employee_id_fkey'
  ) THEN
    ALTER TABLE "design_corrections"
      ADD CONSTRAINT "design_corrections_rework_assignee_employee_id_fkey"
      FOREIGN KEY ("rework_assignee_employee_id") REFERENCES "employees"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IX_DesignCorrection_ReworkAssignee_Status"
  ON "design_corrections"("rework_assignee_employee_id", "status");
