-- Persist pattern SkillId onto design tasks for RoleId/SkillId assignee resolution (spec §6.2).
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "required_skill_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'design_tasks_required_skill_id_fkey'
  ) THEN
    ALTER TABLE "design_tasks"
      ADD CONSTRAINT "design_tasks_required_skill_id_fkey"
      FOREIGN KEY ("required_skill_id") REFERENCES "skills"("skill_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
