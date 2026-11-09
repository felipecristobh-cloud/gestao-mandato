-- CreateEnum
CREATE TYPE "TipoProposicao" AS ENUM ('PROJETO_LEI', 'PROJETO_RESOLUCAO', 'REQUERIMENTO', 'INDICACAO', 'PEDIDO_INFORMACAO', 'EMENDA_PROJETO', 'EMENDA_ORCAMENTARIA', 'OUTRA');

-- CreateEnum
CREATE TYPE "ParticipacaoProposicao" AS ENUM ('AUTORIA', 'COAUTORIA', 'EMENDA', 'DISCUSSAO');

-- CreateEnum
CREATE TYPE "VerificacaoProposicao" AS ENUM ('CONFIRMADO', 'AGUARDANDO', 'INCOMPLETO', 'CORRIGIDO');

-- CreateEnum
CREATE TYPE "TipoHistoricoProposicao" AS ENUM ('CRIACAO', 'EDICAO', 'VERIFICACAO', 'IMPORTACAO');

-- CreateTable
CREATE TABLE "proposicao" (
    "id" UUID NOT NULL,
    "tipo" "TipoProposicao" NOT NULL,
    "numero" INTEGER NOT NULL,
    "ano" SMALLINT NOT NULL,
    "ementa" TEXT NOT NULL,
    "descricao" TEXT,
    "justificativa" TEXT,
    "participacao" "ParticipacaoProposicao" NOT NULL,
    "parlamentares" TEXT,
    "data_apresentacao" DATE,
    "comissoes" TEXT,
    "pareceres" TEXT,
    "situacao" TEXT,
    "resultado_votacao" TEXT,
    "lei" TEXT,
    "data_conclusao" DATE,
    "link_oficial" TEXT,
    "observacoes" TEXT,
    "fonte" TEXT NOT NULL,
    "verificacao" "VerificacaoProposicao" NOT NULL DEFAULT 'AGUARDANDO',
    "eixo_id" INTEGER,
    "codigo_externo" TEXT,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposicao_historico" (
    "id" UUID NOT NULL,
    "proposicao_id" UUID NOT NULL,
    "usuario_id" UUID,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoHistoricoProposicao" NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "proposicao_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposicao_codigo_externo_key" ON "proposicao"("codigo_externo");

-- CreateIndex
CREATE INDEX "proposicao_ano_idx" ON "proposicao"("ano");

-- CreateIndex
CREATE INDEX "proposicao_eixo_id_idx" ON "proposicao"("eixo_id");

-- CreateIndex
CREATE INDEX "proposicao_verificacao_idx" ON "proposicao"("verificacao");

-- CreateIndex
CREATE UNIQUE INDEX "proposicao_tipo_numero_ano_key" ON "proposicao"("tipo", "numero", "ano");

-- CreateIndex
CREATE INDEX "proposicao_historico_proposicao_id_data_idx" ON "proposicao_historico"("proposicao_id", "data");

-- AddForeignKey
ALTER TABLE "proposicao" ADD CONSTRAINT "proposicao_eixo_id_fkey" FOREIGN KEY ("eixo_id") REFERENCES "eixo_legislativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposicao" ADD CONSTRAINT "proposicao_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposicao_historico" ADD CONSTRAINT "proposicao_historico_proposicao_id_fkey" FOREIGN KEY ("proposicao_id") REFERENCES "proposicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposicao_historico" ADD CONSTRAINT "proposicao_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Proposições só nos anos de mandato (2013 a 2028) e com número positivo.
ALTER TABLE "proposicao" ADD CONSTRAINT "proposicao_ano_mandato" CHECK ("ano" BETWEEN 2013 AND 2028);
ALTER TABLE "proposicao" ADD CONSTRAINT "proposicao_numero_positivo" CHECK ("numero" > 0);

ALTER TABLE "proposicao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "proposicao_historico" ENABLE ROW LEVEL SECURITY;
