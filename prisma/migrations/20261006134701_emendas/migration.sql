-- CreateEnum
CREATE TYPE "StatusEmenda" AS ENUM ('EM_NEGOCIACAO', 'EM_ELABORACAO', 'INDICADA', 'PROTOCOLADA', 'APROVADA', 'EM_ANALISE', 'IMPEDIMENTO_TECNICO', 'EMPENHADA', 'EM_EXECUCAO', 'LIQUIDADA', 'PAGA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoEmenda" AS ENUM ('INDIVIDUAL', 'BANCADA', 'COMISSAO', 'RELATOR', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('EMPENHO', 'LIQUIDACAO', 'PAGAMENTO');

-- CreateEnum
CREATE TYPE "TipoDocumentoEmenda" AS ENUM ('OFICIO', 'PROCESSO', 'PLANO_TRABALHO', 'NOTA_EMPENHO', 'TERMO', 'COMPROVANTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoHistoricoEmenda" AS ENUM ('CRIACAO', 'EDICAO', 'STATUS', 'RESPONSAVEL', 'EXECUCAO', 'MANDATO', 'DOCUMENTO', 'COMENTARIO');

-- CreateTable
CREATE TABLE "emenda_seq" (
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL,

    CONSTRAINT "emenda_seq_pkey" PRIMARY KEY ("ano")
);

-- CreateTable
CREATE TABLE "emenda" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "numero" TEXT,
    "ano" INTEGER NOT NULL,
    "esfera" "Esfera" NOT NULL,
    "tipo" "TipoEmenda" NOT NULL DEFAULT 'INDIVIDUAL',
    "objeto" TEXT NOT NULL,
    "justificativa" TEXT,
    "valor_indicado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valor_aprovado" DECIMAL(14,2),
    "valor_empenhado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valor_liquidado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valor_pago" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "StatusEmenda" NOT NULL DEFAULT 'EM_NEGOCIACAO',
    "beneficiario" TEXT,
    "cnpj" CHAR(14),
    "orgao_id" INTEGER,
    "secretaria" TEXT,
    "municipio" TEXT,
    "bairro_id" INTEGER,
    "programa" TEXT,
    "acao_orcamentaria" TEXT,
    "prazo" DATE,
    "responsavel_id" UUID,
    "observacoes" TEXT,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emenda_lancamento" (
    "id" UUID NOT NULL,
    "emenda_id" UUID NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "data" DATE NOT NULL,
    "documento" TEXT,
    "observacoes" TEXT,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emenda_lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emenda_mandato" (
    "id" UUID NOT NULL,
    "emenda_id" UUID NOT NULL,
    "mandato_id" UUID NOT NULL,
    "tipo" "TipoParticipacao" NOT NULL,
    "responsabilidade" TEXT,
    "data_inicio" DATE,
    "data_fim" DATE,
    "observacoes" TEXT,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emenda_mandato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emenda_documento" (
    "id" UUID NOT NULL,
    "emenda_id" UUID NOT NULL,
    "tipo" "TipoDocumentoEmenda" NOT NULL,
    "descricao" TEXT NOT NULL,
    "numero" TEXT,
    "data" DATE,
    "url" TEXT,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emenda_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emenda_historico" (
    "id" UUID NOT NULL,
    "emenda_id" UUID NOT NULL,
    "usuario_id" UUID,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoHistoricoEmenda" NOT NULL,
    "status_anterior" "StatusEmenda",
    "status_novo" "StatusEmenda",
    "descricao" TEXT NOT NULL,

    CONSTRAINT "emenda_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emenda_codigo_key" ON "emenda"("codigo");

-- CreateIndex
CREATE INDEX "emenda_status_idx" ON "emenda"("status");

-- CreateIndex
CREATE INDEX "emenda_ano_idx" ON "emenda"("ano");

-- CreateIndex
CREATE INDEX "emenda_responsavel_id_idx" ON "emenda"("responsavel_id");

-- CreateIndex
CREATE UNIQUE INDEX "emenda_esfera_ano_numero_key" ON "emenda"("esfera", "ano", "numero");

-- CreateIndex
CREATE INDEX "emenda_lancamento_emenda_id_data_idx" ON "emenda_lancamento"("emenda_id", "data");

-- CreateIndex
CREATE INDEX "emenda_mandato_mandato_id_idx" ON "emenda_mandato"("mandato_id");

-- CreateIndex
CREATE UNIQUE INDEX "emenda_mandato_emenda_id_mandato_id_tipo_key" ON "emenda_mandato"("emenda_id", "mandato_id", "tipo");

-- CreateIndex
CREATE INDEX "emenda_documento_emenda_id_idx" ON "emenda_documento"("emenda_id");

-- CreateIndex
CREATE INDEX "emenda_historico_emenda_id_data_idx" ON "emenda_historico"("emenda_id", "data");

-- AddForeignKey
ALTER TABLE "emenda" ADD CONSTRAINT "emenda_orgao_id_fkey" FOREIGN KEY ("orgao_id") REFERENCES "orgao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda" ADD CONSTRAINT "emenda_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda" ADD CONSTRAINT "emenda_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda" ADD CONSTRAINT "emenda_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_lancamento" ADD CONSTRAINT "emenda_lancamento_emenda_id_fkey" FOREIGN KEY ("emenda_id") REFERENCES "emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_lancamento" ADD CONSTRAINT "emenda_lancamento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_mandato" ADD CONSTRAINT "emenda_mandato_emenda_id_fkey" FOREIGN KEY ("emenda_id") REFERENCES "emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_mandato" ADD CONSTRAINT "emenda_mandato_mandato_id_fkey" FOREIGN KEY ("mandato_id") REFERENCES "mandato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_mandato" ADD CONSTRAINT "emenda_mandato_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_documento" ADD CONSTRAINT "emenda_documento_emenda_id_fkey" FOREIGN KEY ("emenda_id") REFERENCES "emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_documento" ADD CONSTRAINT "emenda_documento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_historico" ADD CONSTRAINT "emenda_historico_emenda_id_fkey" FOREIGN KEY ("emenda_id") REFERENCES "emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda_historico" ADD CONSTRAINT "emenda_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Valores precisam fechar: pago ≤ liquidado ≤ empenhado ≤ aprovado (quando houver), nada negativo.
ALTER TABLE "emenda" ADD CONSTRAINT "emenda_valores_validos" CHECK (
  "valor_indicado" >= 0 AND ("valor_aprovado" IS NULL OR "valor_aprovado" >= 0)
  AND "valor_pago" >= 0 AND "valor_pago" <= "valor_liquidado"
  AND "valor_liquidado" <= "valor_empenhado"
  AND ("valor_aprovado" IS NULL OR "valor_empenhado" <= "valor_aprovado")
);

ALTER TABLE "emenda_lancamento" ADD CONSTRAINT "emenda_lancamento_valor_positivo" CHECK ("valor" > 0);

-- No máximo um autor por emenda.
CREATE UNIQUE INDEX "emenda_mandato_autor_unico" ON "emenda_mandato" ("emenda_id") WHERE "tipo" = 'AUTOR';

ALTER TABLE "emenda_mandato" ADD CONSTRAINT "emenda_mandato_periodo_valido" CHECK ("data_fim" IS NULL OR "data_inicio" IS NULL OR "data_fim" >= "data_inicio");
