import type { Perfil } from "@prisma/client";
import { proibido } from "@/server/errors";

export type Permissao =
  | "usuarios:gerenciar"
  | "auditoria:ver"
  | "configuracoes:gerenciar"
  | "dados:ver"
  | "dados:criar"
  | "dados:editar_todos"
  | "dados:editar_proprios"
  | "cadastros_base:gerenciar"
  | "documentos_restritos:ver"
  | "relatorios:exportar_com_dados_pessoais"
  | "relatorios:exportar"
  | "contatos:ver_todos"
  | "lgpd:anonimizar";

/** Matriz de permissões (docs/decisoes/ADR-003-permissoes.md). A interface só esconde botões; quem decide é o servidor. */
export const MATRIZ: Record<Perfil, readonly Permissao[]> = {
  ADMIN: [
    "usuarios:gerenciar", "auditoria:ver", "configuracoes:gerenciar", "dados:ver", "dados:criar",
    "dados:editar_todos", "dados:editar_proprios", "cadastros_base:gerenciar", "documentos_restritos:ver",
    "relatorios:exportar_com_dados_pessoais", "relatorios:exportar", "contatos:ver_todos", "lgpd:anonimizar",
  ],
  COORDENACAO: [
    "auditoria:ver", "dados:ver", "dados:criar", "dados:editar_todos", "dados:editar_proprios",
    "cadastros_base:gerenciar", "documentos_restritos:ver", "relatorios:exportar_com_dados_pessoais",
    "relatorios:exportar", "contatos:ver_todos",
  ],
  ASSESSOR: ["dados:ver", "dados:criar", "dados:editar_proprios", "relatorios:exportar"],
  CONSULTA: ["dados:ver", "relatorios:exportar"],
};

export type Ator = { id: string; perfil: Perfil };

export function pode(ator: Ator | null | undefined, permissao: Permissao): boolean {
  if (!ator) return false;
  return MATRIZ[ator.perfil]?.includes(permissao) ?? false;
}

export function exigir(ator: Ator | null | undefined, permissao: Permissao): asserts ator is Ator {
  if (!pode(ator, permissao)) throw proibido();
}

/** Regra de edição de registros com dono (demandas, emendas): todos para quem edita tudo; o próprio para assessor. */
export function podeEditarRegistro(
  ator: Ator | null | undefined,
  registro: { responsavelId?: string | null; criadoPorId?: string | null },
): boolean {
  if (!ator) return false;
  if (pode(ator, "dados:editar_todos")) return true;
  if (!pode(ator, "dados:editar_proprios")) return false;
  return registro.responsavelId === ator.id || registro.criadoPorId === ator.id;
}

export function podeVerContato(
  ator: Ator | null | undefined,
  registro: { responsavelId?: string | null; criadoPorId?: string | null },
): boolean {
  if (!ator) return false;
  if (pode(ator, "contatos:ver_todos")) return true;
  if (ator.perfil === "CONSULTA") return false;
  return registro.responsavelId === ator.id || registro.criadoPorId === ator.id;
}

export const ROTULO_PERFIL: Record<Perfil, string> = {
  ADMIN: "Administrador",
  COORDENACAO: "Coordenação",
  ASSESSOR: "Assessor",
  CONSULTA: "Consulta",
};
