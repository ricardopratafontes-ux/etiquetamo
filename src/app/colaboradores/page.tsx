import { requerAutenticacao } from '@/lib/perfil';
import ColaboradoresPageClient from './ColaboradoresPageClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <ColaboradoresPageClient perfil={perfil} />;
}
