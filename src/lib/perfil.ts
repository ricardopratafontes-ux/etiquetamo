import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, verifySession, type SessaoIntranet } from './intranet-auth';

/**
 * Perfis da intranet que podem acessar o EtiquetaMO.
 * Mapeamento: perfil da intranet → pode entrar ou não.
 */
const PERFIS_ACESSO_ETIQUETAMO = new Set([
  'master',      // admin central
  'gerente',     // gerente de loja
  'supervisor',  // supervisor de produção
  'producao',    // operador de produção
  'atendente',   // atendente (piso de vendas, pode retirar)
]);

export interface PerfilEtiquetaMO {
  email: string;
  nome: string;
  perfil_intranet: string;
}

/**
 * Extrai a sessão do cookie sem validação de banco.
 */
export function sessaoDoCookie(): SessaoIntranet | null {
  const c = cookies().get(COOKIE)?.value;
  return verifySession(c);
}

/**
 * Valida a sessão: cookie existe, assinatura é válida, perfil tem acesso.
 * Se tudo ok, retorna { sessao, perfil }.
 * Caso contrário, redireciona pra /login.
 */
export async function requerAutenticacao(): Promise<{
  sessao: SessaoIntranet;
  perfil: PerfilEtiquetaMO;
}> {
  const sessao = sessaoDoCookie();

  if (!sessao) {
    redirect('/login');
  }

  const perfilIntra = (sessao.perfil ?? '').toLowerCase().trim();

  if (!PERFIS_ACESSO_ETIQUETAMO.has(perfilIntra)) {
    redirect('/login?erro=sem_acesso');
  }

  return {
    sessao,
    perfil: {
      email: sessao.email,
      nome: sessao.nome || sessao.email,
      perfil_intranet: sessao.perfil,
    },
  };
}
