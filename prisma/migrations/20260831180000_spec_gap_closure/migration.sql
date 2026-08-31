-- CorrectionType: replace MACHINE_MATERIAL_ISSUE with MACHINE / MATERIAL / OTHER
ALTER TABLE "design_corrections" ALTER COLUMN "correction_type" TYPE TEXT;

UPDATE "design_corrections"
SET "correction_type" = 'MACHINE'
WHERE "correction_type" = 'MACHINE_MATERIAL_ISSUE';

-- Detach any leftover tables still typed on CorrectionType (e.g. reference_masters)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reference_masters' AND column_name = 'correction_type'
  ) THEN
    EXECUTE 'ALTER TABLE reference_masters ALTER COLUMN correction_type TYPE TEXT';
  END IF;
END $$;

DROP TYPE "CorrectionType";
CREATE TYPE "CorrectionType" AS ENUM (
  'MISTAKE',
  'IMPROVEMENT',
  'CUSTOMER_CHANGE',
  'MACHINE',
  'MATERIAL',
  'OTHER'
);

ALTER TABLE "design_corrections"
  ALTER COLUMN "correction_type" TYPE "CorrectionType"
  USING "correction_type"::"CorrectionType";

-- Responsible employee optional (required only for MISTAKE in app layer)
ALTER TABLE "design_corrections" ALTER COLUMN "responsible_employee_id" DROP NOT NULL;

-- Route-back fields
ALTER TABLE "design_corrections" ADD COLUMN IF NOT EXISTS "route_to_sub_process_id" INTEGER;
ALTER TABLE "design_corrections" ADD COLUMN IF NOT EXISTS "routed_task_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'design_corrections_route_to_sub_process_id_fkey'
  ) THEN
    ALTER TABLE "design_corrections"
      ADD CONSTRAINT "design_corrections_route_to_sub_process_id_fkey"
      FOREIGN KEY ("route_to_sub_process_id") REFERENCES "design_sub_process_master"("sub_process_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "approval_levels" ADD COLUMN IF NOT EXISTS "required_role_id" INTEGER;
ALTER TABLE "approval_levels" DROP CONSTRAINT IF EXISTS "approval_levels_required_role_id_fkey";
ALTER TABLE "approval_levels"
  ADD CONSTRAINT "approval_levels_required_role_id_fkey"
  FOREIGN KEY ("required_role_id") REFERENCES "roles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Design concept: target grade + estimate/standard cost for margin
ALTER TABLE "design_concepts" ADD COLUMN IF NOT EXISTS "target_grade" TEXT;
ALTER TABLE "design_concepts" ADD COLUMN IF NOT EXISTS "estimated_cost" DECIMAL(18, 2);
ALTER TABLE "design_concepts" ADD COLUMN IF NOT EXISTS "standard_cost" DECIMAL(18, 2);
