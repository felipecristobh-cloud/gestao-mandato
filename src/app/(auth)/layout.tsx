import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Pedro Patrus" width={669} height={353} priority className="h-auto w-40" />
          <h1 className="mt-3 text-sm font-semibold uppercase tracking-wider text-neutral-900">Gestão do Mandato</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
