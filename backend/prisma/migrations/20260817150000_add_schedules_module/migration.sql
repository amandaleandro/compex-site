-- Fase 4 (Esportes): escalas genéricas — súmula, bandeirão, apoio de jogo, material,
-- barracas, recepção etc. Aditiva.

CREATE TYPE "ScheduleFunction" AS ENUM ('SUMULA', 'APOIO_JOGO', 'BANDEIRAO', 'MATERIAL', 'TORCIDA', 'FOTOGRAFIA', 'SOCIAL_MEDIA', 'EVENTOS', 'BARRACAS', 'RECEPCAO', 'VENDA_INGRESSOS', 'TRANSPORTE', 'ORGANIZACAO', 'OUTRA');
CREATE TYPE "ScheduleStatus" AS ENUM ('AGUARDANDO', 'CONFIRMADO', 'TROCA_SOLICITADA', 'SUBSTITUIDO', 'RECUSADO', 'CONCLUIDO');

CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "referenceLabel" TEXT NOT NULL,
    "function" "ScheduleFunction" NOT NULL,
    "assignedName" TEXT NOT NULL,
    "assignedEmail" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "instructions" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'AGUARDANDO',
    "substituteName" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);
