import { requerAutenticacao } from '@/lib/perfil';
import RelatoriosPageClient from './RelatoriosPageClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <RelatoriosPageClient perfil={perfil} />;
}
