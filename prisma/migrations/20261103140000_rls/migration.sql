-- Liga RLS em todas as tabelas do schema public, sem políticas.
-- No Supabase isso fecha a API REST (roles anon/authenticated) para estas tabelas.
-- O app (Prisma) conecta como dono das tabelas, que não é afetado pelo RLS.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
