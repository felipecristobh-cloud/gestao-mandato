-- Busca por semelhança (alerta de duplicidade).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "Esfera" AS ENUM ('MUNICIPAL', 'ESTADUAL', 'FEDERAL');

-- CreateEnum
CREATE TYPE "StatusDemanda" AS ENUM ('NOVA', 'EM_ANALISE', 'ENCAMINHADA', 'AGUARDANDO_RETORNO', 'EM_ANDAMENTO', 'RESOLVIDA', 'NAO_RESOLVIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoDemanda" AS ENUM ('SOLICITACAO', 'RECLAMACAO', 'DENUNCIA', 'SUGESTAO', 'PEDIDO_INFORMACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoHistorico" AS ENUM ('CRIACAO', 'EDICAO', 'STATUS', 'RESPONSAVEL', 'ENCAMINHAMENTO', 'RETORNO', 'COMENTARIO');

-- CreateTable
CREATE TABLE "bairro" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "regional_id" INTEGER NOT NULL,

    CONSTRAINT "bairro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tema" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orgao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "esfera" "Esfera" NOT NULL DEFAULT 'MUNICIPAL',
    "contato" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "orgao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoa" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "bairro_id" INTEGER,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocolo_seq" (
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL,

    CONSTRAINT "protocolo_seq_pkey" PRIMARY KEY ("ano")
);

-- CreateTable
CREATE TABLE "demanda" (
    "id" UUID NOT NULL,
    "protocolo" TEXT NOT NULL,
    "pessoa_id" UUID NOT NULL,
    "endereco" TEXT,
    "bairro_id" INTEGER,
    "tema_id" INTEGER NOT NULL,
    "tipo" "TipoDemanda" NOT NULL DEFAULT 'SOLICITACAO',
    "descricao" TEXT NOT NULL,
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "status" "StatusDemanda" NOT NULL DEFAULT 'NOVA',
    "prazo" DATE,
    "responsavel_id" UUID,
    "orgao_id" INTEGER,
    "data_entrada" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_conclusao" DATE,
    "observacoes" TEXT,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demanda_historico" (
    "id" UUID NOT NULL,
    "demanda_id" UUID NOT NULL,
    "usuario_id" UUID,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoHistorico" NOT NULL,
    "status_anterior" "StatusDemanda",
    "status_novo" "StatusDemanda",
    "descricao" TEXT NOT NULL,

    CONSTRAINT "demanda_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encaminhamento" (
    "id" UUID NOT NULL,
    "demanda_id" UUID NOT NULL,
    "orgao_id" INTEGER NOT NULL,
    "usuario_id" UUID,
    "data" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolo" TEXT,
    "descricao" TEXT NOT NULL,
    "prazo_retorno" DATE,
    "retorno" TEXT,
    "data_retorno" DATE,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encaminhamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bairro_nome_regional_id_key" ON "bairro"("nome", "regional_id");

-- CreateIndex
CREATE UNIQUE INDEX "tema_nome_key" ON "tema"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "orgao_nome_key" ON "orgao"("nome");

-- CreateIndex
CREATE INDEX "pessoa_telefone_idx" ON "pessoa"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "demanda_protocolo_key" ON "demanda"("protocolo");

-- CreateIndex
CREATE INDEX "demanda_status_idx" ON "demanda"("status");

-- CreateIndex
CREATE INDEX "demanda_prazo_idx" ON "demanda"("prazo");

-- CreateIndex
CREATE INDEX "demanda_responsavel_id_idx" ON "demanda"("responsavel_id");

-- CreateIndex
CREATE INDEX "demanda_bairro_id_idx" ON "demanda"("bairro_id");

-- CreateIndex
CREATE INDEX "demanda_tema_id_idx" ON "demanda"("tema_id");

-- CreateIndex
CREATE INDEX "demanda_historico_demanda_id_data_idx" ON "demanda_historico"("demanda_id", "data");

-- CreateIndex
CREATE INDEX "encaminhamento_demanda_id_idx" ON "encaminhamento"("demanda_id");

-- AddForeignKey
ALTER TABLE "bairro" ADD CONSTRAINT "bairro_regional_id_fkey" FOREIGN KEY ("regional_id") REFERENCES "regional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda" ADD CONSTRAINT "demanda_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda" ADD CONSTRAINT "demanda_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda" ADD CONSTRAINT "demanda_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "tema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda" ADD CONSTRAINT "demanda_orgao_id_fkey" FOREIGN KEY ("orgao_id") REFERENCES "orgao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda" ADD CONSTRAINT "demanda_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda" ADD CONSTRAINT "demanda_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda_historico" ADD CONSTRAINT "demanda_historico_demanda_id_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demanda_historico" ADD CONSTRAINT "demanda_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamento" ADD CONSTRAINT "encaminhamento_demanda_id_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamento" ADD CONSTRAINT "encaminhamento_orgao_id_fkey" FOREIGN KEY ("orgao_id") REFERENCES "orgao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamento" ADD CONSTRAINT "encaminhamento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
