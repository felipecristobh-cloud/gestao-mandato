import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/auth/current";
import { FormLogin } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await usuarioAtual()) redirect("/dashboard");
  return <FormLogin />;
}
