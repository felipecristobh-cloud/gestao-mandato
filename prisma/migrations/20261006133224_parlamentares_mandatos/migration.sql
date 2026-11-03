-- CreateEnum
CREATE TYPE "CargoParlamentar" AS ENUM ('VEREADOR', 'DEPUTADO_ESTADUAL', 'DEPUTADO_FEDERAL', 'SENADOR', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoParticipacao" AS ENUM ('AUTOR', 'COAUTOR', 'ARTICULADOR', 'PARCEIRO', 'ACOMPANHAMENTO', 'EXECUCAO', 'INTERMEDIARIO');

-- AlterEnum
ALTER TYPE "TipoHistorico" ADD VALUE 'ARTICULACAO';

-- CreateTable
CREATE TABLE "parlamentar" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" "CargoParlamentar" NOT NULL,
    "partido" TEXT,
    "esfera" "Esfera" NOT NULL,
    "municipio" TEXT,
    "uf" CHAR(2),
    "telefone" TEXT,
    "email" TEXT,
    "observacoes" TEXT,
    "proprio" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parlamentar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandato" (
    "id" UUID NOT NULL,
    "parlamentar_id" UUID NOT NULL,
    "cargo" "CargoParlamentar" NOT NULL,
    "esfera" "Esfera" NOT NULL,
    "legislatura" TEXT,
    "descricao" TEXT,
    "partido" TEXT,
    "municipio" TEXT,
    "uf" CHAR(2),
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "observacoes" TEXT,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mandato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demanda_mandato" (
    "id" UUID NOT NULL,
    "demanda_id" UUID NOT NULL,
    "mandato_id" UUID NOT NULL,
    "tipo" "TipoParticipacao" NOT NULL,
    "observacoes" TEXT,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demanda_mandato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parlamentar_nome_idx" ON "parlamentar"("nome");

-- CreateIndex
CREATE INDEX "mandato_parlamentar_id_idx" ON "mandato"("parlamentar_id");

-- CreateIndex
CREATE INDEX "demanda_mandato_mandato_id_idx" ON "demanda_mandato"("mandato_id");

-- CreateIndex
CREATE UNIQUE INDEX "demanda_mandato_demanda_id_mandato_id_tipo_key" ON "demanda_mandato"("demanda_id", "mandato_id", "tipo");

-- AddForeignKey
ALTER TABLE "parlamentar" ADD CONSTRAINT "parlamentar_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandato" ADD CONSTRAINT "mandato_parlamentar_id_fkey" FOREIGN KEY ("parlamentar_id") REFERENCES "parlamentar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandato" ADD CONSTRAINT "mandato_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda_mandato" ADD CONSTRAINT "demanda_mandato_demanda_id_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda_mandato" ADD CONSTRAINT "demanda_mandato_mandato_id_fkey" FOREIGN KEY ("mandato_id") REFERENCES "mandato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda_mandato" ADD CONSTRAINT "demanda_mandato_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Só um parlamentar pode ser o titular do gabinete.
CREATE UNIQUE INDEX "parlamentar_proprio_unico" ON "parlamentar" ("proprio") WHERE "proprio";

-- Fim do mandato não pode ser antes do início.
ALTER TABLE "mandato" ADD CONSTRAINT "mandato_periodo_valido" CHECK ("data_fim" IS NULL OR "data_fim" >= "data_inicio");
