-- Unify flat masters into master_catalog + materials + media kind + sample machine

CREATE TYPE "MaterialSource" AS ENUM ('STOCK', 'PURCHASE_INDENT');
CREATE TYPE "MaterialLineStatus" AS ENUM ('REQUESTED', 'INDENT', 'AVAILABLE', 'ISSUED', 'CANCELLED');

CREATE TABLE "master_catalog" (
    "id" SERIAL NOT NULL,
    "master_type" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "master_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "master_catalog_master_type_code_key" ON "master_catalog"("master_type", "code");
CREATE INDEX "master_catalog_master_type_is_active_sort_order_idx" ON "master_catalog"("master_type", "is_active", "sort_order");

CREATE TEMP TABLE _mc_map (
  src TEXT NOT NULL,
  old_id INT NOT NULL,
  new_id INT NOT NULL,
  PRIMARY KEY (src, old_id)
);

INSERT INTO "master_catalog" ("master_type", "code", "name", "is_active", "sort_order", "updated_at")
SELECT 'PRODUCT_CATEGORY', code, name, active, id, CURRENT_TIMESTAMP FROM "product_types";
INSERT INTO _mc_map (src, old_id, new_id)
SELECT 'product_types', pt.id, mc.id
FROM "product_types" pt
JOIN "master_catalog" mc ON mc.master_type = 'PRODUCT_CATEGORY' AND mc.code = pt.code;

INSERT INTO "master_catalog" ("master_type", "code", "name", "is_active", "sort_order", "updated_at")
SELECT 'SEASON', code, name, active, id, CURRENT_TIMESTAMP FROM "seasons";
INSERT INTO _mc_map (src, old_id, new_id)
SELECT 'seasons', s.id, mc.id
FROM "seasons" s
JOIN "master_catalog" mc ON mc.master_type = 'SEASON' AND mc.code = s.code;

INSERT INTO "master_catalog" ("master_type", "code", "name", "is_active", "sort_order", "updated_at")
SELECT 'PRODUCT_COMPONENT', code, name, active, sequence, CURRENT_TIMESTAMP FROM "component_types";
INSERT INTO _mc_map (src, old_id, new_id)
SELECT 'component_types', c.component_type_id, mc.id
FROM "component_types" c
JOIN "master_catalog" mc ON mc.master_type = 'PRODUCT_COMPONENT' AND mc.code = c.code;

INSERT INTO "master_catalog" ("master_type", "code", "name", "is_active", "sort_order", "updated_at")
SELECT 'FABRIC_QUALITY', code, name, active, fabric_id, CURRENT_TIMESTAMP FROM "fabrics";
INSERT INTO _mc_map (src, old_id, new_id)
SELECT 'fabrics', f.fabric_id, mc.id
FROM "fabrics" f
JOIN "master_catalog" mc ON mc.master_type = 'FABRIC_QUALITY' AND mc.code = f.code;

INSERT INTO "master_catalog" ("master_type", "code", "name", "is_active", "sort_order", "updated_at")
SELECT 'MACHINE', code, name, active, machine_id, CURRENT_TIMESTAMP FROM "machines";
INSERT INTO _mc_map (src, old_id, new_id)
SELECT 'machines', m.machine_id, mc.id
FROM "machines" m
JOIN "master_catalog" mc ON mc.master_type = 'MACHINE' AND mc.code = m.code;

INSERT INTO "master_catalog" ("master_type", "code", "name", "is_active", "sort_order", "updated_at")
SELECT 'STITCHING_TYPE', code, name, active, stitching_type_id, CURRENT_TIMESTAMP FROM "stitching_types";
INSERT INTO _mc_map (src, old_id, new_id)
SELECT 'stitching_types', s.stitching_type_id, mc.id
FROM "stitching_types" s
JOIN "master_catalog" mc ON mc.master_type = 'STITCHING_TYPE' AND mc.code = s.code;

INSERT INTO "master_catalog" ("master_type", "code", "name", "is_active", "sort_order", "updated_at")
SELECT 'DESIGN_GRADE', code, name, active, design_grade_id, CURRENT_TIMESTAMP FROM "design_grades";
INSERT INTO _mc_map (src, old_id, new_id)
SELECT 'design_grades', g.design_grade_id, mc.id
FROM "design_grades" g
JOIN "master_catalog" mc ON mc.master_type = 'DESIGN_GRADE' AND mc.code = g.code;

INSERT INTO "master_catalog" ("master_type", "code", "name", "is_active", "sort_order", "updated_at")
SELECT 'CORRECTION_TYPE', code, name, active, correction_reason_id, CURRENT_TIMESTAMP FROM "correction_reasons";
INSERT INTO _mc_map (src, old_id, new_id)
SELECT 'correction_reasons', r.correction_reason_id, mc.id
FROM "correction_reasons" r
JOIN "master_catalog" mc ON mc.master_type = 'CORRECTION_TYPE' AND mc.code = r.code;

ALTER TABLE "component_types" DROP CONSTRAINT IF EXISTS "component_types_product_type_id_fkey";
ALTER TABLE "concept_targets" DROP CONSTRAINT IF EXISTS "concept_targets_product_type_id_fkey";
ALTER TABLE "concept_targets" DROP CONSTRAINT IF EXISTS "concept_targets_season_id_fkey";
ALTER TABLE "design_components" DROP CONSTRAINT IF EXISTS "design_components_component_type_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_design_grade_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_fabric_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_machine_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_product_type_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_season_id_fkey";
ALTER TABLE "design_concepts" DROP CONSTRAINT IF EXISTS "design_concepts_stitching_type_id_fkey";
ALTER TABLE "product_process_mapping" DROP CONSTRAINT IF EXISTS "product_process_mapping_product_type_id_fkey";
ALTER TABLE "workflow_patterns" DROP CONSTRAINT IF EXISTS "workflow_patterns_product_type_id_fkey";

UPDATE "design_concepts" d
SET "product_type_id" = m.new_id
FROM _mc_map m WHERE m.src = 'product_types' AND m.old_id = d."product_type_id";

UPDATE "design_concepts" d
SET "season_id" = m.new_id
FROM _mc_map m WHERE m.src = 'seasons' AND m.old_id = d."season_id";

UPDATE "design_concepts" d
SET "fabric_id" = m.new_id
FROM _mc_map m WHERE m.src = 'fabrics' AND m.old_id = d."fabric_id";

UPDATE "design_concepts" d
SET "machine_id" = m.new_id
FROM _mc_map m WHERE m.src = 'machines' AND m.old_id = d."machine_id";

UPDATE "design_concepts" d
SET "stitching_type_id" = m.new_id
FROM _mc_map m WHERE m.src = 'stitching_types' AND m.old_id = d."stitching_type_id";

UPDATE "design_concepts" d
SET "design_grade_id" = m.new_id
FROM _mc_map m WHERE m.src = 'design_grades' AND m.old_id = d."design_grade_id";

UPDATE "design_components" c
SET "component_type_id" = m.new_id
FROM _mc_map m WHERE m.src = 'component_types' AND m.old_id = c."component_type_id";

UPDATE "product_process_mapping" p
SET "product_type_id" = m.new_id
FROM _mc_map m WHERE m.src = 'product_types' AND m.old_id = p."product_type_id";

UPDATE "workflow_patterns" w
SET "product_type_id" = m.new_id
FROM _mc_map m WHERE m.src = 'product_types' AND m.old_id = w."product_type_id";

UPDATE "concept_targets" t
SET "product_type_id" = m.new_id
FROM _mc_map m WHERE m.src = 'product_types' AND m.old_id = t."product_type_id";

UPDATE "concept_targets" t
SET "season_id" = m.new_id
FROM _mc_map m WHERE m.src = 'seasons' AND m.old_id = t."season_id";

DROP TABLE IF EXISTS "component_types";
DROP TABLE IF EXISTS "correction_reasons";
DROP TABLE IF EXISTS "design_grades";
DROP TABLE IF EXISTS "fabrics";
DROP TABLE IF EXISTS "machines";
DROP TABLE IF EXISTS "product_types";
DROP TABLE IF EXISTS "seasons";
DROP TABLE IF EXISTS "stitching_types";

ALTER TABLE "design_images" ADD COLUMN IF NOT EXISTS "media_kind" VARCHAR(20) NOT NULL DEFAULT 'IMAGE';
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "sample_machine_id" INTEGER;
CREATE INDEX IF NOT EXISTS "design_images_design_id_media_kind_idx" ON "design_images"("design_id", "media_kind");

CREATE TABLE "design_material_lines" (
    "material_line_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "catalog_item_id" INTEGER NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'pcs',
    "quantity" DECIMAL(18,3) NOT NULL,
    "source" "MaterialSource" NOT NULL DEFAULT 'STOCK',
    "status" "MaterialLineStatus" NOT NULL DEFAULT 'REQUESTED',
    "wastage_qty" DECIMAL(18,3),
    "remark" TEXT,
    "requested_by" INTEGER NOT NULL,
    "issued_by" INTEGER,
    "issued_at_utc" TIMESTAMP(3),
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "design_material_lines_pkey" PRIMARY KEY ("material_line_id")
);

CREATE INDEX "design_material_lines_design_id_status_idx" ON "design_material_lines"("design_id", "status");

ALTER TABLE "product_process_mapping" ADD CONSTRAINT "product_process_mapping_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "master_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_patterns" ADD CONSTRAINT "workflow_patterns_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "master_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "master_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_design_grade_id_fkey" FOREIGN KEY ("design_grade_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_fabric_id_fkey" FOREIGN KEY ("fabric_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "design_concepts" ADD CONSTRAINT "design_concepts_stitching_type_id_fkey" FOREIGN KEY ("stitching_type_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "design_components" ADD CONSTRAINT "design_components_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "master_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_sample_machine_id_fkey" FOREIGN KEY ("sample_machine_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "design_material_lines" ADD CONSTRAINT "design_material_lines_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "design_material_lines" ADD CONSTRAINT "design_material_lines_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "master_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "design_material_lines" ADD CONSTRAINT "design_material_lines_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "design_material_lines" ADD CONSTRAINT "design_material_lines_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "concept_targets" ADD CONSTRAINT "concept_targets_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "concept_targets" ADD CONSTRAINT "concept_targets_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "master_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
