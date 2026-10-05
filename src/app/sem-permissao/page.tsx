import Link from "next/link";
import { classeBotao, Cartao } from "@/components/ui";

export default function SemPermissao() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Cartao className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Acesso não permitido</h1>
        <p className="mt-2 text-sm text-slate-600">Seu perfil não tem acesso a esta página. Fale com a coordenação se precisar.</p>
        <Link href="/dashboard" className={classeBotao("secundario", "mt-4")}>Voltar ao início</Link>
      </Cartao>
    </main>
  );
}
