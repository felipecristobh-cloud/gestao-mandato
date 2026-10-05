export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "PROIBIDO" | "NAO_AUTENTICADO" | "VALIDACAO" | "NAO_ENCONTRADO" | "CONFLITO",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const proibido = (msg = "Você não tem permissão para esta ação.") => new AppError(msg, "PROIBIDO");
export const validacao = (msg: string) => new AppError(msg, "VALIDACAO");
export const naoEncontrado = (msg = "Registro não encontrado.") => new AppError(msg, "NAO_ENCONTRADO");
export const conflito = (msg: string) => new AppError(msg, "CONFLITO");
