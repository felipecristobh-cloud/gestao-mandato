export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-marca-700">Mandato Pedro Patrus</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Gestão do Mandato</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
