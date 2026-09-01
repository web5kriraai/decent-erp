-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

-- AlterTable
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "skipped_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "skipped_by" INTEGER,
ADD COLUMN IF NOT EXISTS "skip_reason" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'design_tasks_skipped_by_fkey'
  ) THEN
    ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_skipped_by_fkey"
      FOREIGN KEY ("skipped_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
