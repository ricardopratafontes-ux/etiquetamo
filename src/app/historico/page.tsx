import { requerAutenticacao } from '@/lib/perfil';
import HistoricoPageClient from './HistoricoPageClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <HistoricoPageClient perfil={perfil} />;
}
