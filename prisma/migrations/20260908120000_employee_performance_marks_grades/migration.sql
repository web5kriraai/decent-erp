-- Employee performance marks ledger, monthly grades, and design creativity ratings

CREATE TABLE IF NOT EXISTS "employee_performance_marks" (
    "performance_mark_id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "source_type" VARCHAR(40) NOT NULL,
    "source_ref" VARCHAR(120),
    "points_delta" DECIMAL(10,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_by" INTEGER,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_performance_marks_pkey" PRIMARY KEY ("performance_mark_id")
);

CREATE TABLE IF NOT EXISTS "employee_performance_grades" (
    "performance_grade_id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "total_marks" DECIMAL(12,2) NOT NULL,
    "grade_code" VARCHAR(8) NOT NULL,
    "weighted_kpi_score" DECIMAL(10,2) NOT NULL,
    "calculated_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculation_version" INTEGER NOT NULL,

    CONSTRAINT "employee_performance_grades_pkey" PRIMARY KEY ("performance_grade_id")
);

CREATE TABLE IF NOT EXISTS "design_creativity_ratings" (
    "creativity_rating_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "rated_by" INTEGER NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "remark" TEXT,
    "rated_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_creativity_ratings_pkey" PRIMARY KEY ("creativity_rating_id")
);

CREATE INDEX IF NOT EXISTS "IX_EmployeePerformanceMark_Employee_Created" ON "employee_performance_marks"("employee_id", "created_at_utc");
CREATE INDEX IF NOT EXISTS "employee_performance_marks_source_type_source_ref_idx" ON "employee_performance_marks"("source_type", "source_ref");

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_EmployeePerformanceGrade_Period" ON "employee_performance_grades"("employee_id", "period_year", "period_month");
CREATE INDEX IF NOT EXISTS "employee_performance_grades_period_year_period_month_grade_code_idx" ON "employee_performance_grades"("period_year", "period_month", "grade_code");

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_DesignCreativityRating_Design_Employee" ON "design_creativity_ratings"("design_id", "employee_id");
CREATE INDEX IF NOT EXISTS "design_creativity_ratings_employee_id_rated_at_utc_idx" ON "design_creativity_ratings"("employee_id", "rated_at_utc");

DO $$ BEGIN
  ALTER TABLE "employee_performance_marks" ADD CONSTRAINT "employee_performance_marks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_performance_marks" ADD CONSTRAINT "employee_performance_marks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_performance_grades" ADD CONSTRAINT "employee_performance_grades_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "design_creativity_ratings" ADD CONSTRAINT "design_creativity_ratings_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "design_creativity_ratings" ADD CONSTRAINT "design_creativity_ratings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "design_creativity_ratings" ADD CONSTRAINT "design_creativity_ratings_rated_by_fkey" FOREIGN KEY ("rated_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
