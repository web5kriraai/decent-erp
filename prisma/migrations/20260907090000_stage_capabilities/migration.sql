-- Dynamic workflow engine: stage capabilities metadata
ALTER TABLE "design_sub_process_master" ADD COLUMN IF NOT EXISTS "capabilities" JSONB;
ALTER TABLE "workflow_pattern_tasks" ADD COLUMN IF NOT EXISTS "capabilities_override" JSONB;
