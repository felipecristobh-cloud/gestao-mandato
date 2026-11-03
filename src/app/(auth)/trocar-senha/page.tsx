import type { Metadata } from "next";
import { exigirUsuario } from "@/server/auth/current";
import { FormTrocarSenha } from "@/components/forms/trocar-senha";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function TrocarSenhaPage() {
  const u = await exigirUsuario({ permitirTrocaPendente: true });
  return <FormTrocarSenha obrigatoria={u.trocarSenha} />;
}
