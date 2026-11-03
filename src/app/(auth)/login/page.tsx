import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/auth/current";
import { configGoogle } from "@/server/auth/google";
import { FormLogin } from "./form";

export const metadata: Metadata = { title: "Entrar" };

const ERROS: Record<string, string> = {
  google: "Não foi possível entrar com o Google. Tente de novo.",
  google_off: "O login com Google não está configurado.",
  google_sem_conta: "Este e-mail do Google não tem acesso. Peça ao administrador para cadastrar você em Usuários.",
  bloqueado: "Muitas tentativas. Aguarde 15 minutos.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await usuarioAtual()) redirect("/dashboard");
  const { erro } = await searchParams;
  return <FormLogin google={!!configGoogle()} erroInicial={erro ? ERROS[erro] : undefined} />;
}
