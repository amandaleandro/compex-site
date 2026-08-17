-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "participantEmails" JSONB;

-- CreateTable
CREATE TABLE "MemberAvailability" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberAvailability_userEmail_idx" ON "MemberAvailability"("userEmail");

-- CreateIndex
CREATE INDEX "MemberAvailability_weekday_idx" ON "MemberAvailability"("weekday");
