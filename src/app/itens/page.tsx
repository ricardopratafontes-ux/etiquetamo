import { requerAutenticacao } from '@/lib/perfil';
import ListaItensClient from './ListaItensClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <ListaItensClient perfil={perfil} />;
}
