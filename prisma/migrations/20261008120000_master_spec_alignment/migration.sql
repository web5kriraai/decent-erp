-- Master spec alignment: corrections reviewer/cycle, assignment rules, timer idempotency

ALTER TABLE "design_corrections" ADD COLUMN IF NOT EXISTS "reviewer_employee_id" INTEGER;
ALTER TABLE "design_corrections" ADD COLUMN IF NOT EXISTS "cycle_no" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "design_corrections" ADD CONSTRAINT "design_corrections_reviewer_employee_id_fkey"
  FOREIGN KEY ("reviewer_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "IX_DesignCorrection_ReviewerEmployee_Status"
  ON "design_corrections"("reviewer_employee_id", "status");

CREATE INDEX IF NOT EXISTS "IX_DesignCorrection_Design_Route_Cycle"
  ON "design_corrections"("design_id", "route_to_sub_process_id", "cycle_no");

UPDATE "design_corrections"
SET "reviewer_employee_id" = "raised_by"
WHERE "reviewer_employee_id" IS NULL;

CREATE TABLE IF NOT EXISTS "assignment_rules" (
  "assignment_rule_id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "strategy" TEXT NOT NULL DEFAULT 'WORKLOAD_SKILL',
  "criteria_json" JSONB NOT NULL DEFAULT '{}',
  "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at_utc" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assignment_rules_pkey" PRIMARY KEY ("assignment_rule_id")
);

CREATE INDEX IF NOT EXISTS "IX_AssignmentRule_Company_Active_Priority"
  ON "assignment_rules"("company_id", "active", "priority");

ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "task_timer_idempotency" (
  "timer_idempotency_id" BIGSERIAL NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "task_id" BIGINT NOT NULL,
  "employee_id" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_timer_idempotency_pkey" PRIMARY KEY ("timer_idempotency_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_timer_idempotency_idempotency_key_key"
  ON "task_timer_idempotency"("idempotency_key");

CREATE INDEX IF NOT EXISTS "IX_TaskTimerIdempotency_CreatedAt"
  ON "task_timer_idempotency"("created_at_utc");

ALTER TABLE "task_timer_idempotency" ADD CONSTRAINT "task_timer_idempotency_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "design_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_timer_idempotency" ADD CONSTRAINT "task_timer_idempotency_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
