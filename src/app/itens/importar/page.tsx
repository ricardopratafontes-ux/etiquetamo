import { requerAutenticacao } from '@/lib/perfil';
import ImportarItensClient from './ImportarItensClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <ImportarItensClient perfil={perfil} />;
}
