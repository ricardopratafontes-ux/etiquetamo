import { requerAutenticacao } from '@/lib/perfil';
import TesteImpressaoClient from './TesteImpressaoClient';

export const metadata = {
  title: 'EtiquetaMO',
  description: 'Sistema de impressão de etiquetas térmicas',
};

export default async function Page() {
  const { perfil } = await requerAutenticacao();

  return <TesteImpressaoClient perfil={perfil} />;
}
