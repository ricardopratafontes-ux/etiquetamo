import { requerAutenticacao } from '@/lib/perfil';
import EditarItemClient from './EditarItemClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <EditarItemClient perfil={perfil} />;
}
