-- CreateEnum
CREATE TYPE "DesignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'APPROVAL_PENDING', 'APPROVED', 'REJECTED', 'PRODUCTION_RELEASED', 'LIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'RUNNING', 'ON_HOLD', 'CHECKING', 'CORRECTION_REQUIRED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CHECKING', 'DONE', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TimeEventType" AS ENUM ('START', 'HOLD', 'RESUME', 'END', 'OFFICE_CLOSE', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('MISTAKE', 'IMPROVEMENT', 'CUSTOMER_CHANGE', 'MACHINE_MATERIAL_ISSUE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "employee_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "product_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_process_master" (
    "process_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_product_type" INTEGER,

    CONSTRAINT "design_process_master_pkey" PRIMARY KEY ("process_id")
);

-- CreateTable
CREATE TABLE "design_sub_process_master" (
    "sub_process_id" SERIAL NOT NULL,
    "process_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "default_role_id" INTEGER,
    "is_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_correction_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_file_required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "design_sub_process_master_pkey" PRIMARY KEY ("sub_process_id")
);

-- CreateTable
CREATE TABLE "product_process_mapping" (
    "id" SERIAL NOT NULL,
    "product_type_id" INTEGER NOT NULL,
    "process_id" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_process_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_patterns" (
    "workflow_pattern_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "product_type_id" INTEGER,
    "version_no" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "workflow_patterns_pkey" PRIMARY KEY ("workflow_pattern_id")
);

-- CreateTable
CREATE TABLE "workflow_pattern_tasks" (
    "pattern_task_id" SERIAL NOT NULL,
    "workflow_pattern_id" INTEGER NOT NULL,
    "process_id" INTEGER NOT NULL,
    "sub_process_id" INTEGER NOT NULL,
    "default_role_id" INTEGER NOT NULL,
    "expected_minutes" INTEGER NOT NULL,
    "day_offset" INTEGER NOT NULL DEFAULT 0,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "sequence" INTEGER NOT NULL,
    "dependency_sequence" INTEGER,

    CONSTRAINT "workflow_pattern_tasks_pkey" PRIMARY KEY ("pattern_task_id")
);

-- CreateTable
CREATE TABLE "task_hold_reasons" (
    "hold_reason_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exclude_from_active_time" BOOLEAN NOT NULL DEFAULT false,
    "delay_owner_category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "task_hold_reasons_pkey" PRIMARY KEY ("hold_reason_id")
);

-- CreateTable
CREATE TABLE "approval_levels" (
    "approval_level_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approval_levels_pkey" PRIMARY KEY ("approval_level_id")
);

-- CreateTable
CREATE TABLE "design_concepts" (
    "design_id" BIGSERIAL NOT NULL,
    "idea_ref" TEXT NOT NULL,
    "product_type_id" INTEGER NOT NULL,
    "collection_name" TEXT NOT NULL,
    "season_id" INTEGER NOT NULL,
    "design_head_employee_id" INTEGER NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "concept_note" TEXT,
    "current_stage" TEXT,
    "status" "DesignStatus" NOT NULL DEFAULT 'DRAFT',
    "workflow_pattern_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "design_concepts_pkey" PRIMARY KEY ("design_id")
);

-- CreateTable
CREATE TABLE "design_components" (
    "design_component_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "component_type_id" INTEGER NOT NULL,
    "specification" TEXT,
    "sequence" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "design_components_pkey" PRIMARY KEY ("design_component_id")
);

-- CreateTable
CREATE TABLE "design_images" (
    "image_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "design_component_id" BIGINT,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" INTEGER NOT NULL,
    "uploaded_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_images_pkey" PRIMARY KEY ("image_id")
);

-- CreateTable
CREATE TABLE "design_processes" (
    "design_process_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "process_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "planned_start" TIMESTAMP(3),
    "planned_end" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),

    CONSTRAINT "design_processes_pkey" PRIMARY KEY ("design_process_id")
);

-- CreateTable
CREATE TABLE "design_sub_processes" (
    "design_sub_process_id" BIGSERIAL NOT NULL,
    "design_process_id" BIGINT NOT NULL,
    "sub_process_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dependency_id" BIGINT,

    CONSTRAINT "design_sub_processes_pkey" PRIMARY KEY ("design_sub_process_id")
);

-- CreateTable
CREATE TABLE "design_tasks" (
    "task_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "process_id" INTEGER NOT NULL,
    "sub_process_id" INTEGER NOT NULL,
    "assigned_employee_id" INTEGER,
    "assigned_role_id" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "expected_minutes" INTEGER NOT NULL,
    "planned_start" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "output_remark" TEXT,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "design_tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "task_time_events" (
    "event_id" BIGSERIAL NOT NULL,
    "task_id" BIGINT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "event_type" "TimeEventType" NOT NULL,
    "hold_reason_id" INTEGER,
    "remark" TEXT,
    "event_time_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "source_device_id" TEXT,
    "source_ip" TEXT,

    CONSTRAINT "task_time_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "design_corrections" (
    "correction_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "task_id" BIGINT NOT NULL,
    "correction_type" "CorrectionType" NOT NULL,
    "responsible_employee_id" INTEGER NOT NULL,
    "raised_by" INTEGER NOT NULL,
    "root_cause" TEXT,
    "extra_minutes" INTEGER,
    "extra_cost" DECIMAL(18,2),
    "rating_impact" DECIMAL(5,2),
    "status" "CorrectionStatus" NOT NULL DEFAULT 'OPEN',
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_corrections_pkey" PRIMARY KEY ("correction_id")
);

-- CreateTable
CREATE TABLE "design_approvals" (
    "approval_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "task_id" BIGINT,
    "approval_level_id" INTEGER NOT NULL,
    "approver_employee_id" INTEGER NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "decision_at_utc" TIMESTAMP(3),

    CONSTRAINT "design_approvals_pkey" PRIMARY KEY ("approval_id")
);

-- CreateTable
CREATE TABLE "employee_kpi_definitions" (
    "kpi_definition_id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "metric_code" TEXT NOT NULL,
    "weight_percent" DECIMAL(5,2) NOT NULL,
    "target" DECIMAL(10,2),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "employee_kpi_definitions_pkey" PRIMARY KEY ("kpi_definition_id")
);

-- CreateTable
CREATE TABLE "employee_kpi_scores" (
    "kpi_score_id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "metric_code" TEXT NOT NULL,
    "score" DECIMAL(10,2) NOT NULL,
    "weighted_score" DECIMAL(10,2) NOT NULL,
    "calculated_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculation_version" INTEGER NOT NULL,

    CONSTRAINT "employee_kpi_scores_pkey" PRIMARY KEY ("kpi_score_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_id" BIGSERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "user_id" INTEGER NOT NULL,
    "at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" BIGSERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at_utc" TIMESTAMP(3),

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "product_types_code_key" ON "product_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_code_key" ON "seasons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "design_process_master_code_key" ON "design_process_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "design_sub_process_master_process_id_code_key" ON "design_sub_process_master"("process_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_process_mapping_product_type_id_process_id_key" ON "product_process_mapping"("product_type_id", "process_id");

-- CreateIndex
CREATE INDEX "workflow_pattern_tasks_workflow_pattern_id_sequence_idx" ON "workflow_pattern_tasks"("workflow_pattern_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "task_hold_reasons_code_key" ON "task_hold_reasons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "approval_levels_code_key" ON "approval_levels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "design_concepts_idea_ref_key" ON "design_concepts"("idea_ref");

-- CreateIndex
CREATE INDEX "design_concepts_status_priority_idx" ON "design_concepts"("status", "priority");

-- CreateIndex
CREATE INDEX "design_components_design_id_sequence_idx" ON "design_components"("design_id", "sequence");

-- CreateIndex
CREATE INDEX "design_images_design_id_idx" ON "design_images"("design_id");

-- CreateIndex
CREATE INDEX "design_processes_design_id_sequence_idx" ON "design_processes"("design_id", "sequence");

-- CreateIndex
CREATE INDEX "design_sub_processes_design_process_id_sequence_idx" ON "design_sub_processes"("design_process_id", "sequence");

-- CreateIndex
CREATE INDEX "IX_DesignTask_AssignedEmployee_Status_DueAt" ON "design_tasks"("assigned_employee_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "IX_DesignTask_DesignId_Process_SubProcess" ON "design_tasks"("design_id", "process_id", "sub_process_id");

-- CreateIndex
CREATE INDEX "IX_TaskTimeEvent_TaskId_EventTimeUtc" ON "task_time_events"("task_id", "event_time_utc");

-- CreateIndex
CREATE INDEX "IX_TaskTimeEvent_EmployeeId_EventTimeUtc" ON "task_time_events"("employee_id", "event_time_utc");

-- CreateIndex
CREATE INDEX "IX_DesignCorrection_ResponsibleEmployee_Status" ON "design_corrections"("responsible_employee_id", "status");

-- CreateIndex
CREATE INDEX "IX_DesignApproval_DesignId_Level_Decision" ON "design_approvals"("design_id", "approval_level_id", "decision");

-- CreateIndex
CREATE INDEX "employee_kpi_definitions_role_id_metric_code_idx" ON "employee_kpi_definitions"("role_id", "metric_code");

-- CreateIndex
CREATE INDEX "IX_EmployeeKpiScore_Employee_Period" ON "employee_kpi_scores"("employee_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_at_utc_idx" ON "audit_logs"("user_id", "at_utc");

-- CreateIndex
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "notification_outbox_processed_created_at_utc_idx" ON "notification_outbox"("processed", "created_at_utc");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_sub_process_master" ADD CONSTRAINT "design_sub_process_master_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "design_process_master"("process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_process_mapping" ADD CONSTRAINT "product_process_mapping_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_process_mapping" ADD CONSTRAINT "product_process_mapping_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "design_process_master"("process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_patterns" ADD CONSTRAINT "workflow_patterns_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_pattern_tasks" ADD CONSTRAINT "workflow_pattern_tasks_workflow_pattern_id_fkey" FOREIGN KEY ("workflow_pattern_id") REFERENCES "workflow_patterns"("workflow_pattern_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_pattern_tasks" ADD CONSTRAINT "workflow_pattern_tasks_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "design_process_master"("process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_pattern_tasks" ADD CONSTRAINT "workflow_pattern_tasks_sub_process_id_fkey" FOREIGN KEY ("sub_process_id") REFERENCES "design_sub_process_master"("sub_process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_pattern_tasks" ADD CONSTRAINT "workflow_pattern_tasks_default_role_id_fkey" FOREIGN KEY ("default_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_design_head_employee_id_fkey" FOREIGN KEY ("design_head_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_workflow_pattern_id_fkey" FOREIGN KEY ("workflow_pattern_id") REFERENCES "workflow_patterns"("workflow_pattern_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_components" ADD CONSTRAINT "design_components_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_images" ADD CONSTRAINT "design_images_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_images" ADD CONSTRAINT "design_images_design_component_id_fkey" FOREIGN KEY ("design_component_id") REFERENCES "design_components"("design_component_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_images" ADD CONSTRAINT "design_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_processes" ADD CONSTRAINT "design_processes_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_processes" ADD CONSTRAINT "design_processes_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "design_process_master"("process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_sub_processes" ADD CONSTRAINT "design_sub_processes_design_process_id_fkey" FOREIGN KEY ("design_process_id") REFERENCES "design_processes"("design_process_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_sub_processes" ADD CONSTRAINT "design_sub_processes_sub_process_id_fkey" FOREIGN KEY ("sub_process_id") REFERENCES "design_sub_process_master"("sub_process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "design_process_master"("process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_sub_process_id_fkey" FOREIGN KEY ("sub_process_id") REFERENCES "design_sub_process_master"("sub_process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_events" ADD CONSTRAINT "task_time_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "design_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_events" ADD CONSTRAINT "task_time_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_events" ADD CONSTRAINT "task_time_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_events" ADD CONSTRAINT "task_time_events_hold_reason_id_fkey" FOREIGN KEY ("hold_reason_id") REFERENCES "task_hold_reasons"("hold_reason_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_corrections" ADD CONSTRAINT "design_corrections_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_corrections" ADD CONSTRAINT "design_corrections_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "design_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_corrections" ADD CONSTRAINT "design_corrections_responsible_employee_id_fkey" FOREIGN KEY ("responsible_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_corrections" ADD CONSTRAINT "design_corrections_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_approvals" ADD CONSTRAINT "design_approvals_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_approvals" ADD CONSTRAINT "design_approvals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "design_tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_approvals" ADD CONSTRAINT "design_approvals_approval_level_id_fkey" FOREIGN KEY ("approval_level_id") REFERENCES "approval_levels"("approval_level_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_approvals" ADD CONSTRAINT "design_approvals_approver_employee_id_fkey" FOREIGN KEY ("approver_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_kpi_definitions" ADD CONSTRAINT "employee_kpi_definitions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_kpi_scores" ADD CONSTRAINT "employee_kpi_scores_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
