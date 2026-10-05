import { z } from "zod";

export const PERFIS = ["ADMIN", "COORDENACAO", "ASSESSOR", "CONSULTA"] as const;

const texto = (max: number) => z.string().trim().max(max);

export const usuarioCriarSchema = z.object({
  nome: texto(120).min(3, "Informe o nome completo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  telefone: texto(30).optional().transform((v) => v || undefined),
  cargo: texto(80).optional().transform((v) => v || undefined),
  perfil: z.enum(PERFIS),
});

export const usuarioAtualizarSchema = usuarioCriarSchema.extend({
  ativo: z.boolean(),
});

export type UsuarioCriar = z.input<typeof usuarioCriarSchema>;
export type UsuarioAtualizar = z.input<typeof usuarioAtualizarSchema>;
