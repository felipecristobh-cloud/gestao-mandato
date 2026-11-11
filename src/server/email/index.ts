import nodemailer from "nodemailer";

export type Email = { para: string; assunto: string; texto: string };

/** Envia pelo Gmail do gabinete (senha de app). Sem GMAIL_USUARIO/GMAIL_SENHA_APP, não envia (desenvolvimento/testes). */
export async function enviarEmail(e: Email): Promise<boolean> {
  const usuario = process.env.GMAIL_USUARIO?.trim();
  const senha = process.env.GMAIL_SENHA_APP?.replace(/\s+/g, "");
  if (!usuario || !senha) return false;
  const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: usuario, pass: senha }, connectionTimeout: 8000, socketTimeout: 8000 });
  await t.sendMail({ from: `"Gestão do Mandato" <${usuario}>`, to: e.para, subject: e.assunto, text: e.texto });
  return true;
}

const appUrl = () => (process.env.APP_URL?.trim().replace(/\/$/, "") || "https://mandatopedropatrus.vercel.app");

/** Aviso ao novo responsável. Só protocolo, tema e prazo: nada de dado do cidadão (LGPD). Falha não interrompe a operação. */
export async function avisarResponsavelDemanda(
  responsavel: { email: string; nome: string; ativo: boolean },
  d: { id: string; protocolo: string; tema: string; prazo: Date | null },
  atribuidoPor: string,
) {
  if (!responsavel.ativo || responsavel.email.endsWith(".invalid")) return false;
  const prazo = d.prazo ? `\nPrazo: ${d.prazo.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : "";
  try {
    return await enviarEmail({
      para: responsavel.email,
      assunto: `Nova demanda para você: ${d.protocolo}`,
      texto: `Olá, ${responsavel.nome.split(" ")[0]}!\n\n${atribuidoPor} colocou você como responsável pela demanda ${d.protocolo} (${d.tema}).${prazo}\n\nAbra no sistema: ${appUrl()}/demandas/${d.id}\n\nGestão do Mandato — este e-mail é automático, não responda.`,
    });
  } catch (err) {
    console.error("Falha ao enviar alerta de demanda:", (err as Error).message);
    return false;
  }
}
