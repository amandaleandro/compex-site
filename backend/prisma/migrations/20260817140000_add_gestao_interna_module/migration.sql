-- Fase 3 (Gestão interna): desligamento formal, descanso da gestão e reuniões/atas.
-- Aditiva; nenhuma coluna/tabela existente é alterada além do novo active/leftAt em User.

ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "leftAt" TIMESTAMP(3);

CREATE TYPE "DepartureStatus" AS ENUM ('SOLICITADO', 'EM_ANALISE', 'APROVADO', 'REJEITADO', 'FINALIZADO');

CREATE TABLE "DepartureRequest" (
    "id" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "observations" TEXT,
    "attachments" JSONB,
    "status" "DepartureStatus" NOT NULL DEFAULT 'SOLICITADO',
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartureRequest_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "RestStatus" AS ENUM ('SOLICITADO', 'APROVADO', 'REJEITADO');

CREATE TABLE "RestRequest" (
    "id" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "semester" TEXT NOT NULL,
    "reason" TEXT,
    "substituteName" TEXT,
    "status" "RestStatus" NOT NULL DEFAULT 'SOLICITADO',
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestRequest_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "MeetingStatus" AS ENUM ('RASCUNHO', 'FINALIZADA');

CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Ordinária',
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "participants" JSONB,
    "agenda" TEXT,
    "notes" TEXT,
    "decisions" JSONB,
    "attachments" JSONB,
    "status" "MeetingStatus" NOT NULL DEFAULT 'RASCUNHO',
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);
