DO $$ BEGIN
  CREATE TYPE "AiInsightStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TABLE "AiInsight" ADD COLUMN IF NOT EXISTS "coachEditedBody" TEXT;
ALTER TABLE "AiInsight" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "AiInsight" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "AiInsight" ADD COLUMN IF NOT EXISTS "status" "AiInsightStatus" NOT NULL DEFAULT 'APPROVED';
CREATE INDEX IF NOT EXISTS "AiInsight_status_createdAt_idx" ON "AiInsight"("status", "createdAt");
