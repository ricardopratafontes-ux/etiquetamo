import { requerAutenticacao } from '@/lib/perfil';
import EtiquetasAvulsasPageClient from './EtiquetasAvulsasPageClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <EtiquetasAvulsasPageClient perfil={perfil} />;
}
