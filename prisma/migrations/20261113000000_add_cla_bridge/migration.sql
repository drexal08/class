-- CreateEnum
CREATE TYPE "BridgeLevel" AS ENUM ('S4', 'S5', 'S6');

-- CreateTable
CREATE TABLE "BridgeProfile" (
    "userId" TEXT NOT NULL,
    "level" "BridgeLevel" NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "BridgeEstimate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "BridgeLevel" NOT NULL,
    "combinationCode" TEXT NOT NULL DEFAULT '',
    "marks" JSONB NOT NULL DEFAULT '{}',
    "targets" JSONB NOT NULL DEFAULT '{}',
    "goalTargets" JSONB NOT NULL DEFAULT '{}',
    "overallTarget" TEXT,
    "usefulnessRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BridgeProfile_username_key" ON "BridgeProfile"("username");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeEstimate_userId_level_key" ON "BridgeEstimate"("userId", "level");

-- CreateIndex
CREATE INDEX "BridgeEstimate_level_idx" ON "BridgeEstimate"("level");

-- AddForeignKey
ALTER TABLE "BridgeProfile" ADD CONSTRAINT "BridgeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeEstimate" ADD CONSTRAINT "BridgeEstimate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
