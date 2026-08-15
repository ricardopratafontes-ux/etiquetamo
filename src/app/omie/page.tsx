import { createClient } from '@supabase/supabase-js';
import { requerAutenticacao } from '@/lib/perfil';
import { SUPABASE_SCHEMA } from '@/lib/supabaseSchema';
import OmiePageClient, { type ExecucaoSync } from './OmiePageClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sincronização de produtos com o OMIE',
};

// A tela tem que refletir a execução que acabou de rodar, nunca um cache.
export const dynamic = 'force-dynamic';

const ORG_SLUG = 'gelateria';

/**
 * O histórico é lido AQUI, no servidor, com service_role.
 * `omie_sync_log` não tem policy pra anon (é tabela de service role, como diz
 * MIGRACAO-SCHEMA-ETIQUETA.md), então o client nunca conseguiria ler direto.
 */
export default async function Page() {
  const { perfil } = await requerAutenticacao();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: SUPABASE_SCHEMA } }
  );

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', ORG_SLUG)
    .single();

  let execucoes: ExecucaoSync[] = [];

  if (org) {
    const { data } = await supabase
      .from('omie_sync_log')
      .select('id, total_omie, matched, updated, errors, started_at, completed_at, details')
      .eq('organization_id', org.id)
      .eq('sync_type', 'products')
      .order('started_at', { ascending: false })
      .limit(20);

    execucoes = (data ?? []) as ExecucaoSync[];
  }

  return <OmiePageClient perfil={perfil} execucoes={execucoes} />;
}
