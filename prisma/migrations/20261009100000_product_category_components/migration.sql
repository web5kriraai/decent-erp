-- Product category ↔ component mapping for dynamic component pickers.
CREATE TABLE "product_category_component_link" (
    "id" SERIAL NOT NULL,
    "product_category_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_category_component_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_category_component_link_product_category_id_component_id_key" ON "product_category_component_link"("product_category_id", "component_id");
CREATE INDEX "product_category_component_link_product_category_id_sort_order_idx" ON "product_category_component_link"("product_category_id", "sort_order");

ALTER TABLE "product_category_component_link" ADD CONSTRAINT "product_category_component_link_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "master_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_category_component_link" ADD CONSTRAINT "product_category_component_link_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "master_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
