import type { Db } from "@/server/db";
import { exigir, type Ator } from "@/server/authz";
import { registrarAuditoria, diferenca } from "@/server/audit";
import { conflito, naoEncontrado, validacao } from "@/server/errors";
import { hashSenha, verificarSenha, validarPoliticaSenha, gerarSenhaTemporaria } from "@/server/auth/password";
import { usuarioAtualizarSchema, usuarioCriarSchema, type UsuarioAtualizar, type UsuarioCriar } from "@/lib/validacao/usuario";

const CAMPOS_PUBLICOS = {
  id: true, nome: true, email: true, telefone: true, cargo: true, perfil: true, ativo: true,
  ultimoLogin: true, bloqueadoAte: true, criadoEm: true, atualizadoEm: true,
} as const;

function primeiroErro(r: { error: { issues: { message: string }[] } }) {
  return validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

export async function listarUsuarios(db: Db, ator: Ator) {
  exigir(ator, "usuarios:gerenciar");
  return db.usuario.findMany({ select: CAMPOS_PUBLICOS, orderBy: [{ ativo: "desc" }, { nome: "asc" }] });
}

export async function obterUsuario(db: Db, ator: Ator, id: string) {
  exigir(ator, "usuarios:gerenciar");
  const u = await db.usuario.findUnique({ where: { id }, select: CAMPOS_PUBLICOS });
  if (!u) throw naoEncontrado("Usuário não encontrado.");
  return u;
}

/** Cria o usuário com senha temporária; ele é obrigado a trocar no primeiro acesso. */
export async function criarUsuario(db: Db, ator: Ator, entrada: UsuarioCriar) {
  exigir(ator, "usuarios:gerenciar");
  const r = usuarioCriarSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const dados = r.data;
  if (await db.usuario.findUnique({ where: { email: dados.email } })) throw conflito("Já existe um usuário com este e-mail.");

  const senhaTemporaria = gerarSenhaTemporaria();
  const senhaHash = await hashSenha(senhaTemporaria);
  const usuario = await db.$transaction(async (tx) => {
    const u = await tx.usuario.create({ data: { ...dados, senhaHash, trocarSenha: true }, select: CAMPOS_PUBLICOS });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "usuario", registroId: u.id, acao: "CRIAR", valorNovo: u });
    return u;
  });
  return { usuario, senhaTemporaria };
}

export async function atualizarUsuario(db: Db, ator: Ator, id: string, entrada: UsuarioAtualizar) {
  exigir(ator, "usuarios:gerenciar");
  const r = usuarioAtualizarSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const dados = r.data;

  const atual = await db.usuario.findUnique({ where: { id }, select: CAMPOS_PUBLICOS });
  if (!atual) throw naoEncontrado("Usuário não encontrado.");

  if (id === ator.id && (!dados.ativo || dados.perfil !== atual.perfil)) {
    throw validacao("Você não pode desativar nem mudar o perfil do seu próprio usuário.");
  }
  if (dados.email !== atual.email && (await db.usuario.findUnique({ where: { email: dados.email } }))) {
    throw conflito("Já existe um usuário com este e-mail.");
  }
  const deixaDeSerAdmin = atual.perfil === "ADMIN" && atual.ativo && (dados.perfil !== "ADMIN" || !dados.ativo);

  const { anterior, novo, mudou } = diferenca(atual as Record<string, unknown>, dados);
  if (!mudou) return atual;

  return db.$transaction(async (tx) => {
    if (deixaDeSerAdmin) {
      // Trava as linhas dos admins ativos para que rebaixamentos simultâneos não zerem os administradores.
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM usuario WHERE perfil = 'ADMIN' AND ativo FOR UPDATE`;
      if (admins.length <= 1) throw validacao("O sistema precisa de pelo menos um administrador ativo.");
    }
    const u = await tx.usuario.update({ where: { id }, data: dados, select: CAMPOS_PUBLICOS });
    if (!dados.ativo || dados.perfil !== atual.perfil) await tx.sessao.deleteMany({ where: { usuarioId: id } });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "usuario", registroId: id, acao: "EDITAR", valorAnterior: anterior, valorNovo: novo });
    return u;
  });
}

export async function redefinirSenha(db: Db, ator: Ator, id: string) {
  exigir(ator, "usuarios:gerenciar");
  const atual = await db.usuario.findUnique({ where: { id } });
  if (!atual) throw naoEncontrado("Usuário não encontrado.");
  const senhaTemporaria = gerarSenhaTemporaria();
  const senhaHash = await hashSenha(senhaTemporaria);
  await db.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { senhaHash, trocarSenha: true, tentativasFalhas: 0, bloqueadoAte: null } });
    await tx.sessao.deleteMany({ where: { usuarioId: id } });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "usuario", registroId: id, acao: "EDITAR", descricao: "Senha redefinida pelo administrador" });
  });
  return { senhaTemporaria };
}

/** Troca da própria senha. Encerra as outras sessões do usuário. */
export async function trocarPropriaSenha(db: Db, ator: Ator, senhaAtual: string, novaSenha: string, sessaoAtualId?: string) {
  const u = await db.usuario.findUnique({ where: { id: ator.id } });
  if (!u || !u.ativo) throw naoEncontrado("Usuário não encontrado.");
  if (!(await verificarSenha(u.senhaHash, senhaAtual))) throw validacao("Senha atual incorreta.");
  const erro = validarPoliticaSenha(novaSenha);
  if (erro) throw validacao(erro);
  if (await verificarSenha(u.senhaHash, novaSenha)) throw validacao("A nova senha deve ser diferente da atual.");
  const senhaHash = await hashSenha(novaSenha);
  await db.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: u.id }, data: { senhaHash, trocarSenha: false } });
    await tx.sessao.deleteMany({ where: { usuarioId: u.id, ...(sessaoAtualId ? { NOT: { id: sessaoAtualId } } : {}) } });
    await registrarAuditoria(tx, { usuarioId: u.id, entidade: "usuario", registroId: u.id, acao: "EDITAR", descricao: "Troca da própria senha" });
  });
}

export async function listarAuditoria(db: Db, ator: Ator, filtros: { entidade?: string; usuarioId?: string; pagina?: number } = {}) {
  exigir(ator, "auditoria:ver");
  const porPagina = 50;
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const where = {
    ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
  };
  const [itens, total] = await Promise.all([
    db.auditLog.findMany({
      where, orderBy: { data: "desc" }, skip: (pagina - 1) * porPagina, take: porPagina,
      include: { usuario: { select: { nome: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { itens, total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}
