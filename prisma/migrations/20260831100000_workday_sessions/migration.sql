-- CreateTable
CREATE TABLE "workday_sessions" (
    "workday_session_id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "closed_at_utc" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER NOT NULL,

    CONSTRAINT "workday_sessions_pkey" PRIMARY KEY ("workday_session_id")
);

-- CreateIndex
CREATE INDEX "IX_WorkdaySession_WorkDate" ON "workday_sessions"("work_date");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_WorkdaySession_Employee_Date" ON "workday_sessions"("employee_id", "work_date");

-- AddForeignKey
ALTER TABLE "workday_sessions" ADD CONSTRAINT "workday_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workday_sessions" ADD CONSTRAINT "workday_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
