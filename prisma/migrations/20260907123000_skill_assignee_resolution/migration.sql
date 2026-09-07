-- Skill master + employee skills + optional pattern SkillId (spec §6.2)
-- Note: Skill PK column is skill_id (@map), not id.

CREATE TABLE IF NOT EXISTS "skills" (
    "skill_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_role_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("skill_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "skills_code_key" ON "skills"("code");

DO $$ BEGIN
  ALTER TABLE "skills" ADD CONSTRAINT "skills_default_role_id_fkey" FOREIGN KEY ("default_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "employee_skills" (
    "employee_id" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "proficiency" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("employee_id","skill_id")
);

DO $$ BEGIN
  ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workflow_pattern_tasks" ADD COLUMN IF NOT EXISTS "default_skill_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "workflow_pattern_tasks" ADD CONSTRAINT "workflow_pattern_tasks_default_skill_id_fkey" FOREIGN KEY ("default_skill_id") REFERENCES "skills"("skill_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
