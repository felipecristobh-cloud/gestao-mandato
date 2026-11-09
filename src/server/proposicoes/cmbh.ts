import type { ProposicaoEntrada } from "@/lib/validacao/proposicao";

/**
 * Ponto de extensão para a futura integração com o portal da Câmara Municipal de BH
 * (https://www.cmbh.mg.gov.br/atividade-legislativa/pesquisar-proposicoes).
 *
 * Hoje o portal não oferece API pública documentada, e coletar páginas automaticamente pode violar
 * as condições de acesso, então nada é buscado sozinho. Quando a Câmara publicar uma API oficial, basta implementar
 * esta interface: cada item vira uma linha para `conferirImportacao`, passando pela mesma conferência
 * (duplicadas, validação) e com `codigoExterno` preenchido para sincronizações futuras.
 */
export interface FonteOficialProposicoes {
  nome: string;
  buscar(filtro: { ano: number; autor: string }): Promise<(ProposicaoEntrada & { codigoExterno: string })[]>;
}

export const FONTE_OFICIAL_DISPONIVEL = false;
