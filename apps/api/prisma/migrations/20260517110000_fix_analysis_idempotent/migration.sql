-- Idempotent fix for bidding_analyses schema drift
-- This migration safely handles cases where previous migrations partially applied

-- 1. Fix bidding_id nullable (idempotent)
DO $$
BEGIN
    -- Drop FK if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bidding_analyses_bidding_id_fkey' 
        AND table_name = 'bidding_analyses'
    ) THEN
        ALTER TABLE "bidding_analyses" DROP CONSTRAINT "bidding_analyses_bidding_id_fkey";
    END IF;

    -- Drop unique constraint if exists (old style)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bidding_analyses_bidding_id_key' 
        AND table_name = 'bidding_analyses'
        AND constraint_type = 'UNIQUE'
    ) THEN
        ALTER TABLE "bidding_analyses" DROP CONSTRAINT "bidding_analyses_bidding_id_key";
    END IF;

    -- Drop unique index if exists (new style)
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'bidding_analyses_bidding_id_key' 
        AND tablename = 'bidding_analyses'
    ) THEN
        DROP INDEX "bidding_analyses_bidding_id_key";
    END IF;

    -- Make column nullable
    ALTER TABLE "bidding_analyses" ALTER COLUMN "bidding_id" DROP NOT NULL;

    -- Recreate partial unique index
    CREATE UNIQUE INDEX "bidding_analyses_bidding_id_key" 
    ON "bidding_analyses"("bidding_id") 
    WHERE "bidding_id" IS NOT NULL;

    -- Recreate FK
    ALTER TABLE "bidding_analyses" 
    ADD CONSTRAINT "bidding_analyses_bidding_id_fkey" 
    FOREIGN KEY ("bidding_id") REFERENCES "biddings"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;
END $$;

-- 2. Ensure id has default (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bidding_analyses' 
        AND column_name = 'id' 
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE "bidding_analyses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- 3. Ensure NOT NULL columns that should have defaults have them
-- (for backwards compatibility with rows inserted before schema change)
DO $$
BEGIN
    -- If analyzed_at doesn't have default, add one
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bidding_analyses' 
        AND column_name = 'analyzed_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bidding_analyses' 
        AND column_name = 'analyzed_at' 
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE "bidding_analyses" ALTER COLUMN "analyzed_at" SET DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
