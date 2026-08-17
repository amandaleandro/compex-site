-- AlterTable
ALTER TABLE "Notification"
  ADD COLUMN "remindStage" TEXT,
  ADD COLUMN "popupShownAt" TIMESTAMP(3);
