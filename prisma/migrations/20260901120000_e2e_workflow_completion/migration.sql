-- CreateEnum
CREATE TYPE "ImageReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "design_images" ADD COLUMN "review_status" "ImageReviewStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "design_images" ADD COLUMN "review_note" TEXT;

-- CreateTable
CREATE TABLE "employee_notifications" (
    "id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read_at_utc" TIMESTAMP(3),
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IX_EmployeeNotification_Employee_Read" ON "employee_notifications"("employee_id", "read_at_utc", "created_at_utc");

-- AddForeignKey
ALTER TABLE "employee_notifications" ADD CONSTRAINT "employee_notifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
