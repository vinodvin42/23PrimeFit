ALTER TABLE "WorkoutProgram"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MealPlan"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "WorkoutProgram_createdById_idx" ON "WorkoutProgram"("createdById");
CREATE INDEX "MealPlan_createdById_idx" ON "MealPlan"("createdById");
