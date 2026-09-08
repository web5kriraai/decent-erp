-- Drop dead DesignConcept metadata fields end-to-end (never displayed or consumed downstream).
ALTER TABLE "design_concepts"
  DROP COLUMN IF EXISTS "concept_note",
  DROP COLUMN IF EXISTS "style_name",
  DROP COLUMN IF EXISTS "work_type",
  DROP COLUMN IF EXISTS "trend_reference",
  DROP COLUMN IF EXISTS "celebrity_reference",
  DROP COLUMN IF EXISTS "target_grade",
  DROP COLUMN IF EXISTS "design_grade_id",
  DROP COLUMN IF EXISTS "fabric_id",
  DROP COLUMN IF EXISTS "machine_id",
  DROP COLUMN IF EXISTS "stitching_type_id";

ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_design_grade_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_fabric_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_machine_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_stitching_type_id_fkey";

DROP TYPE IF EXISTS "WorkType";