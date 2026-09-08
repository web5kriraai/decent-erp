-- Revert 20260908000000_drop_dead_design_fields: restore removed Basic-section fields.

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('NEW_DESIGN', 'REPEAT', 'REVIVAL', 'CUSTOM');

-- AlterTable
ALTER TABLE "design_concepts"
  ADD COLUMN "concept_note" TEXT,
  ADD COLUMN "style_name" TEXT,
  ADD COLUMN "work_type" "WorkType",
  ADD COLUMN "trend_reference" TEXT,
  ADD COLUMN "celebrity_reference" TEXT,
  ADD COLUMN "target_grade" TEXT,
  ADD COLUMN "design_grade_id" INTEGER,
  ADD COLUMN "fabric_id" INTEGER,
  ADD COLUMN "machine_id" INTEGER,
  ADD COLUMN "stitching_type_id" INTEGER;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_design_grade_id_fkey" FOREIGN KEY ("design_grade_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_fabric_id_fkey" FOREIGN KEY ("fabric_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_stitching_type_id_fkey" FOREIGN KEY ("stitching_type_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;