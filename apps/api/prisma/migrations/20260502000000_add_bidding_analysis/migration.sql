-- CreateTable
CREATE TABLE "bidding_analyses" (
    "id" UUID NOT NULL,
    "bidding_id" UUID NOT NULL,
    "risk_level" VARCHAR(10) NOT NULL,
    "recommendation" VARCHAR(20) NOT NULL,
    "executive_summary" TEXT NOT NULL,
    "document_alerts" JSONB,
    "impugnation_points" JSONB,
    "payment_conditions" JSONB,
    "guarantee_contractual" TEXT,
    "guarantee_object" TEXT,
    "object_description" TEXT,
    "delivery_location" TEXT,
    "delivery_deadline" TEXT,
    "raw_analysis" JSONB,
    "analyzed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidding_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bidding_analyses_bidding_id_key" ON "bidding_analyses"("bidding_id");

-- AddForeignKey
ALTER TABLE "bidding_analyses" ADD CONSTRAINT "bidding_analyses_bidding_id_fkey" FOREIGN KEY ("bidding_id") REFERENCES "biddings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
