import { requerAutenticacao } from '@/lib/perfil';
import NovoItemClient from './NovoItemClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <NovoItemClient perfil={perfil} />;
}
