-- CreateTable
CREATE TABLE "design_costs" (
    "design_cost_id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "cost_type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "entered_by" INTEGER NOT NULL,
    "entered_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_costs_pkey" PRIMARY KEY ("design_cost_id")
);

-- CreateIndex
CREATE INDEX "design_costs_design_id_cost_type_idx" ON "design_costs"("design_id", "cost_type");

-- AddForeignKey
ALTER TABLE "design_costs" ADD CONSTRAINT "design_costs_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_concepts"("design_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_costs" ADD CONSTRAINT "design_costs_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
