-- CreateEnum
CREATE TYPE "TaskArtifactType" AS ENUM ('SKETCH_VERSION', 'PUNCHING_FILE', 'SAMPLE_OUTPUT', 'AUDIO_NOTE', 'VIDEO_REF');
CREATE TYPE "WorkType" AS ENUM ('NEW_DESIGN', 'REPEAT', 'REVIVAL', 'CUSTOM');

-- ComponentType master
CREATE TABLE "component_types" (
    "component_type_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "product_type_id" INTEGER,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "component_types_pkey" PRIMARY KEY ("component_type_id")
);
CREATE UNIQUE INDEX "component_types_code_key" ON "component_types"("code");
ALTER TABLE "component_types" ADD CONSTRAINT "component_types_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DesignConcept extensions
ALTER TABLE "design_concepts" ADD COLUMN "design_number" TEXT;
ALTER TABLE "design_concepts" ADD COLUMN "style_name" TEXT;
ALTER TABLE "design_concepts" ADD COLUMN "work_type" "WorkType";
ALTER TABLE "design_concepts" ADD COLUMN "trend_reference" TEXT;
ALTER TABLE "design_concepts" ADD COLUMN "celebrity_reference" TEXT;
ALTER TABLE "design_concepts" ADD COLUMN "assignment_mode" "AssignmentMode" NOT NULL DEFAULT 'AUTOMATIC';
CREATE UNIQUE INDEX "design_concepts_design_number_key" ON "design_concepts"("design_number");

-- DesignTask sequence fields
ALTER TABLE "design_tasks" ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "design_tasks" ADD COLUMN "dependency_sequence" INTEGER;

-- DesignCorrection version refs
ALTER TABLE "design_corrections" ADD COLUMN "before_image_id" BIGINT;
ALTER TABLE "design_corrections" ADD COLUMN "after_image_id" BIGINT;

-- FK design_components -> component_types
ALTER TABLE "design_components" ADD CONSTRAINT "design_components_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "component_types"("component_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Quality checklist
CREATE TABLE "quality_checklist_items" (
    "checklist_item_id" SERIAL NOT NULL,
    "sub_process_id" INTEGER,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "quality_checklist_items_pkey" PRIMARY KEY ("checklist_item_id")
);
CREATE UNIQUE INDEX "quality_checklist_items_code_key" ON "quality_checklist_items"("code");
ALTER TABLE "quality_checklist_items" ADD CONSTRAINT "quality_checklist_items_sub_process_id_fkey" FOREIGN KEY ("sub_process_id") REFERENCES "design_sub_process_master"("sub_process_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "task_checklist_results" (
    "checklist_result_id" BIGSERIAL NOT NULL,
    "task_id" BIGINT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "result" BOOLEAN NOT NULL,
    "remark" TEXT,
    CONSTRAINT "task_checklist_results_pkey" PRIMARY KEY ("checklist_result_id")
);
CREATE UNIQUE INDEX "task_checklist_results_task_id_item_id_key" ON "task_checklist_results"("task_id", "item_id");
ALTER TABLE "task_checklist_results" ADD CONSTRAINT "task_checklist_results_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "design_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_checklist_results" ADD CONSTRAINT "task_checklist_results_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "quality_checklist_items"("checklist_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Task artifacts (sketch/punch/sample metadata)
CREATE TABLE "task_artifacts" (
    "artifact_id" BIGSERIAL NOT NULL,
    "task_id" BIGINT NOT NULL,
    "artifact_type" "TaskArtifactType" NOT NULL,
    "version_no" INTEGER,
    "storage_key" TEXT,
    "file_name" TEXT,
    "content_type" TEXT,
    "file_size" BIGINT,
    "stitch_count" INTEGER,
    "machine_format" TEXT,
    "sample_qty" INTEGER,
    "wastage_qty" INTEGER,
    "metadata" JSONB,
    "uploaded_by" INTEGER NOT NULL,
    "uploaded_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_artifacts_pkey" PRIMARY KEY ("artifact_id")
);
CREATE INDEX "task_artifacts_task_id_artifact_type_idx" ON "task_artifacts"("task_id", "artifact_type");
ALTER TABLE "task_artifacts" ADD CONSTRAINT "task_artifacts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "design_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_artifacts" ADD CONSTRAINT "task_artifacts_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ERP production handoff
CREATE TABLE "production_handoffs" (
    "handoff_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "design_number" TEXT NOT NULL,
    "erp_module" TEXT NOT NULL,
    "erp_reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "released_by" INTEGER NOT NULL,
    "released_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_handoffs_pkey" PRIMARY KEY ("handoff_id")
);
CREATE INDEX "production_handoffs_design_id_idx" ON "production_handoffs"("design_id");
ALTER TABLE "production_handoffs" ADD CONSTRAINT "production_handoffs_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_handoffs" ADD CONSTRAINT "production_handoffs_released_by_fkey" FOREIGN KEY ("released_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Design success metrics (downstream analytics placeholder)
CREATE TABLE "design_success_metrics" (
    "success_metric_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "production_qty" INTEGER NOT NULL DEFAULT 0,
    "sales_qty" INTEGER NOT NULL DEFAULT 0,
    "sales_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "return_qty" INTEGER NOT NULL DEFAULT 0,
    "margin_percent" DECIMAL(5,2),
    "repeat_orders" INTEGER NOT NULL DEFAULT 0,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "design_success_metrics_pkey" PRIMARY KEY ("success_metric_id")
);
CREATE UNIQUE INDEX "design_success_metrics_design_id_period_year_period_month_key" ON "design_success_metrics"("design_id", "period_year", "period_month");
ALTER TABLE "design_success_metrics" ADD CONSTRAINT "design_success_metrics_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;
