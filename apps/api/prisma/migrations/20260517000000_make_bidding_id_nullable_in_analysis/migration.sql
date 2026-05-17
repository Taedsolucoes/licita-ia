-- Make bidding_id nullable in bidding_analyses to support upload-only analyses
ALTER TABLE "bidding_analyses" DROP CONSTRAINT "bidding_analyses_bidding_id_fkey";
ALTER TABLE "bidding_analyses" ALTER COLUMN "bidding_id" DROP NOT NULL;
ALTER TABLE "bidding_analyses" DROP CONSTRAINT "bidding_analyses_bidding_id_key";
CREATE UNIQUE INDEX "bidding_analyses_bidding_id_key" ON "bidding_analyses"("bidding_id") WHERE "bidding_id" IS NOT NULL;
ALTER TABLE "bidding_analyses" ADD CONSTRAINT "bidding_analyses_bidding_id_fkey" FOREIGN KEY ("bidding_id") REFERENCES "biddings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
